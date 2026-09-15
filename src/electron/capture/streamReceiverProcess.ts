// Runs in an Electron utilityProcess: owns every NDI/OMT/Blackmagic receive loop, the frame packing
// and the preview downscale, and hands frames straight to the renderers that draw them.
//
// Video must never touch the main thread. Receiving in the main process cost it ~15ms of event-loop
// lag per 4K source (the IPC write alone is ~17ms per 8MB frame), which is what made the UI crawl
// while a stream was live. From here the main process only brokers ports and control messages: it
// never sees a frame, and its lag stays around 1ms no matter how many 4K sources are running.

import { ensureOmtCodecSearchPath } from "../omt/omtModule"
import { getMacadam } from "../blackmagic/macadamLoader"
import { InputImageBufferConverter } from "../blackmagic/ImageBufferConverter"
import util from "../ndi/vingester-util"
import { packStreamFrame, previewStreamFrame, type StreamFrame, type StreamFrameFormat } from "./streamFrames"

const parentPort: any = (process as any).parentPort

// ----- frame transport -----
//
// Frames go to the windows through FrameServer (shared-memory ring + loopback socket; see
// FrameServer.ts). Main is never in the path: it only tells a window the port and the token.
import { FrameServer } from "./FrameServer"

// Frame buffers are pooled and reference counted: the OMT receiver decodes straight into a pooled
// buffer (receive(..., into)), each window that still needs the frame (waiting, or being copied into
// shared memory on the thread pool) holds a reference, and the buffer goes back to the pool when the
// last one lets go. No frame is copied on this thread; a fresh 16MB buffer per frame cost more in page
// faults than the copy itself.
const pooled = new Map<Buffer, number>()
const freeBuffers: Buffer[] = []
function acquireBuffer(bytes: number): Buffer {
    const i = freeBuffers.findIndex((b) => b.length >= bytes)
    const buf = i >= 0 ? freeBuffers.splice(i, 1)[0] : Buffer.allocUnsafeSlow(bytes)
    pooled.set(buf, 1)
    return buf
}
function poolBufferOf(data: Buffer): Buffer | null {
    for (const b of pooled.keys()) if (b.buffer === data.buffer) return b
    return null
}
function holdFrame(frame: { data: Buffer }) {
    const b = poolBufferOf(frame.data)
    if (b) pooled.set(b, (pooled.get(b) || 0) + 1)
}
function releaseFrame(frame: { data: Buffer }) {
    const b = poolBufferOf(frame.data)
    if (!b) return
    const n = (pooled.get(b) || 1) - 1
    if (n > 0) {
        pooled.set(b, n)
        return
    }
    pooled.delete(b)
    freeBuffers.push(b)
}

const PREVIEW_MAX_WIDTH = 480
// prefix of the targets that are the capture worker rather than a window
const WORKER_TARGET = "worker:"
// outputs whose capture worker wants the stream (to composite it into that output's capture), and those
// where it is actually compositing — only then does the window stop being sent the frame
const workerTargets = new Set<string>()
const workerOnly = new Set<string>()

const APP_TARGET = "app"

function toMain(message: any) {
    parentPort?.postMessage(message)
}

function log(text: string) {
    toMain({ type: "log", text })
}

const frames = new FrameServer({
    log,
    onListening: (info) => toMain({ type: "wsInfo", port: info.port, token: info.token }),
    // a window is only asked for when there is actually a frame to deliver, so nothing is wired up for
    // outputs that never show a stream
    onNeedTarget: (targetId, preview) => toMain({ type: "needPort", targetId, preview }),
    retain: holdFrame,
    release: releaseFrame,
    stats: !!process.env.FS_CAP_STATS
})

