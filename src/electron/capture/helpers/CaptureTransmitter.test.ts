import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// mock the heavy runtime imports pulled in by the capture modules (electron, native NDI/Blackmagic, servers)
vi.mock("../..", () => ({ toApp: vi.fn() }))
vi.mock("../../ndi/NdiSender", () => ({ NdiSender: { NDI: {} } }))
vi.mock("../../ndi/vingester-util", () => ({ default: { ImageBufferAdjustment: { ARGBtoRGBA: vi.fn(), BGRAtoRGBA: vi.fn() } } }))
vi.mock("../../output/OutputHelper", () => ({ OutputHelper: { getOutput: vi.fn(), getAllOutputs: vi.fn(() => []), Send: { sendToWindow: vi.fn() } } }))
vi.mock("../../servers", () => ({ getConnections: vi.fn(() => 0), toServer: vi.fn(), getStageStreamSubscriberIds: vi.fn(() => [] as string[]), toStageStreamSubscribers: vi.fn() }))
vi.mock("../../blackmagic/BlackmagicSender", () => ({ BlackmagicSender: { canAcceptFrame: vi.fn(() => true), audioQueueLength: 0 } }))
vi.mock("../../webrtc/WebRtcHost", () => ({ WebRtcHost: { isRunning: vi.fn(() => false), start: vi.fn(), stop: vi.fn() } }))
vi.mock("../CaptureHelper", () => ({
    CaptureHelper: {
        getMaxActiveFramerate: vi.fn((framerates: { [key: string]: number }, options: { [key: string]: boolean }) => {
            const active = Object.keys(options)
                .filter((key) => options[key])
                .map((key) => framerates[key] || 1)
            return active.length ? Math.max(...active) : 1
        })
    }
}))

import { toApp } from "../.."
import { OutputHelper } from "../../output/OutputHelper"
import { getConnections, getStageStreamSubscriberIds, toStageStreamSubscribers } from "../../servers"
import { CaptureLifecycle } from "./CaptureLifecycle"
import { CaptureTransmitter } from "./CaptureTransmitter"

const CAPTURE_ID = "output1"
const SIZE = { width: 4, height: 4 }

// deterministic pixel buffers (RGBA, 4x4)
function makeFrame(fill: number): Buffer {
    return Buffer.alloc(SIZE.width * SIZE.height * 4, fill)
}

function skipFrame(channel: string, buffer: Buffer): boolean {
    return (CaptureTransmitter as any).shouldSkipUnchangedNonBlackmagicFrame(channel, CAPTURE_ID, buffer, SIZE)
}

let now = 0
beforeEach(() => {
    now = 1_000_000
    vi.spyOn(performance, "now").mockImplementation(() => now)
})

afterEach(() => {
    // reset transmitter state between tests
    CaptureTransmitter.removeAllChannels(CAPTURE_ID)
    CaptureTransmitter.stopChannel(CAPTURE_ID, "stage") // clears lastChangeTimes when no channels remain
    ;(CaptureTransmitter as any).lastFrameState = {}
    ;(CaptureTransmitter as any).lastChangeTimes = {}
    ;(CaptureTransmitter as any).lastStagePushTimes = {}
    ;(CaptureTransmitter as any).lastMainBufferSendTimes = {}
    vi.restoreAllMocks()
    vi.mocked(getConnections).mockReturnValue(0)
    vi.mocked(getStageStreamSubscriberIds).mockReturnValue([])
    vi.mocked(toStageStreamSubscribers).mockClear()
    vi.mocked(toApp).mockClear()
})

function mockStageViewer() {
    vi.mocked(getConnections).mockReturnValue(1)
    vi.mocked(getStageStreamSubscriberIds).mockReturnValue(["socket1"])
}

