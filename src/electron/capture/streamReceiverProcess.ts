// Electron utilityProcess running the NDI/OMT/Blackmagic receive loops and serving their frames to windows.

import { ensureOmtCodecSearchPath } from "../omt/omtModule"
import { getMacadam } from "../blackmagic/macadamLoader"
import { InputImageBufferConverter } from "../blackmagic/ImageBufferConverter"
import util from "../ndi/vingester-util"
import { packStreamFrame, previewStreamFrame, type StreamFrame, type StreamFrameFormat } from "./streamFrames"

const parentPort: any = (process as any).parentPort

import { FrameServer } from "./FrameServer"

// pooled, refcounted frame buffers: OMT decodes into one, and each window still holding the frame keeps a reference
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
// a drawer tile is drawn at this interval from a receiver kept open while the tile is shown
const TILE_INTERVAL_MS = 200

// tiles showing each source, counted
class TileRefs {
    private refs: { [sourceId: string]: number } = {}
    add(id: string) {
        this.refs[id] = (this.refs[id] || 0) + 1
    }
    /** true when no tile shows the source any more */
    remove(id: string): boolean {
        if (!this.refs[id]) return true
        if (--this.refs[id] > 0) return false
        delete this.refs[id]
        return true
    }
    has(id: string) {
        return !!this.refs[id]
    }
}
const WORKER_TARGET = "worker:"
// output -> source the worker composites; workerOnly: the page is not sent that source's frames
const workerTargets = new Map<string, string>()
const workerOnly = new Set<string>()

// sources shown per output, refcounted (two during a crossfade)
class OutputSources {
    private refs: { [outputId: string]: { [sourceId: string]: number } } = {}

    get outputs() {
        return Object.keys(this.refs)
    }

    add(outputId: string, sourceId: string) {
        const sources = (this.refs[outputId] ||= {})
        sources[sourceId] = (sources[sourceId] || 0) + 1
    }

    remove(outputId: string, sourceId: string) {
        const sources = this.refs[outputId]
        if (!sources?.[sourceId]) return
        if (--sources[sourceId] > 0) return
        delete sources[sourceId]
        if (!Object.keys(sources).length) delete this.refs[outputId]
    }

    clear() {
        this.refs = {}
    }

    outputsFor(sourceId: string) {
        return Object.keys(this.refs).filter((outputId) => this.refs[outputId][sourceId])
    }
}

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