// FS_CAP_STATS: where the receive loop spends its time, once a second
const loopStats = { frames: 0, empty: 0, recvMs: 0, sendMs: 0, previewMs: 0 }
if (process.env.FS_CAP_STATS) {
    setInterval(() => {
        if (!loopStats.frames && !loopStats.empty) return
        log(`[RX-LOOP] frames=${loopStats.frames} empty=${loopStats.empty} recv=${loopStats.recvMs.toFixed(0)}ms send=${loopStats.sendMs.toFixed(0)}ms (shm=${frames.shmMs.toFixed(0)}ms preview=${loopStats.previewMs.toFixed(0)}ms)`)
        loopStats.frames = loopStats.empty = loopStats.recvMs = loopStats.sendMs = loopStats.previewMs = 0
        frames.shmMs = 0
    }, 1000)
}

// Outputs render the stream itself and need every pixel; the app window only ever previews it (drawer
// card, output mirror) so it gets a small copy of every frame, which keeps the preview as smooth as
// the output without paying full frame size for it.
// returns whether the app window was actually given a preview of this frame: a snapshot has to know,
// because the first frames arrive before the window has subscribed and are dropped here, and waiting a
// full refresh interval to try again leaves the tile on its loading spinner
function sendFrame(ipcChannel: string, id: string, outputIds: string[], packed: StreamFrame): boolean {
    const time = Date.now()

    outputIds.forEach((outputId) => {
        // The capture worker composites this frame into the output's captured page (see ndiWorker), so it
        // subscribes to the same stream as the window — and while it does, the window is not sent the
        // frame at all: drawing it there is the cost the composite exists to avoid.
        if (workerTargets.has(outputId)) frames.deliver(WORKER_TARGET + outputId, ipcChannel, id, packed, time, false)
        if (!workerOnly.has(outputId) || !frames.hasSubscriber(WORKER_TARGET + outputId)) frames.deliver(outputId, ipcChannel, id, packed, time, false)
    })
    // the receiver's own hold (acquireBuffer) ends here; windows that took the frame keep theirs
    releaseFrame(packed)

    if (!frames.hasSubscriber(APP_TARGET)) {
        frames.request(APP_TARGET, true)
        return false
    }
    const tPreview = performance.now()
    const preview = previewStreamFrame(packed, PREVIEW_MAX_WIDTH)
    loopStats.previewMs += performance.now() - tPreview
    frames.deliver(APP_TARGET, ipcChannel, id, preview, time, true)
    return true
}

type ReceiverState = {
    shouldStop?: boolean
    source: any
    lowbandwidth?: boolean
    wake?: (() => void) | null
}

// ----- NDI -----

let grandioseModule: any = null
let grandioseWarned = false
async function loadGrandiose() {
    if (grandioseModule) return grandioseModule
    try {
        grandioseModule = await import("grandiose")
        return grandioseModule
    } catch (err: any) {
        if (!grandioseWarned) log("NDI not available: " + err.message)
        grandioseWarned = true
        return null
    }
}

class Ndi {
    static receivers: { [id: string]: ReceiverState } = {}
    static active: { [id: string]: any } = {}
    static outputs: string[] = []
    // see the OMT class: a frame only reaches outputs actually showing that source
    static outputSource: { [outputId: string]: string } = {}
    static fourCCUyvy: number | null = null
    private static findInterval: NodeJS.Timeout | null = null

    static async createReceiver(source: { name: string; urlAddress: string }, lowbandwidth = false) {
        try {
            const grandiose = await loadGrandiose()
            if (!grandiose) return null

            // UYVY is half the bytes of RGBA and every one of them costs time in the copy to the
            // renderer; the renderer converts it on the GPU. Sources with alpha still arrive as RGBA.
            this.fourCCUyvy = grandiose.FOURCC_UYVY
            const config: any = {
                source,
                // colorFormat: grandiose.COLOR_FORMAT_UYVY_RGBA, // gives the wrong color format
                colorFormat: grandiose.COLOR_FORMAT_RGBX_RGBA,
                allowVideoFields: false
            }
            if (lowbandwidth) config.bandwidth = grandiose.BANDWIDTH_LOWEST

            let timeout: NodeJS.Timeout | null = null
            try {
                return await Promise.race([
                    grandiose.receive(config),
                    new Promise((_, reject) => {
                        timeout = setTimeout(() => reject(new Error("NDI receiver timeout")), 10000)
                    })
                ])
            } catch (err: any) {
                log("Failed to create NDI receiver: " + err.message)
                return null
            } finally {
                if (timeout) clearTimeout(timeout)
            }
        } catch (err: any) {
            log("Failed to create NDI receiver: " + err.message)
            return null
        }
    }