describe("CaptureTransmitter — unchanged frame skipping & change tracking", () => {
    it("sends the first frame and records a content change", () => {
        expect(skipFrame("stage", makeFrame(10))).toBe(false)
        expect(CaptureTransmitter.getTimeSinceLastChange(CAPTURE_ID)).toBe(0)
    })

    it("skips an identical frame within the keepalive interval", () => {
        skipFrame("stage", makeFrame(10))
        now += 100
        expect(skipFrame("stage", makeFrame(10))).toBe(true)
    })

    it("re-sends an identical frame as keepalive after the interval", () => {
        skipFrame("stage", makeFrame(10))
        now += 1001
        expect(skipFrame("stage", makeFrame(10))).toBe(false)
        // keepalive is not a content change - idle time keeps growing
        expect(CaptureTransmitter.getTimeSinceLastChange(CAPTURE_ID)).toBe(1001)
    })

    it("sends a changed frame immediately and resets the idle time", () => {
        skipFrame("stage", makeFrame(10))
        now += 100
        expect(skipFrame("stage", makeFrame(200))).toBe(false)
        expect(CaptureTransmitter.getTimeSinceLastChange(CAPTURE_ID)).toBe(0)
    })

    it("treats a resized frame as changed", () => {
        skipFrame("stage", makeFrame(10))
        now += 100
        const skipped = (CaptureTransmitter as any).shouldSkipUnchangedNonBlackmagicFrame("stage", CAPTURE_ID, Buffer.alloc(8 * 8 * 4, 10), { width: 8, height: 8 })
        expect(skipped).toBe(false)
        expect(CaptureTransmitter.getTimeSinceLastChange(CAPTURE_ID)).toBe(0)
    })

    it("tracks changes per capture across channels", () => {
        skipFrame("stage", makeFrame(10))
        now += 500
        // a different channel seeing the same new content also counts as a change for the capture
        expect(skipFrame("server", makeFrame(10))).toBe(false)
        expect(CaptureTransmitter.getTimeSinceLastChange(CAPTURE_ID)).toBe(0)
    })

    it("starts channels at full rate (change time initialized) and cleans up when the last channel stops", () => {
        CaptureTransmitter.startChannel(CAPTURE_ID, "stage")
        expect(CaptureTransmitter.getTimeSinceLastChange(CAPTURE_ID)).toBe(0)

        now += 5000
        expect(CaptureTransmitter.getTimeSinceLastChange(CAPTURE_ID)).toBe(5000)

        CaptureTransmitter.startChannel(CAPTURE_ID, "server")
        CaptureTransmitter.stopChannel(CAPTURE_ID, "stage")
        // still one channel left - keep tracking
        expect((CaptureTransmitter as any).lastChangeTimes[CAPTURE_ID]).not.toBeUndefined()

        CaptureTransmitter.stopChannel(CAPTURE_ID, "server")
        expect((CaptureTransmitter as any).lastChangeTimes[CAPTURE_ID]).toBeUndefined()
        // unknown capture reports 0 so a fresh capture never starts throttled
        expect(CaptureTransmitter.getTimeSinceLastChange(CAPTURE_ID)).toBe(0)
    })

    it("caps the preview request list", () => {
        for (let i = 0; i < 150; i++) CaptureTransmitter.requestPreview({ id: `win${i}`, previewId: "preview" })
        expect(CaptureTransmitter.requestList.length).toBeLessThanOrEqual(100)
        // newest requests are kept
        expect(CaptureTransmitter.requestList[CaptureTransmitter.requestList.length - 1]).toContain("win149")
        CaptureTransmitter.requestList = []
    })
})

// minimal NativeImage stand-in for sendBufferToMain
function makeImage(fill: number, w = 4, h = 4): any {
    return {
        toBitmap: () => Buffer.alloc(w * h * 4, fill),
        getSize: () => ({ width: w, height: h }),
        isEmpty: () => false,
        getAspectRatio: () => w / h,
        resize: (opts: { width: number }) => makeImage(fill, opts.width, Math.max(1, Math.round((opts.width * h) / w))),
        toJPEG: () => Buffer.from([0xff, 0xd8, fill])
    }
}