// outputs get the full frame, the app window a PREVIEW_MAX_WIDTH copy; returns whether the app window got it
function sendFrame(ipcChannel: string, id: string, outputIds: string[], packed: StreamFrame): boolean {
    const time = Date.now()

    outputIds.forEach((outputId) => {
        // while the worker composites this source, the window is not sent the frame
        const composited = workerTargets.get(outputId) === id
        if (composited) frames.deliver(WORKER_TARGET + outputId, ipcChannel, id, packed, time, false)
        if (!composited || !workerOnly.has(outputId) || !frames.hasSubscriber(WORKER_TARGET + outputId)) frames.deliver(outputId, ipcChannel, id, packed, time, false)
    })
    // ends the receiver's acquireBuffer hold
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

// ----- NDI -----

let grandioseModule: any = null
let grandioseWarned = false
async function loadGrandiose() {
    if (grandioseModule) return grandioseModule
    try {
        const m = await import("grandiose")
        grandioseModule = m.default || m
        return grandioseModule
    } catch (err: any) {
        if (!grandioseWarned) log("NDI not available: " + err.message)
        grandioseWarned = true
        return null
    }
}

type NdiLoop = {
    source: any
    lowbandwidth: boolean
    stopped: boolean
    receiver: any
    done: Promise<void>
    wake: (() => void) | null
}

class Ndi {
    private static sources = new OutputSources()
    private static loops: { [sourceId: string]: NdiLoop } = {}
    static fourCCUyvy: number | null = null
    private static findInterval: NodeJS.Timeout | null = null

    private static readonly RECEIVE_TIMEOUT_MS = 50
    private static readonly TILE_RECEIVE_TIMEOUT_MS = 1000 // a fresh receiver needs longer for its first frame
    private static tiles = new TileRefs()

    static async createReceiver(source: { name: string; urlAddress: string }, lowbandwidth = false) {
        try {
            const grandiose = await loadGrandiose()
            if (!grandiose) return null

            // UYVY is half the bytes of RGBA and every one of them costs time in the copy to the
            // renderer; the renderer converts it on the GPU. Sources with alpha still arrive as RGBA.
            this.fourCCUyvy = grandiose.FOURCC_UYVY
            const config: any = {
                source,
                colorFormat: grandiose.COLOR_FORMAT_UYVY_RGBA,
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

    static async thumbnail({ source }: { source: any }) {
        this.tiles.add(source.id)
        const existing = this.loops[source.id]
        if (existing) {
            if (!existing.stopped) return
            await this.stopLoop(existing)
        }
        this.startLoop(source, true)
    }

    static tileStop({ id }: { id: string }) {
        if (!this.tiles.remove(id)) return
        const loop = this.loops[id]
        if (loop?.lowbandwidth) void this.stopLoop(loop)
    }

    static async capture({ source, outputId }: { source: any; outputId: string }) {
        this.sources.add(outputId, source.id)

        // upgrade a thumbnail loop to a full capture
        const existing = this.loops[source.id]
        if (existing) {
            if (!existing.lowbandwidth && !existing.stopped) return
            await this.stopLoop(existing)
        }

        this.startLoop(source, false)
    }

    private static startLoop(source: any, lowbandwidth: boolean) {
        const loop: NdiLoop = { source, lowbandwidth, stopped: false, receiver: null, done: Promise.resolve(), wake: null }
        this.loops[source.id] = loop
        loop.done = this.frameLoop(source.id, loop).catch((err) => log("NDI reception error for " + source.id + ": " + err.message))
    }

    private static stopLoop(loop: NdiLoop) {
        loop.stopped = true
        loop.wake?.()
        return loop.done
    }

    // a stop cuts the sleep short
    private static pause(loop: NdiLoop, ms: number) {
        if (ms === 0) {
            return new Promise<void>((resolve) => {
                setImmediate(resolve)
            })
        }
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

    private static async frameLoop(sourceId: string, loop: NdiLoop) {
        let consecutiveErrors = 0

        try {
            while (!loop.stopped && this.loops[sourceId] === loop) {
                try {
                    if (!loop.receiver) {
                        loop.receiver = await this.createReceiver({ name: loop.source.name, urlAddress: loop.source.urlAddress || loop.source.id }, loop.lowbandwidth)
                        if (!loop.receiver?.video) throw new Error("Could not create receiver")
                        if (loop.stopped) break
                    }

                    const rawFrame = await loop.receiver.video(loop.lowbandwidth ? this.TILE_RECEIVE_TIMEOUT_MS : this.RECEIVE_TIMEOUT_MS)
                    if (loop.stopped) break
                    if (rawFrame?.data) {
                        this.sendBuffer(sourceId, rawFrame)
                        consecutiveErrors = 0
                    }

                    if (loop.lowbandwidth && rawFrame?.data) await this.pause(loop, TILE_INTERVAL_MS)
                    else await this.pause(loop, 0)
                } catch (err: any) {
                    const { shouldContinue, delay, newErrorCount } = this.handleError(err, consecutiveErrors)
                    consecutiveErrors = newErrorCount

                    if (!shouldContinue) {
                        log("NDI source " + sourceId + ": too many errors, stopping")
                        loop.stopped = true
                        break
                    }

                    if (consecutiveErrors >= 5) {
                        this.destroyInstance(loop)
                    }

                    await this.pause(loop, delay)
                }
            }
        } finally {
            this.destroyInstance(loop)
            if (this.loops[sourceId] === loop) delete this.loops[sourceId]
        }
    }

    private static destroyInstance(loop: NdiLoop) {
        const receiver = loop.receiver
        loop.receiver = null
        if (!receiver) return
        try {
            receiver.destroy?.()
        } catch (err: any) {
            log("Error destroying NDI receiver: " + err.message)
        }
    }

    static sendBuffer(id: string, frame: any): boolean {
        if (!frame?.data) return false

        let format: StreamFrameFormat = "rgba"
        if (frame.fourCC === this.fourCCUyvy) format = "uyvy"
        else if (frame.fourCC === grandioseModule?.FOURCC_BGRA || frame.fourCC === grandioseModule?.FOURCC_BGRX) format = "bgra"

        const packed = packStreamFrame(frame.data, frame.xres, frame.yres, frame.lineStrideBytes || 0, format)
        if (!packed) return false

        return sendFrame("NDI", id, this.sources.outputsFor(id), packed)
    }

    static stop(data: { id: string; outputId?: string } | null = null): Promise<void> {
        if (data?.id) {
            if (data.outputId) this.sources.remove(data.outputId, data.id)
            else this.sources.clear()

            // a full receive no output shows any more stops, or goes back to serving its tiles
            const loop = this.loops[data.id]
            if (!loop || loop.lowbandwidth || this.sources.outputsFor(data.id).length) return Promise.resolve()
            return this.stopLoop(loop).then(() => {
                if (this.tiles.has(data.id) && !this.loops[data.id]) this.startLoop(loop.source, true)
            })
        }

        return Promise.all(Object.values(this.loops).map((loop) => this.stopLoop(loop))).then(() => undefined)
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
    frameBytes: number
    stopped: boolean
    receiver: any
    done: Promise<void>
    wake: (() => void) | null
}

class Omt {
    private static sources = new OutputSources()
    static codecs: any = null
    private static loops: { [sourceId: string]: OmtLoop } = {}

    private static readonly RECEIVE_TIMEOUT_MS = 50
    // wait after an empty receive only; a live source paces the loop through receive()
    private static readonly IDLE_POLL_MS = 16
    // tiles take one frame and drop the receiver: an open receiver counts as a viewer on the sender
    private static readonly TILE_RECEIVE_TIMEOUT_MS = 1000 // a fresh receiver needs longer for its first frame
    private static tiles = new TileRefs()

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
        this.tiles.add(source.id)
        const existing = this.loops[source.id]
        if (existing) {
            if (!existing.stopped) return
            await this.stopLoop(existing)
        }
        this.startLoop(source, true, TILE_INTERVAL_MS)
    }

    static tileStop({ id }: { id: string }) {
        if (!this.tiles.remove(id)) return
        const loop = this.loops[id]
        if (loop?.lowbandwidth) void this.stopLoop(loop)
    }

    static async capture({ source, outputId }: { source: any; outputId: string }) {
        this.sources.add(outputId, source.id)

        const existing = this.loops[source.id]
        if (existing) {
            if (!existing.lowbandwidth && !existing.stopped) return
            await this.stopLoop(existing)
        }

        this.startLoop(source, false, this.IDLE_POLL_MS)
    }

    private static startLoop(source: any, lowbandwidth: boolean, delayMs: number) {
        const loop: OmtLoop = { source, lowbandwidth, frameBytes: 0, stopped: false, receiver: null, done: Promise.resolve(), wake: null }
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

                    // pooled buffer sized from the largest frame so far; sendBuffer takes over the hold
                    const into = loop.lowbandwidth || !loop.frameBytes ? null : acquireBuffer(loop.frameBytes)
                    const tRecv = performance.now()
                    let frame: any = null
                    try {
                        const timeoutMs = loop.lowbandwidth ? this.TILE_RECEIVE_TIMEOUT_MS : this.RECEIVE_TIMEOUT_MS
                        frame = await loop.receiver.receive(timeoutMs, 2 /* Video */, into || undefined)
                    } finally {
                        if (into && !(frame?.data && frame.data.buffer === into.buffer)) releaseFrame({ data: into } as StreamFrame)
                    }
                    const tGot = performance.now()
                    loopStats.recvMs += tGot - tRecv
                    if (loop.stopped) break
                    if (frame?.data) {
                        loopStats.frames++
                        loop.frameBytes = Math.max(loop.frameBytes, frame.data.length)
                        this.sendBuffer(sourceId, frame)
                        loopStats.sendMs += performance.now() - tGot
                        consecutiveErrors = 0
                    } else loopStats.empty++

                    // receive() blocks until the next frame; only an empty receive waits
                    if (loop.lowbandwidth) {
                        if (frame?.data) await this.pause(loop, delayMs)
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

        return sendFrame("OMT", id, this.sources.outputsFor(id), packed)
    }

    static stop(data: { id: string; outputId?: string } | null = null): Promise<void> {
        if (data?.id) {
            if (data.outputId) this.sources.remove(data.outputId, data.id)
            else this.sources.clear()

            // a full receive no output shows any more stops, or goes back to serving its tiles
            const loop = this.loops[data.id]
            if (!loop || loop.lowbandwidth || this.sources.outputsFor(data.id).length) return Promise.resolve()
            return this.stopLoop(loop).then(() => {
                if (this.tiles.has(data.id) && !this.loops[data.id]) this.startLoop(loop.source, true, TILE_INTERVAL_MS)
            })
        }

        return Promise.all(Object.values(this.loops).map((loop) => this.stopLoop(loop))).then(() => undefined)
    }
}

// ----- Blackmagic (DeckLink) input -----

type BmdCaptureSpec = { deviceId: string; deviceIndex: number; displayMode: number; pixelFormat: number; pixelFormatName: string; audioChannels?: number }
type BmdReceiver = { spec: BmdCaptureSpec; channel: any; running: boolean; stopped: boolean; loop: Promise<void> | null; tileAt: number }

class Bmd {
    static receivers: { [deviceId: string]: BmdReceiver } = {}
    private static sources = new OutputSources()

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
        const receiver: BmdReceiver = { spec, channel, running: false, stopped: false, loop: null, tileAt: 0 }
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

    private static tiles = new TileRefs()

    static async thumbnail(spec: BmdCaptureSpec) {
        this.tiles.add(spec.deviceId)
        await this.run(spec)
    }

    static tileStop({ id }: { id: string }) {
        if (this.tiles.remove(id) && !this.sources.outputsFor(id).length) this.close(id)
    }

    static async capture(data: BmdCaptureSpec & { outputId: string }) {
        this.sources.add(data.outputId, data.deviceId)
        await this.run(data)
    }

    private static async run(spec: BmdCaptureSpec) {
        const receiver = await this.open(spec)
        if (!receiver || receiver.running) return
        receiver.running = true
        receiver.loop = this.frameLoop(receiver).catch((err) => log("Blackmagic reception error for " + spec.deviceId + ": " + err.message))
    }

    // Every frame is read: an unread frame keeps its card buffer. Frames only tiles show are drawn at the tile rate.
    private static async frameLoop(receiver: BmdReceiver) {
        const id = receiver.spec.deviceId
        while (!receiver.stopped && this.receivers[id] === receiver) {
            const frame = await receiver.channel.frame()
            if (receiver.stopped) break
            const outputs = this.sources.outputsFor(id)
            if (!outputs.length) {
                const now = Date.now()
                if (now - receiver.tileAt < TILE_INTERVAL_MS) continue
                receiver.tileAt = now
            }
            const packed = this.pack(receiver, frame)
            if (packed) sendFrame("BLACKMAGIC", id, outputs, packed)
        }
    }

    static stop(data: { id: string; outputId?: string } | null = null) {
        if (data?.id) {
            if (data.outputId) this.sources.remove(data.outputId, data.id)
            else this.sources.clear()

            if (!this.sources.outputsFor(data.id).length && !this.tiles.has(data.id)) this.close(data.id)
            return
        }
        for (const id of Object.keys(this.receivers)) this.close(id)
        this.sources.clear()
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
    "ndi:tileStop": (data) => Ndi.tileStop(data),
    "ndi:capture": (data) => Ndi.capture(data),
    "ndi:stop": (data) => Ndi.stop(data),
    "omt:find": () => Omt.findStreams(),
    "omt:thumbnail": (data) => Omt.thumbnail(data),
    "omt:tileStop": (data) => Omt.tileStop(data),
    "omt:capture": (data) => Omt.capture(data),
    "omt:stop": (data) => Omt.stop(data),
    videoLayer: (data: { outputId: string; active: boolean; source?: string; exclusive?: boolean }) => {
        if (data.active) workerTargets.set(data.outputId, data.source || "")
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
    "bmd:tileStop": (data) => Bmd.tileStop(data),
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