    static async findStreams(data: { groups?: string }) {
        if (this.findInterval) clearInterval(this.findInterval)

        const grandiose = await loadGrandiose()
        if (!grandiose) return []

        const finder: any = await grandiose.find({
            showLocalSources: true,
            groups: data.groups || ""
        })
        return new Promise<any[]>((resolve) => {
            // without the interval it only finds one source: https://github.com/emanspeaks/grandiose/commit/271cd73b5269ab827155a1a944c15d3b5fe4d564
            let previousLength = 0
            this.findInterval = setInterval(() => {
                const sources = finder.sources()
                if (previousLength === sources.length) {
                    clearInterval(this.findInterval!)
                    resolve(sources)
                }
                previousLength = sources.length
            }, 1000)
        })
    }

    static handleError(err: any, consecutiveErrors: number) {
        const msg = err.message || ""
        if (msg.includes("Non-video data received"))
            return {
                shouldContinue: true,
                delay: 0,
                newErrorCount: Math.max(0, consecutiveErrors - 1)
            }
        if (msg.includes("No video data received"))
            return {
                shouldContinue: true,
                delay: 1,
                newErrorCount: consecutiveErrors
            }

        const newCount = consecutiveErrors + 1
        return {
            shouldContinue: newCount < 10,
            delay: Math.min(5 * Math.pow(1.5, newCount), 100),
            newErrorCount: newCount
        }
    }

    // see the OMT loop: drawer and editor tiles are periodic snapshots, not live streams
    static readonly THUMBNAIL_REFRESH_MS = 30000

    // a sleep a refresh request can cut short (see the OMT loop's pause)
    static sleep(state: ReceiverState, ms: number) {
        return new Promise<void>((resolve) => {
            const timer = setTimeout(finish, ms)
            function finish() {
                clearTimeout(timer)
                state.wake = null
                resolve()
            }
            state.wake = finish
        })
    }

    static async frameLoop(sourceId: string, thumbnail: boolean) {
        let consecutiveErrors = 0

        while (this.receivers[sourceId] && !this.receivers[sourceId].shouldStop) {
            const state = this.receivers[sourceId]
            try {
                let receiver = this.active[sourceId]
                if (!receiver) {
                    const source = state.source
                    receiver = this.active[sourceId] = await this.createReceiver({ name: source.name, urlAddress: source.urlAddress || source.id }, state.lowbandwidth)
                }
                if (!receiver?.video) {
                    delete this.active[sourceId]
                    throw new Error("No video data received")
                }

                // a fresh receiver needs longer for its first frame than a running one does for its next
                const rawFrame = await receiver.video(thumbnail ? 1000 : 50)
                if (rawFrame) {
                    this.sendBuffer(sourceId, rawFrame)
                    consecutiveErrors = 0

                    // video() already blocks until the next frame, so pace on the source: waiting
                    // after every frame pushes the next fetch past the frame after it. A tile is a
                    // snapshot, so it drops the receiver and holds nothing open between refreshes — but
                    // only once it has a picture: dropping it before that restarts the connection every
                    // attempt and the tile sits on its loading spinner.
                    if (thumbnail) {
                        delete this.active[sourceId]
                        await Ndi.sleep(state, Ndi.THUMBNAIL_REFRESH_MS)
                    } else await new Promise((resolve) => setImmediate(resolve))
                    continue
                }
            } catch (err: any) {
                const { shouldContinue, delay, newErrorCount } = this.handleError(err, consecutiveErrors)
                consecutiveErrors = newErrorCount

                if (!shouldContinue) {
                    log("NDI source " + sourceId + ": too many errors, stopping")
                    this.stop({ id: sourceId })
                    return
                }

                await new Promise((resolve) => setTimeout(resolve, delay))
            }
        }
    }

