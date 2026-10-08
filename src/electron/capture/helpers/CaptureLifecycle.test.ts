import { EventEmitter } from "events"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ output: undefined as any, release: vi.fn(), stopChannel: vi.fn(), stopRtmp: vi.fn() }))
vi.mock("../../audio/processAudio", () => ({ isAudioEnabled: () => false }))
vi.mock("../../blackmagic/BlackmagicSender", () => ({ BlackmagicSender: {} }))
vi.mock("../../output/OutputHelper", () => ({ OutputHelper: { getOutput: () => state.output, getAllOutputs: () => [state.output], Lifecycle: { releaseOsrCaptureTextures: state.release } } }))
vi.mock("../../streaming/encoderDetection", () => ({ getRtmpEncoderSetting: () => "x264" }))
vi.mock("../../streaming/RtmpStreamer", () => ({ RtmpStreamer: { isRunning: () => false, stop: state.stopRtmp } }))
vi.mock("../../streaming/WebRtcHost", () => ({ WebRtcHost: { isRunning: () => false, stop: vi.fn() } }))
vi.mock("../CaptureHelper", () => ({ CaptureHelper: { updateFramerate: vi.fn(), getDefaultCapture: (window: any) => ({ window, options: {}, framerates: {} }), Transmitter: { startTransmitting: vi.fn(), stopChannel: state.stopChannel } } }))
vi.mock("./CaptureTransmitter", () => ({ CaptureTransmitter: { getTimeSinceLastChange: () => 0 } }))
import { CaptureLifecycle } from "./CaptureLifecycle"

describe("capture stop/start on a retained output window", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        const window = new EventEmitter() as any
        window.isDestroyed = () => false
        window.webContents = new EventEmitter()
        window.webContents.isDestroyed = () => false
        state.output = { id: "test", osr: true, window, captureOptions: { window, options: {}, framerates: {} }, rtmpData: { streaming: false } }
    })

    it.each([false, true])("cancels pending RTMP detection when streaming is off or destinations are empty (%s)", (streaming) => {
        state.output.rtmpData = { streaming, destinations: [] }
        CaptureLifecycle.updateRtmpState()
        expect(state.stopRtmp).toHaveBeenCalledWith("test")
    })

    it("keeps paint and window lifecycle listeners through idle initialization and a later stop", () => {
        const paint = vi.fn()
        const closed = vi.fn()
        state.output.window.webContents.on("paint", paint)
        state.output.window.on("closed", closed)
        CaptureLifecycle.startCapture("test", { rtmp: false })
        CaptureLifecycle.startCapture("test", { rtmp: true })
        CaptureLifecycle.stopCapture("test")
        state.output.window.webContents.emit("paint")
        state.output.window.emit("closed")
        expect(paint).toHaveBeenCalledOnce()
        expect(closed).toHaveBeenCalledOnce()
        expect(state.release).not.toHaveBeenCalled()
        expect(state.stopChannel).toHaveBeenCalledWith("test", "rtmp")
        expect(state.output.captureOptions).toBeUndefined()
    })
})