describe("CaptureTransmitter — web stage frame push & legacy buffer throttle", () => {
    it("pushes a JPEG frame to subscribed stage clients, throttled to the push interval", () => {
        mockStageViewer()

        CaptureTransmitter.sendBufferToMain(CAPTURE_ID, makeImage(10))
        expect(toStageStreamSubscribers).toHaveBeenCalledTimes(1)
        const msg = vi.mocked(toStageStreamSubscribers).mock.calls[0][0]
        expect(msg.channel).toBe("STREAM_FRAME")
        expect(msg.data.id).toBe(CAPTURE_ID)
        expect(msg.data.jpeg).toBeInstanceOf(Buffer)

        // changed frame within the throttle window is not pushed
        now += 50
        CaptureTransmitter.sendBufferToMain(CAPTURE_ID, makeImage(20))
        expect(toStageStreamSubscribers).toHaveBeenCalledTimes(1)

        // after the interval it is
        now += 100
        CaptureTransmitter.sendBufferToMain(CAPTURE_ID, makeImage(30))
        expect(toStageStreamSubscribers).toHaveBeenCalledTimes(2)
    })

    it("does no stage push work when no clients are connected", () => {
        CaptureTransmitter.sendBufferToMain(CAPTURE_ID, makeImage(10))
        expect(toStageStreamSubscribers).not.toHaveBeenCalled()
    })

    it("does no stage push work for connected clients without a mirror subscription (text-only stage displays)", () => {
        vi.mocked(getConnections).mockReturnValue(3)

        CaptureTransmitter.sendBufferToMain(CAPTURE_ID, makeImage(10))
        expect(toStageStreamSubscribers).not.toHaveBeenCalled()
    })

    it("downscales pushed frames wider than the max width", () => {
        mockStageViewer()

        CaptureTransmitter.sendBufferToMain(CAPTURE_ID, makeImage(10, 1920, 1080))
        const msg = vi.mocked(toStageStreamSubscribers).mock.calls[0][0]
        expect(msg.data.size.width).toBe(1280)
    })

    it("skips unchanged frames entirely (no push, no main buffer)", () => {
        mockStageViewer()

        CaptureTransmitter.sendBufferToMain(CAPTURE_ID, makeImage(10))
        now += 200
        CaptureTransmitter.sendBufferToMain(CAPTURE_ID, makeImage(10))
        expect(toStageStreamSubscribers).toHaveBeenCalledTimes(1)
        expect(toApp).toHaveBeenCalledTimes(1)
    })

    it("throttles raw buffers to the main window to the legacy poll rate", () => {
        CaptureTransmitter.sendBufferToMain(CAPTURE_ID, makeImage(10))
        expect(toApp).toHaveBeenCalledTimes(1)

        // changed frames keep arriving, but raw IPC is capped
        now += 200
        CaptureTransmitter.sendBufferToMain(CAPTURE_ID, makeImage(20))
        expect(toApp).toHaveBeenCalledTimes(1)

        now += 400
        CaptureTransmitter.sendBufferToMain(CAPTURE_ID, makeImage(30))
        expect(toApp).toHaveBeenCalledTimes(2)
    })

    it("still serves one-shot preview requests between legacy sends", () => {
        CaptureTransmitter.sendBufferToMain(CAPTURE_ID, makeImage(10))
        expect(toApp).toHaveBeenCalledTimes(1)

        CaptureTransmitter.requestPreview({ id: "someWindow", previewId: CAPTURE_ID })
        now += 100 // within legacy throttle window
        CaptureTransmitter.sendBufferToMain(CAPTURE_ID, makeImage(20))
        // no extra main send, but the request was answered
        expect(toApp).toHaveBeenCalledTimes(1)
        expect(OutputHelper.Send.sendToWindow).toHaveBeenCalledWith("someWindow", expect.objectContaining({ channel: "BUFFER" }))
        expect(CaptureTransmitter.requestList.length).toBe(0)
    })
})

describe("CaptureLifecycle — idle frame rate backoff", () => {
    const framerates = { stage: 20, server: 10, ndi: 30, blackmagic: 30, webrtc: 30 }

    function mockOutput(options: { [key: string]: boolean }) {
        const captureOptions = { options, framerates, window: {}, frameSubscription: null, id: CAPTURE_ID }
        vi.mocked(OutputHelper.getOutput).mockReturnValue({ captureOptions } as any)
        return captureOptions
    }

    function getRate(captureOpts: any): number {
        return (CaptureLifecycle as any).getAdaptiveFrameRate(CAPTURE_ID, captureOpts)
    }

    it("captures at full rate while content is changing", () => {
        const captureOpts = mockOutput({ stage: true })
        skipFrame("stage", makeFrame(10))
        expect(getRate(captureOpts)).toBe(20)
    })

    it("drops to the idle rate once content has been static past the threshold", () => {
        const captureOpts = mockOutput({ stage: true })
        skipFrame("stage", makeFrame(10))
        now += 2001
        expect(getRate(captureOpts)).toBe(3)
    })

    it("returns to full rate as soon as a change is detected", () => {
        const captureOpts = mockOutput({ stage: true })
        skipFrame("stage", makeFrame(10))
        now += 2001
        expect(getRate(captureOpts)).toBe(3)

        skipFrame("stage", makeFrame(99))
        expect(getRate(captureOpts)).toBe(20)
    })

    it("never throttles Blackmagic captures (they bypass change detection)", () => {
        const captureOpts = mockOutput({ blackmagic: true, ndi: true })
        now += 10_000
        expect(getRate(captureOpts)).toBe(30)
    })

    it("stops the capture loop when every channel is toggled off", () => {
        const window = { isDestroyed: () => false, webContents: { isDestroyed: () => false } }
        const active = { options: { stage: true }, window }
        const disabled = { options: { stage: false, ndi: false }, window }
        ;(CaptureLifecycle as any).captureLoopToken[CAPTURE_ID] = 7

        expect((CaptureLifecycle as any).shouldContinueCapture(CAPTURE_ID, 7, active)).toBe(true)
        expect((CaptureLifecycle as any).shouldContinueCapture(CAPTURE_ID, 7, disabled)).toBe(false)
        delete (CaptureLifecycle as any).captureLoopToken[CAPTURE_ID]
    })
})