    static sendBuffer(id: string, frame: any): boolean {
        if (!frame?.data) return false

        let format: StreamFrameFormat = "rgba"
        if (frame.fourCC === this.fourCCUyvy) format = "uyvy"
        else if (frame.fourCC === grandioseModule?.FOURCC_BGRA || frame.fourCC === grandioseModule?.FOURCC_BGRX) format = "bgra"

        const packed = packStreamFrame(frame.data, frame.xres, frame.yres, frame.lineStrideBytes || 0, format)
        if (!packed) return false

        return sendFrame("NDI", id, this.outputs.filter((outputId) => this.outputSource[outputId] === id), packed)
    }

    static async thumbnail({ source }: { source: any }) {
        if (this.receivers[source.id]) return
        this.receivers[source.id] = {
            shouldStop: false,
            source,
            lowbandwidth: true
        }
        this.frameLoop(source.id, true).catch((err) => log("NDI thumbnail error for " + source.id + ": " + err.message))
    }

    // refresh now rather than waiting out the snapshot interval (the tile's refresh button)
    static refresh({ source }: { source: any }) {
        const state = this.receivers[source.id]
        if (state?.lowbandwidth && !state.shouldStop) state.wake?.()
        else if (!state) void this.thumbnail({ source })
    }

    static async capture({ source, outputId }: { source: any; outputId: string }) {
        if (!this.outputs.includes(outputId)) this.outputs.push(outputId)
        this.outputSource[outputId] = source.id

        // if a thumbnail loop is running, upgrade it to full capture
        if (this.receivers[source.id]) {
            this.receivers[source.id].shouldStop = true
            await new Promise((resolve) => setTimeout(resolve, 100))
        }
        delete this.active[source.id]

        this.receivers[source.id] = {
            shouldStop: false,
            source,
            lowbandwidth: false
        }
        this.frameLoop(source.id, false).catch((err) => {
            log("NDI reception error for " + source.id + ": " + err.message)
            this.stop({ id: source.id })
        })
    }

    static stop(data: { id: string; outputId?: string } | null = null) {
        if (data?.id) {
            if (data.outputId) {
                const index = this.outputs.indexOf(data.outputId)
                if (index >= 0) this.outputs.splice(index, 1)
                delete this.outputSource[data.outputId]
            } else {
                this.outputs = []
                this.outputSource = {}
            }

            if (!this.outputs.length && this.receivers[data.id]) {
                this.receivers[data.id].shouldStop = true
                setTimeout(() => {
                    delete this.active[data.id]
                    delete this.receivers[data.id]
                }, 100)
            }
            return
        }

        Object.keys(this.receivers).forEach((id) => (this.receivers[id].shouldStop = true))
        setTimeout(() => {
            this.active = {}
            this.receivers = {}
        }, 100)
    }
}

// ----- OMT -----

let omtModule: any = null
let omtWarned = false
async function loadOmt() {
    if (omtModule) return omtModule
    try {
        // the codec DLL lives beside the addon; this process has its own environment, so the search
        // path set here is the one its loader actually uses
        ensureOmtCodecSearchPath()
        omtModule = await import("openmediatransport")
        return omtModule
    } catch (err: any) {
        if (!omtWarned) log("OMT not available: " + err.message)
        omtWarned = true
        return null
    }
}

type OmtLoop = {
    source: any
    lowbandwidth: boolean
    snapshot: boolean
    gotFirst: boolean
    frameBytes: number
    stopped: boolean
    receiver: any
    done: Promise<void>
    wake: (() => void) | null
}

class Omt {
    private static outputRefs: { [outputId: string]: number } = {}
    static codecs: any = null
    private static loops: { [sourceId: string]: OmtLoop } = {}

    private static get outputs() {
        return Object.keys(this.outputRefs)
    }

    // Which source each output is currently showing. A frame must never reach an output that is not
    // showing it: the capture worker composites whatever it is handed, so a thumbnail refresh for a
    // different source used to flash that source's picture into a live output.
    private static outputSource: { [outputId: string]: string } = {}

    private static outputsFor(sourceId: string) {
        return this.outputs.filter((outputId) => this.outputSource[outputId] === sourceId)
    }

    private static readonly RECEIVE_TIMEOUT_MS = 50
    // How long to wait before asking again when a receive came back EMPTY. It is not a frame-rate ceiling
    // (it was named as one): receive() blocks until the source's next frame, so a source that is delivering
    // paces the loop itself and this is never waited.
    private static readonly IDLE_POLL_MS = 16
    // Drawer and editor tiles are snapshots, not live streams: take one frame, drop the connection, and
    // come back later. Holding a receiver open made the sender count the tile as a viewer, which on
    // FreeShow's own output lifted its idle gate and drove the encoder at full rate for a thumbnail.
    // The interval itself is Ndi.THUMBNAIL_REFRESH_MS, so the two protocols cannot drift apart.
    private static readonly SNAPSHOT_RECEIVE_TIMEOUT_MS = 1000 // a fresh receiver needs longer for its first frame
    private static readonly SNAPSHOT_RETRY_MS = 1000 // nothing arrived: come back sooner than a full refresh

    static async createReceiver(address: string, lowbandwidth = false) {
        try {
            const omt = await loadOmt()
            if (!omt) return null
            this.codecs = omt.Codec

            const flags = lowbandwidth ? omt.ReceiveFlags.Preview : omt.ReceiveFlags.None
            return new omt.Receiver(address, omt.FrameType.Video, omt.PreferredVideoFormat.UYVYorBGRA, flags)
        } catch (err: any) {
            log("Failed to create OMT receiver: " + err.message)
            return null
        }
    }

    static async findStreams() {
        const omt = await loadOmt()
        if (!omt) return []

        let addresses: string[] = []
        for (let attempt = 0; attempt < 4; attempt++) {
            addresses = omt.getAddresses() || []
            if (addresses.length) break
            await new Promise((resolve) => setTimeout(resolve, 400))
        }

        return addresses.map((address) => ({ name: address, urlAddress: address }))
    }

    static async thumbnail({ source }: { source: any }) {
        const existing = this.loops[source.id]
        if (existing) {
            if (!existing.stopped) return
            await this.stopLoop(existing)
        }
        this.startLoop(source, true, Ndi.THUMBNAIL_REFRESH_MS)
    }

    // refresh now rather than waiting out the snapshot interval (the tile's refresh button)
    static refresh({ source }: { source: any }) {
        const loop = this.loops[source.id]
        if (loop?.snapshot && !loop.stopped) loop.wake?.()
        else if (!loop) void this.thumbnail({ source })
    }

    static async capture({ source, outputId }: { source: any; outputId: string }) {
        this.outputRefs[outputId] = (this.outputRefs[outputId] || 0) + 1
        this.outputSource[outputId] = source.id

        const existing = this.loops[source.id]
        if (existing) {
            if (!existing.lowbandwidth && !existing.stopped) return
            await this.stopLoop(existing)
        }

        this.startLoop(source, false, this.IDLE_POLL_MS)
    }

    private static startLoop(source: any, lowbandwidth: boolean, delayMs: number) {
        // low bandwidth and snapshot go together: only tiles ask for either
        const loop: OmtLoop = { source, lowbandwidth, snapshot: lowbandwidth, gotFirst: false, frameBytes: 0, stopped: false, receiver: null, done: Promise.resolve(), wake: null }
        this.loops[source.id] = loop
        loop.done = this.frameLoop(source.id, loop, delayMs).catch((err) => log("OMT reception error for " + source.id + ": " + err.message))
    }

    private static stopLoop(loop: OmtLoop) {
        loop.stopped = true
        loop.wake?.()
        return loop.done
    }

    private static pause(loop: OmtLoop, ms: number) {
        return new Promise<void>((resolve) => {
            const timer = setTimeout(finish, ms)
            function finish() {
                clearTimeout(timer)
                loop.wake = null
                resolve()
            }
            loop.wake = finish
        })
    }

    private static async frameLoop(sourceId: string, loop: OmtLoop, delayMs: number) {
        let consecutiveErrors = 0

        try {
            while (!loop.stopped && this.loops[sourceId] === loop) {
                try {
                    if (!loop.receiver) {
                        loop.receiver = await this.createReceiver(loop.source.urlAddress || loop.source.id, loop.lowbandwidth)
                        if (!loop.receiver) throw new Error("Could not create receiver")
                        if (loop.stopped) break
                    }

                    // decode into a pooled buffer sized from the last frame (a bigger frame arrives in
                    // its own buffer, which sizes the next one); sendBuffer takes over the hold
                    const into = loop.lowbandwidth || !loop.frameBytes ? null : acquireBuffer(loop.frameBytes)
                    const tRecv = performance.now()
                    let frame: any = null
                    try {
                        const timeoutMs = loop.snapshot ? this.SNAPSHOT_RECEIVE_TIMEOUT_MS : this.RECEIVE_TIMEOUT_MS
                        frame = await loop.receiver.receive(timeoutMs, 2 /* Video */, into || undefined)
                    } finally {
                        if (into && !(frame?.data && frame.data.buffer === into.buffer)) releaseFrame({ data: into } as StreamFrame)
                    }
                    const tGot = performance.now()
                    loopStats.recvMs += tGot - tRecv
                    if (loop.stopped) break
                    let delivered = false
                    if (frame?.data) {
                        loopStats.frames++
                        loop.frameBytes = Math.max(loop.frameBytes, frame.data.length)
                        delivered = this.sendBuffer(sourceId, frame)
                        loopStats.sendMs += performance.now() - tGot
                        consecutiveErrors = 0
                    } else loopStats.empty++

                    // receive() already blocks until the next frame, so pace on the source rather than a timer.
                    // Idle (no frame) still backs off. A snapshot holds nothing open between refreshes.
                    if (loop.snapshot) {
                        // Until there is a picture at all, keep the receiver and keep asking: a source needs
                        // a moment to connect, and tearing the receiver down after every attempt restarts
                        // that negotiation, so a tile could sit on its loading spinner for a long time.
                        if (!delivered && !loop.gotFirst) continue
                        loop.gotFirst = loop.gotFirst || delivered
                        this.destroyInstance(loop)
                        await this.pause(loop, delivered ? delayMs : this.SNAPSHOT_RETRY_MS)
                    } else if (frame?.data) await new Promise((resolve) => setImmediate(resolve))
                    else await this.pause(loop, delayMs)
                } catch (err: any) {
                    consecutiveErrors++
                    this.destroyInstance(loop)

                    if (consecutiveErrors >= 10) {
                        log("OMT source " + sourceId + ": too many errors, stopping")
                        loop.stopped = true
                        break
                    }

                    await this.pause(loop, Math.min(5 * Math.pow(1.5, consecutiveErrors), 100))
                }
            }
        } finally {
            this.destroyInstance(loop)
            if (this.loops[sourceId] === loop) delete this.loops[sourceId]
        }
    }

    private static destroyInstance(loop: OmtLoop) {
        const receiver = loop.receiver
        loop.receiver = null
        if (!receiver) return
        try {
            receiver.destroy()
        } catch (err: any) {
            log("Error destroying OMT receiver: " + err.message)
        }
    }

    static sendBuffer(id: string, frame: any) {
        if (!frame?.data) return false

        const format: StreamFrameFormat = frame.codec === this.codecs?.UYVY ? "uyvy" : "bgra"
        const packed = packStreamFrame(frame.data, frame.width, frame.height, frame.stride || 0, format)
        if (!packed) return false

        return sendFrame("OMT", id, this.outputsFor(id), packed)
    }

    static stop(data: { id: string; outputId?: string } | null = null): Promise<void> {
        if (data?.id) {
            if (data.outputId) {
                const refs = (this.outputRefs[data.outputId] || 0) - 1
                if (refs > 0) this.outputRefs[data.outputId] = refs
                else {
                    delete this.outputRefs[data.outputId]
                    delete this.outputSource[data.outputId]
                }
            } else {
                this.outputRefs = {}
                this.outputSource = {}
            }

            const loop = this.loops[data.id]
            if (!this.outputs.length && loop) return this.stopLoop(loop)
            return Promise.resolve()
        }

        return Promise.all(Object.values(this.loops).map((loop) => this.stopLoop(loop))).then(() => undefined)
    }
}

// ----- Blackmagic (DeckLink) input -----
//
// Main resolves the device (index, display mode and pixel format values) from its device list and sends
// them here; the capture channel, the frame loop and the format handling all live in this process. 8-bit
// YUV frames are UYVY and go to the windows as they are (the renderer converts on the GPU); the RGB
// variants are swizzled to RGBA in place, as before.

type BmdCaptureSpec = { deviceId: string; deviceIndex: number; displayMode: number; pixelFormat: number; pixelFormatName: string; audioChannels?: number }
type BmdReceiver = { spec: BmdCaptureSpec; channel: any; running: boolean; stopped: boolean; loop: Promise<void> | null }

class Bmd {
    static receivers: { [deviceId: string]: BmdReceiver } = {}
    static outputs: string[] = []
    // see the OMT class: a frame only reaches outputs actually showing that device
    static outputSource: { [outputId: string]: string } = {}

    private static async open(spec: BmdCaptureSpec): Promise<BmdReceiver | null> {
        const existing = this.receivers[spec.deviceId]
        if (existing) return existing

        const macadam = getMacadam()
        if (!macadam) {
            log("Blackmagic input unavailable: macadam module not loaded")
            return null
        }
        const channel = await macadam.capture({
            deviceIndex: spec.deviceIndex,
            displayMode: spec.displayMode,
            pixelFormat: spec.pixelFormat,
            channels: spec.audioChannels ?? 2,
            sampleRate: macadam.bmdAudioSampleRate48kHz,
            sampleType: macadam.bmdAudioSampleType16bitInteger
        })
        const receiver: BmdReceiver = { spec, channel, running: false, stopped: false, loop: null }
        this.receivers[spec.deviceId] = receiver
        return receiver
    }

    private static pack(receiver: BmdReceiver, frame: any): StreamFrame | null {
        const data: Buffer = frame?.video?.data
        if (!data) return null
        const width = receiver.channel.width
        const height = receiver.channel.height
        const name = receiver.spec.pixelFormatName || ""
        const stride = frame.video.rowBytes || 0

        let format: StreamFrameFormat = "rgba"
        let pixels = data
        if (name.includes("YUV")) {
            if (name.includes("10") || name.includes("12")) {
                pixels = InputImageBufferConverter.YUVtoRGBA(data, { width, height })
                return packStreamFrame(pixels, width, height, 0, "rgba")
            }
            format = "uyvy"
        } else if (name.includes("ARGB")) {
            util.ImageBufferAdjustment.ARGBtoRGBA(pixels)
        } else if (name.includes("BGRA")) {
            format = "bgra"
        } else if (name.includes("RGBXLE")) {
            InputImageBufferConverter.RGBXLEtoRGBA(pixels)
        } else if (name.includes("RGBLE")) {
            pixels = InputImageBufferConverter.RGBLEtoRGBA(pixels)
            return packStreamFrame(pixels, width, height, 0, "rgba")
        } else if (name.includes("RGBX")) {
            InputImageBufferConverter.RGBXtoRGBA(pixels)
        } else if (name.includes("RGB")) {
            pixels = InputImageBufferConverter.RGBtoRGBA(pixels)
            return packStreamFrame(pixels, width, height, 0, "rgba")
        }
        return packStreamFrame(pixels, width, height, stride, format)
    }

    // one frame for the drawer card; the channel stays open so the next request is instant (as before)
    static async thumbnail(spec: BmdCaptureSpec) {
        const receiver = await this.open(spec)
        if (!receiver || receiver.running) return
        try {
            const packed = this.pack(receiver, await receiver.channel.frame())
            if (packed) sendFrame("BLACKMAGIC", spec.deviceId, [], packed)
        } catch (err: any) {
            log("Blackmagic frame error for " + spec.deviceId + ": " + err.message)
            this.stop({ id: spec.deviceId })
        }
    }

    static async capture(data: BmdCaptureSpec & { outputId: string }) {
        if (!this.outputs.includes(data.outputId)) this.outputs.push(data.outputId)
        this.outputSource[data.outputId] = data.deviceId
        const receiver = await this.open(data)
        if (!receiver || receiver.running) return
        receiver.running = true
        receiver.loop = this.frameLoop(receiver).catch((err) => log("Blackmagic reception error for " + data.deviceId + ": " + err.message))
    }

    // the card paces this: frame() resolves when the next frame has arrived
    private static async frameLoop(receiver: BmdReceiver) {
        while (!receiver.stopped && this.receivers[receiver.spec.deviceId] === receiver) {
            const frame = await receiver.channel.frame()
            if (receiver.stopped) break
            const packed = this.pack(receiver, frame)
            if (packed) sendFrame("BLACKMAGIC", receiver.spec.deviceId, this.outputs.filter((o) => this.outputSource[o] === receiver.spec.deviceId), packed)
        }
    }

    static stop(data: { id: string; outputId?: string } | null = null) {
        if (data?.id) {
            if (data.outputId) {
                const index = this.outputs.indexOf(data.outputId)
                if (index >= 0) this.outputs.splice(index, 1)
            } else this.outputs = []

            if (!this.outputs.length) this.close(data.id)
            return
        }
        for (const id of Object.keys(this.receivers)) this.close(id)
        this.outputs = []
    }

    private static close(deviceId: string) {
        const receiver = this.receivers[deviceId]
        if (!receiver) return
        receiver.stopped = true
        delete this.receivers[deviceId]
        try {
            receiver.channel.stop()
        } catch (err: any) {
            log("Error stopping Blackmagic receiver: " + err.message)
        }
    }
}

// ----- control channel -----

const HANDLERS: { [type: string]: (data: any) => any } = {
    "ndi:find": (data) => Ndi.findStreams(data || {}),
    "ndi:thumbnail": (data) => Ndi.thumbnail(data),
    "ndi:refresh": (data) => Ndi.refresh(data),
    "ndi:capture": (data) => Ndi.capture(data),
    "ndi:stop": (data) => Ndi.stop(data),
    "omt:find": () => Omt.findStreams(),
    "omt:thumbnail": (data) => Omt.thumbnail(data),
    "omt:refresh": (data) => Omt.refresh(data),
    "omt:capture": (data) => Omt.capture(data),
    "omt:stop": (data) => Omt.stop(data),
    videoLayer: (data: { outputId: string; active: boolean; exclusive?: boolean }) => {
        if (data.active) workerTargets.add(data.outputId)
        else {
            workerTargets.delete(data.outputId)
            workerOnly.delete(data.outputId)
            frames.drop(WORKER_TARGET + data.outputId)
            return
        }
        if (data.exclusive) workerOnly.add(data.outputId)
        else workerOnly.delete(data.outputId)
    },
    "bmd:thumbnail": (data) => Bmd.thumbnail(data),
    "bmd:capture": (data) => Bmd.capture(data),
    "bmd:stop": (data) => Bmd.stop(data)
}

parentPort.on("message", async (e: any) => {
    const message = e.data
    if (!message) return

    if (message.type === "dropPort") {
        frames.drop(message.targetId)
        return
    }

    const handler = HANDLERS[message.type]
    if (!handler) return

    try {
        const value = await handler(message.data)
        if (message.requestId) toMain({ type: "result", requestId: message.requestId, value })
    } catch (err: any) {
        if (message.requestId)
            toMain({
                type: "result",
                requestId: message.requestId,
                value: null,
                error: err.message
            })
        else log(message.type + " failed: " + err.message)
    }
})
