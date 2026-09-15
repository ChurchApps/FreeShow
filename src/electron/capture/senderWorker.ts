import { parentPort } from "worker_threads"
import { ruleViolation } from "../utils/ruleCheck"
import { RtmpStreamer } from "../streaming/RtmpStreamer"
import { BlackmagicSender } from "../blackmagic/BlackmagicSender"
import { FrameServer, type ServedFrame } from "./FrameServer"

// Protocol-independent engine for the network sender workers (../ndi/ndiWorker, ../omt/omtWorker), which
// run it with their own SenderAdapter.

if (!parentPort) throw new Error("A sender worker must be run as a worker_thread")
const port = parentPort

const BYTES_PER_FLOAT32 = 4
const CONNECTION_POLL_INTERVAL_MS = 250
const TIMECODE_DIVISOR = BigInt(100)

const timeStart = BigInt(Date.now()) * BigInt(1e6) - process.hrtime.bigint()

/** 100ns units since the Unix epoch */
export function frameTimestamp(): bigint {
    return (timeStart + process.hrtime.bigint()) / TIMECODE_DIVISOR
}

export type PacerBuf = { buf: Buffer; refs: number; owner: string }

export type Sender = {
    name: string
    /** the protocol this sender speaks; members of one render may speak different ones */
    adapter: SenderAdapter
    status?: string
    previousStatus?: string
    sender?: any
    // set at creation by the adapter
    sendFrame?: (frame: any) => Promise<void> | void
    sendAudio?: (frame: any) => Promise<void> | void
    tsKey?: string // frame field re-stamped at send time (NDI "timecode", OMT "timestamp")
    timer?: NodeJS.Timeout
    sendingVideo?: boolean
    pendingVideoFrame?: any
    sendingAudio?: boolean
    audioQueue?: any[]
    offMain?: boolean
    pendingReal?: boolean
    coalescedReal?: number
    sendMsSum?: number
    sentReal?: number
    sentRepeat?: number
    paceQueue?: { frame: any; pbuf: PacerBuf }[]
    lastPace?: { frame: any; pbuf: PacerBuf }
    paceTimer?: NodeJS.Timeout
    paceNextDue?: number
    paceInterval?: number
    paceCap?: number
    paceMisses?: number
    paceBusy?: number
    lastRealSendAt?: number
    realGaps?: number[]
    sendRejected?: number // sends the library accepted but did not put on the wire (OMT: encode failure)
    rejectLogged?: boolean
}

export type FrameSize = { width: number; height: number }

/** format: the osr-capture readback formats — 0 = BGRA, 1 = UYVY (opaque), 2 = UYVA (colour + alpha) */
export type VideoFrameOpts = { size: FrameSize; ratio: number; framerate: number; transparent: boolean; format: number }

export type SenderAdapter = {
    tag: string // telemetry/log id ("ndi" / "omt")
    label: string // display name ("NDI" / "OMT")
    /** the protocol's native module, or null when it is unavailable */
    load: () => Promise<any | null>
    /** extra detail for the "creating sender" log line */
    describe?: (msg: any) => string
    /** wait before replacing a live sender, so the old one's socket and discovery entry are gone first */
    recreateDelayMs?: number
    create: (lib: any, id: string, msg: any) => Promise<{ sender: any; sendFrame: (frame: any) => any; sendAudio: (frame: any) => any; tsKey: string } | null>
    connections: (sender: any) => number
    destroy: (sender: any) => void
    /** convert the readback to a format the protocol sends, reporting the format that comes out */
    prepareVideo: (lib: any, buffer: Buffer, size: FrameSize, format: number, transparent: boolean) => { data: Buffer; format: number }
    videoFrame: (lib: any, data: Buffer, opts: VideoFrameOpts) => any
    audioFrame: (lib: any, buffer: Buffer, sampleRate: number, channelCount: number) => any | null
}

const SENDERS: { [id: string]: Sender } = {}
const ADAPTERS: { [tag: string]: SenderAdapter } = {}
let DEFAULT_ADAPTER: SenderAdapter

let osrCaptureModule: any = null
export function loadOsrCapture(): any {
    if (osrCaptureModule !== null) return osrCaptureModule
    try {
        const m = require("osr-capture")
        osrCaptureModule = typeof m?.convertBgraToUyvy === "function" ? m : false
    } catch {
        osrCaptureModule = false
    }
    return osrCaptureModule
}

async function createSender(id: string, msg: any) {
    // replace an existing sender instead of skipping the create
    const adapter = ADAPTERS[msg.protocol] || DEFAULT_ADAPTER
    if (SENDERS[id]) {
        stopSender(id)
        if (adapter.recreateDelayMs) await new Promise((resolve) => setTimeout(resolve, adapter.recreateDelayMs))
    }

    const name: string = msg.name
    SENDERS[id] = { name, adapter }
    console.info(`${adapter.label} - creating sender: ` + name + (adapter.describe?.(msg) || ""))

    try {
        const lib = await adapter.load()
        const created = lib ? await adapter.create(lib, id, msg) : null
        if (!created) {
            delete SENDERS[id]
            port.postMessage({ type: "createFailed", id })
            return
        }

        // destroy arriving while the create was in progress: destroy instead of leaking
        if (!SENDERS[id]) {
            try {
                adapter.destroy(created.sender)
            } catch {}
            return
        }

        SENDERS[id].sender = created.sender
        SENDERS[id].sendFrame = created.sendFrame
        SENDERS[id].sendAudio = created.sendAudio
        SENDERS[id].tsKey = created.tsKey
    } catch (err) {
        console.error(`Could not create ${adapter.label} sender:`, err)
        delete SENDERS[id]
        port.postMessage({ type: "createFailed", id })
        return
    }

    SENDERS[id].timer = setInterval(() => {
        const s = SENDERS[id]
        if (!s?.sender) return
        const conns = s.adapter.connections(s.sender)
        s.status = conns > 0 ? "connected" : "unconnected"

        const newStatus = String(s.status) + conns.toString()
        if (newStatus !== s.previousStatus) {
            port.postMessage({ type: "status", id, status: s.status, connections: conns })
            s.previousStatus = newStatus
            if (s.status === "connected") console.log(`[${s.adapter.label}] Reconnected for ${id}`)
        }
    }, CONNECTION_POLL_INTERVAL_MS)
}

function stopSender(id: string) {
    // tear down even when the sender never got assigned: deleting the entry makes the race guard in
    // createSender fire if a create is still awaiting the library
    const s = SENDERS[id]
    if (!s) return
    console.info(`${s.adapter.label} - stopping sender: ` + (s.name || id))
    if (s.timer) clearInterval(s.timer)

    if (s.sender) {
        try {
            s.adapter.destroy(s.sender)
        } catch (err) {
            console.error("ERROR", err)
        }
    }

    // release every ref this sender holds (queue entries + the lastPace pin); an in-flight paceSend holds
    // its own and releases it in its finally, so nothing is recycled mid-send
    if (s.paceTimer) clearTimeout(s.paceTimer)
    for (const entry of s.paceQueue || []) releasePacerRef(entry.pbuf)
    s.paceQueue = []
    const pin = s.lastPace
    if (pin) {
        releasePacerRef(pin.pbuf)
        s.lastPace = undefined
    }
    delete pacerPools[id] // renderer's pacer free list (members never own one); unreturned bufs just GC
    delete SENDERS[id]
    releaseReadbackResources(id)
}

// free the reused readback buffers for an output; off-main keys are slotted, so release every slot
function releaseReadbackResources(id: string) {
    if (SENDERS[id]) return
    try {
        const osr = loadOsrCapture()
        osr?.releasePool?.(id)
        const allocated = readbackSlots[id]?.next ?? 0
        for (let s = 0; s < allocated; s++) osr?.releasePool?.(`${id}#${s}`)
    } catch {
        // ignore
    }
    delete readbackSlots[id]
}

// A send returning 0 with a receiver connected means the library dropped the frame (encoder refused it);
// with nobody connected 0 is the normal idle result.
function noteSendResult(senderData: Sender, id: string, frame: any, sent: unknown) {
    if (sent !== 0) return
    if (senderData.adapter.connections(senderData.sender) <= 0) return
    senderData.sendRejected = (senderData.sendRejected || 0) + 1
    if (senderData.rejectLogged) return
    senderData.rejectLogged = true
    console.error(`${senderData.adapter.label} sender ${id} rejected a video frame: ${frame.width || frame.xres}x${frame.height || frame.yres} stride=${frame.stride || frame.lineStrideBytes} bytes=${frame.data?.length}`)
}

async function sendQueuedVideoFrame(id: string) {
    const senderData = SENDERS[id]
    if (!senderData?.sender || senderData.sendingVideo) return

    const frame = senderData.pendingVideoFrame
    if (!frame) return

    // claim frame + meta before any await, so a concurrent enqueue can't desync them
    const wasReal = senderData.pendingReal === true
    senderData.pendingVideoFrame = undefined
    senderData.pendingReal = undefined
    senderData.sendingVideo = true

    const sendT0 = process.env.FS_CAP_STATS ? Date.now() : 0
    try {
        noteSendResult(senderData, id, frame, await senderData.sendFrame!(frame))
    } catch (err) {
        console.error("Error sending video frame:", err)
    } finally {
        if (sendT0) {
            senderData.sendMsSum = (senderData.sendMsSum || 0) + (Date.now() - sendT0)
            if (wasReal) senderData.sentReal = (senderData.sentReal || 0) + 1
            else senderData.sentRepeat = (senderData.sentRepeat || 0) + 1
        }
        senderData.sendingVideo = false
        // videoDone only drives the main-path in-flight counter; off-main uses captureDone
        if (!senderData.offMain) port.postMessage({ type: "videoDone", id })
        if (senderData.pendingVideoFrame) void sendQueuedVideoFrame(id)
    }
}

/** main capture path (no GPU readback): latest-wins pending slot */
async function sendVideoBuffer(id: string, buffer: Buffer, opts: VideoFrameOpts) {
    const senderData = SENDERS[id]
    if (!senderData?.sender) return
    senderData.offMain = false

    const adapter = senderData.adapter
    const lib = await adapter.load()
    if (!lib) return

    const prepared = adapter.prepareVideo(lib, buffer, opts.size, opts.format ?? 0, opts.transparent !== false)

    // main-path frames are always real; count the loss when overwriting an unsent one
    if (senderData.pendingVideoFrame && senderData.pendingReal) senderData.coalescedReal = (senderData.coalescedReal || 0) + 1
    senderData.pendingReal = true
    senderData.pendingVideoFrame = adapter.videoFrame(lib, prepared.data, { ...opts, format: prepared.format })

    sendQueuedVideoFrame(id)
}

const readbackSlots: { [id: string]: { free: number[]; next: number } } = {}
function acquireReadbackSlot(id: string): number {
    const pool = (readbackSlots[id] ||= { free: [], next: 0 })
    return pool.free.length ? pool.free.pop()! : pool.next++
}
function releaseReadbackSlot(id: string, slot: number) {
    const pool = (readbackSlots[id] ||= { free: [], next: 0 })
    if (!pool.free.includes(slot)) pool.free.push(slot)
}

// Send-side pacer: dispatches at steady intervals from refcounted recycled buffers, repeating the last
// frame when no new one arrives in time.
const pacerPools: { [rendererId: string]: Buffer[] } = {}
function acquirePacerBuf(owner: string, length: number): PacerBuf {
    const pool = (pacerPools[owner] ||= [])
    const idx = pool.findIndex((b) => b.byteLength === length)
    if (idx >= 0) return { buf: pool.splice(idx, 1)[0], refs: 0, owner }
    pool.length = 0
    return { buf: Buffer.allocUnsafe(length), refs: 0, owner }
}
function releasePacerRef(pb: PacerBuf) {
    pb.refs--
    if (pb.refs > 0) return
    const pool = pacerPools[pb.owner]
    if (pool && !pool.includes(pb.buf)) pool.push(pb.buf)
}

function startPacer(id: string) {
    const s = SENDERS[id]
    if (!s || s.paceTimer) return
    s.paceNextDue = Date.now() + (s.paceInterval || 1000 / 30)
    schedulePaceTick(id)
}
function schedulePaceTick(id: string) {
    const s = SENDERS[id]
    if (!s) return
    const delay = Math.max(0, (s.paceNextDue || 0) - Date.now())
    s.paceTimer = setTimeout(() => {
        const sd = SENDERS[id]
        if (!sd) return // stopped
        const interval = sd.paceInterval || 1000 / 30
        sd.paceNextDue = (sd.paceNextDue || Date.now()) + interval
        if (sd.paceNextDue < Date.now()) sd.paceNextDue = Date.now() + interval // resync, don't burst
        paceTick(id)
        schedulePaceTick(id)
    }, delay)
}

function paceTick(id: string) {
    const s = SENDERS[id]
    if (!s?.sender) return
    if (s.sendingVideo) {
        s.paceBusy = (s.paceBusy || 0) + 1
        return
    }
    const entry = s.paceQueue?.shift()
    if (entry) {
        paceSend(id, entry, true)
        return
    }
    if (s.lastPace) {
        s.paceMisses = (s.paceMisses || 0) + 1
        s.lastPace.pbuf.refs++
        paceSend(id, s.lastPace, false)
    }
}

async function paceSend(id: string, entry: { frame: any; pbuf: PacerBuf }, real: boolean) {
    const senderData = SENDERS[id]
    if (!senderData?.sender) {
        releasePacerRef(entry.pbuf)
        return
    }
    senderData.sendingVideo = true
    if (real) {
        const now = Date.now()
        if (process.env.FS_CAP_STATS && senderData.lastRealSendAt) (senderData.realGaps ||= []).push(now - senderData.lastRealSendAt)
        senderData.lastRealSendAt = now
    }
    const frame = { ...entry.frame, [senderData.tsKey || "timecode"]: frameTimestamp() }
    const sendT0 = process.env.FS_CAP_STATS ? Date.now() : 0
    try {
        noteSendResult(senderData, id, frame, await senderData.sendFrame!(frame))
    } catch (err) {
        console.error("Error sending video frame:", err)
    } finally {
        if (sendT0) {
            senderData.sendMsSum = (senderData.sendMsSum || 0) + (Date.now() - sendT0)
            if (real) senderData.sentReal = (senderData.sentReal || 0) + 1
            else senderData.sentRepeat = (senderData.sentRepeat || 0) + 1
        }
        senderData.sendingVideo = false
        releasePacerRef(entry.pbuf)
    }
}

/** queue a frame for an output at its own rate, dropping the oldest when it is not keeping up */

export type CaptureOpts = { size: FrameSize; ratio: number; framerate: number; memberFramerates?: { [id: string]: number }; format: number; transparent?: boolean; dstW?: number; dstH?: number; seq?: number; members?: string[]; depth?: number }

// reads the output's shared GPU texture back, then fans that one readback out to every output sharing
// the render, each at its own framerate
// integer/fixed-point BGRA -> UYVY packed 4:2:2 (BT.601 full range, coefficients scaled by 256).
// Integer math + inline clamping avoids the per-pixel float work, which dominated the JS conversion time.
function bgraToUyvy(bgra: Buffer, width: number, height: number): Buffer {
    const out = Buffer.allocUnsafe(width * 2 * height)
    const rowIn = width * 4
    const rowOut = width * 2
    for (let y = 0; y < height; y++) {
        let si = y * rowIn
        let di = y * rowOut
        for (let x = 0; x < width; x += 2) {
            const b0 = bgra[si],
                g0 = bgra[si + 1],
                r0 = bgra[si + 2]
            const b1 = bgra[si + 4],
                g1 = bgra[si + 5],
                r1 = bgra[si + 6]
            let u = ((-43 * r0 - 85 * g0 + 128 * b0) >> 8) + 128
            let v = ((128 * r0 - 107 * g0 - 21 * b0) >> 8) + 128
            out[di] = u < 0 ? 0 : u > 255 ? 255 : u // U
            out[di + 1] = (77 * r0 + 150 * g0 + 29 * b0) >> 8 // Y0 (0..255, no clamp needed)
            out[di + 2] = v < 0 ? 0 : v > 255 ? 255 : v // V
            out[di + 3] = (77 * r1 + 150 * g1 + 29 * b1) >> 8 // Y1
            si += 8
            di += 4
        }
    }
    return out
}

// BGRA -> UYVA = UYVY colour plane (width*2*height) immediately followed by a full-res alpha plane
// (width*height). Keeps transparency while still skipping the SDK's BGRA->UYVY conversion.
function bgraToUyva(bgra: Buffer, width: number, height: number): Buffer {
    const uyvySize = width * 2 * height
    const out = Buffer.allocUnsafe(uyvySize + width * height)
    const rowIn = width * 4
    const rowUyvy = width * 2
    for (let y = 0; y < height; y++) {
        let si = y * rowIn
        let di = y * rowUyvy
        let ai = uyvySize + y * width
        for (let x = 0; x < width; x += 2) {
            const b0 = bgra[si],
                g0 = bgra[si + 1],
                r0 = bgra[si + 2],
                a0 = bgra[si + 3]
            const b1 = bgra[si + 4],
                g1 = bgra[si + 5],
                r1 = bgra[si + 6],
                a1 = bgra[si + 7]
            let u = ((-43 * r0 - 85 * g0 + 128 * b0) >> 8) + 128
            let v = ((128 * r0 - 107 * g0 - 21 * b0) >> 8) + 128
            out[di] = u < 0 ? 0 : u > 255 ? 255 : u // U
            out[di + 1] = (77 * r0 + 150 * g0 + 29 * b0) >> 8 // Y0
            out[di + 2] = v < 0 ? 0 : v > 255 ? 255 : v // V
            out[di + 3] = (77 * r1 + 150 * g1 + 29 * b1) >> 8 // Y1
            out[ai] = a0 // alpha px0
            out[ai + 1] = a1 // alpha px1
            si += 8
            di += 4
            ai += 2
        }
    }
    return out
}

function loadSharp() {
    if (sharpModule === null) {
        try {
            sharpModule = require("sharp")
        } catch (err: any) {
            sharpModule = false
            console.error("stage JPEG encoder unavailable:", err.message)
        }
    }
    return sharpModule || null
}

function encodeStageFrame(id: string, members: string[], rgba: Buffer, cfg: { width: number; height: number; quality: number; intervalMs: number }) {
    const sharp = loadSharp()
    if (!sharp || stageBusy.has(id)) return
    const now = Date.now()
    if (now - (stageLastAt[id] || 0) < cfg.intervalMs) return
    stageLastAt[id] = now
    stageBusy.add(id)
    // the frame buffer is recycled as soon as this returns, and the encode is asynchronous
    const owned = Buffer.from(rgba)
    sharp(owned, { raw: { width: cfg.width, height: cfg.height, channels: 4 } })
        .jpeg({ quality: cfg.quality })
        .toBuffer()
        .then((jpeg: Buffer) => {
            port.postMessage({ type: "stageJpeg", id, members, jpeg, size: { width: cfg.width, height: cfg.height } })
        })
        .catch((err: any) => console.error("stage JPEG encode failed:", err.message))
        .finally(() => stageBusy.delete(id))
}

function encodeThumbFrame(id: string, rgba: Buffer, cfg: { width: number; height: number; quality: number }) {
    const sharp = loadSharp()
    if (!sharp || thumbBusy.has(id)) return
    thumbBusy.add(id)
    const owned = Buffer.from(rgba)
    sharp(owned, { raw: { width: cfg.width, height: cfg.height, channels: 4 } })
        .jpeg({ quality: cfg.quality })
        .toBuffer()
        .then((jpeg: Buffer) => {
            port.postMessage({ type: "thumbJpeg", id, jpeg, size: { width: cfg.width, height: cfg.height } })
        })
        .catch((err: any) => console.error("thumbnail JPEG encode failed:", err.message))
        .finally(() => thumbBusy.delete(id))
}

function webrtcFrames() {
    if (webrtcServer) return webrtcServer
    webrtcServer = new FrameServer({
        log: (text) => console.info("[webrtc frames]", text),
        onListening: (info) => port.postMessage({ type: "webrtcWs", port: info.port, token: info.token }),
        onNeedTarget: (targetId) => port.postMessage({ type: "webrtcNeedTarget", targetId }),
        retain: (frame) => {
            const pb = servedPacer.get(frame)
            if (pb) pb.refs++
        },
        release: (frame) => {
            const pb = servedPacer.get(frame)
            if (pb) releasePacerRef(pb)
        },
        stats: !!process.env.FS_CAP_STATS
    })
    return webrtcServer
}

function presentFrames() {
    if (presentServer) return presentServer
    presentServer = new FrameServer({
        log: (text) => console.info("[present frames]", text),
        onListening: (info) => port.postMessage({ type: "presentWs", port: info.port, token: info.token }),
        onNeedTarget: (targetId) => port.postMessage({ type: "presentNeedTarget", targetId }),
        retain: (frame) => {
            const pb = servedPacer.get(frame)
            if (pb) pb.refs++
        },
        release: (frame) => {
            const pb = servedPacer.get(frame)
            if (pb) releasePacerRef(pb)
        },
        stats: !!process.env.FS_CAP_STATS
    })
    return presentServer
}

function previewFrames() {
    if (previewServer) return previewServer
    previewServer = new FrameServer({
        log: (text) => console.info("[preview frames]", text),
        onListening: (info) => port.postMessage({ type: "previewWs", port: info.port, token: info.token }),
        onNeedTarget: (targetId) => port.postMessage({ type: "previewNeedTarget", targetId }),
        stats: !!process.env.FS_CAP_STATS
    })
    return previewServer
}

// WebRTC host window: frames leave here over the shared-memory transport (see capture/FrameServer.ts);
// main relays the socket details to the window and nothing else
const servedPacer = new WeakMap<ServedFrame, PacerBuf>()

// last push per output, so an OutputShow viewer is served at its rate and not at the render rate
const lastServerPush = new Map<string, number>()

const stageBusy = new Set<string>()

const stageLastAt: { [id: string]: number } = {}

const thumbBusy = new Set<string>()

const videoLayers: { [outputId: string]: VideoLayerState } = {}

function connectVideoSource(targetId: string, outputId: string, wsPort: number, token: string) {
    const osr = loadOsrCapture()
    if (!osr || typeof osr.shmReadAsync !== "function" || !osr.videoLayerSupported) return
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const WebSocket = require("ws")
    const existing = videoLayers[outputId]
    try {
        existing?.ws?.close()
    } catch {}
    const state: VideoLayerState = { bufs: [], current: null, width: 0, height: 0, format: 0, ws: null, ring: null }
    videoLayers[outputId] = state
    const ws = new WebSocket(`ws://127.0.0.1:${wsPort}`)
    state.ws = ws
    ws.on("open", () => ws.send(JSON.stringify({ token, targetId, shm: true })))
    ws.on("message", (raw: any, isBinary: boolean) => {
        if (isBinary) return
        let header: any = null
        try {
            header = JSON.parse(raw.toString())
        } catch {
            return
        }
        if (!header || header.slot === undefined) return
        const done = () => {
            try {
                ws.send("1:" + header.slot)
            } catch {}
        }
        if (header.shm && header.shm.name !== state.ring?.name) {
            try {
                if (state.ring) osr.shmUnmap(state.ring.name)
                osr.shmMap(header.shm.name, header.shm.slotBytes * header.shm.slots, false)
                state.ring = { name: header.shm.name, slotBytes: header.shm.slotBytes }
            } catch {
                state.ring = null
            }
        }
        // every format the receive process produces composites; anything else stays with the page's draw
        const format = header.format === "uyvy" ? 1 : header.format === "bgra" ? 0 : header.format === "rgba" ? 3 : -1
        if (!state.ring || format < 0) return done()

        let slot = state.bufs.find((b) => !b.inUse && b.buf.length >= header.bytes)
        if (!slot && state.bufs.length < VIDEO_BUFS) {
            slot = { buf: Buffer.allocUnsafeSlow(header.bytes), bytes: 0, inUse: false }
            state.bufs.push(slot)
        }
        if (!slot) return done() // every buffer is in a readback: drop this frame, the next one is close
        const target = slot
        target.inUse = true
        osr.shmReadAsync(state.ring.name, header.slot * state.ring.slotBytes, target.buf.subarray(0, header.bytes)).then(
            () => {
                target.bytes = header.bytes
                target.inUse = false
                state.width = header.xres
                state.height = header.yres
                state.format = format
                state.current = target
                done()
                // the page is not drawing this frame; it repaints once per frame on this tick, which
                // keeps the capture running at the source's rate rather than as fast as it can paint
                port.postMessage({ type: "videoFrame", id: outputId })
            },
            () => {
                target.inUse = false
                done()
            }
        )
    })
    ws.on("close", () => {
        videoLayerReported.delete(outputId)
        port.postMessage({ type: "videoLayerActive", id: outputId, active: false })
        if (videoLayers[outputId] === state) {
            try {
                if (state.ring) osr.shmUnmap(state.ring.name)
            } catch {}
            delete videoLayers[outputId]
        }
    })
    ws.on("error", () => {})
}

type VideoLayerState = { bufs: VideoBuf[]; current: VideoBuf | null; width: number; height: number; format: number; ws: any; ring: { name: string; slotBytes: number } | null }

const VIDEO_BUFS = 3

// outputs whose page has been told the composite is running (so it can stop drawing the frame itself)
const videoLayerReported = new Set<string>()

// FS_CONVERT_CHECK reports once per output; comparing every frame would swamp the log
const convertChecked = new Set<string>()

// FS_CAP_STATS: how congested this worker's JS thread is. Loop lag = how late a 5ms timer fires
// (0 = idle loop); copyMs/fanMs = synchronous time spent copying readbacks and fanning out frames.
type VideoBuf = { buf: Buffer; bytes: number; inUse: boolean }
const BMD_AUDIO_MARKER = Buffer.from([1])
let sharpModule: any = null
let webrtcServer: FrameServer | null = null
let previewServer: FrameServer | null = null
let presentServer: FrameServer | null = null

const loopDiag = { lagSum: 0, lagMax: 0, lagN: 0, copyMs: 0, copyN: 0, fanMs: 0, lastTick: 0 }
if (process.env.FS_CAP_STATS) {
    loopDiag.lastTick = performance.now()
    setInterval(() => {
        const now = performance.now()
        const lag = Math.max(0, now - loopDiag.lastTick - 5)
        loopDiag.lastTick = now
        loopDiag.lagSum += lag
        loopDiag.lagN++
        if (lag > loopDiag.lagMax) loopDiag.lagMax = lag
    }, 5)
}

async function captureAndSend(id: string, source: any, opts: { size: { width: number; height: number }; ratio: number; framerate: number; memberFramerates?: { [id: string]: number }; format: number; mainFormat?: number; transparent?: boolean; dstW?: number; dstH?: number; seq?: number; members?: string[]; depth?: number; targets?: { width: number; height: number; format: number }[]; memberTarget?: { [id: string]: number }; memberFormats?: { [id: string]: number }; memberSizes?: { [id: string]: { width: number; height: number } }; cpuTargets?: boolean; rtmpMembers?: { [id: string]: { width: number; height: number } }; bmdMembers?: { [id: string]: { width: number; height: number; format: number; framerate: number } }; webrtcMembers?: { [id: string]: { width: number; height: number } }; presentMembers?: { [id: string]: { width: number; height: number } }; convertCheck?: boolean; stageStream?: { width: number; height: number; quality: number; intervalMs: number } | null; serverStream?: { width: number; height: number; intervalMs: number } | null; thumbStream?: { width: number; height: number; quality: number } | null }) {
    // seq identifies this in-flight capture; the osr-capture key is slotted so concurrent readbacks
    // for one output use independent pool entries
    const seq = opts.seq ?? 0
    const senderData = SENDERS[id]
    const osr = loadOsrCapture()
    const membersAll = opts.members?.length ? opts.members : [id]
    const activeMembers = membersAll.filter((m) => SENDERS[m]?.sender)
    // one render and one readback, but its members may send on different protocols: load each protocol
    // present in the group and leave out a member whose library is unavailable
    const libs: { [tag: string]: any } = {}
    for (const m of activeMembers) {
        const ad = SENDERS[m]!.adapter
        if (!(ad.tag in libs)) libs[ad.tag] = await ad.load()
    }
    const sendMembers = activeMembers.filter((m) => !!libs[SENDERS[m]!.adapter.tag])
    const hasSenders = sendMembers.length > 0
    const rtmpMembers = Object.keys(opts.rtmpMembers || {}).filter((m) => RtmpStreamer.isRunning(m))
    const hasRtmp = rtmpMembers.length > 0
    const bmdMembers = Object.keys(opts.bmdMembers || {}).filter((m) => !!BlackmagicSender.playbackData[m]?.playback)
    const hasBmd = bmdMembers.length > 0
    const webrtcMembers = Object.keys(opts.webrtcMembers || {})
    const hasWebrtc = webrtcMembers.length > 0
    const presentMembers = Object.keys(opts.presentMembers || {})
    const hasPresent = presentMembers.length > 0
    // An output whose only consumers are the web server, a stage client or a preview still belongs here:
    // it needs the downscaled frame, and producing that on the main thread was the last routine path that
    // put a full frame in front of the UI's event loop.
    const wantsScaledOnly = !hasSenders && !hasRtmp && !hasBmd && !hasWebrtc && !hasPresent && (opts.dstW || 0) > 0 && (opts.dstH || 0) > 0
    if ((!hasSenders && !hasRtmp && !hasBmd && !hasWebrtc && !hasPresent && !wantsScaledOnly) || !osr?.readback) {
        port.postMessage({ type: "releaseTexture", id, seq })
        port.postMessage({ type: "captureDone", id, seq })
        return
    }
    const { size, ratio, framerate, format, dstW = 0, dstH = 0 } = opts
    // FS_CAP_STATS: per-frame hop timestamps posted back with captureDone (worker_threads share the
    const tl = process.env.FS_CAP_STATS ? { recv: Date.now(), cS: 0, cE: 0, fS: 0, fE: 0, enq: 0 } : null
    const members = membersAll
    const wantScaled = dstW > 0 && dstH > 0
    const slot = acquireReadbackSlot(id)
    const rbKey = `${id}#${slot}`
    if (senderData) senderData.offMain = true
    // the live frame this output is showing, composited under the page by the addon
    const layer = videoLayers[id]
    const layerBuf = layer?.current && layer.width && layer.height ? layer.current : null
    const video = layerBuf ? { width: layer!.width, height: layer!.height, format: layer!.format, data: layerBuf.buf.subarray(0, layerBuf.bytes) } : null
    if (layerBuf) layerBuf.inUse = true

    const twoPhase = typeof osr.readbackConsume === "function" && typeof osr.readbackFinish === "function"
    const singleDispatch = !twoPhase && typeof osr.readbackOnce === "function"
    let textureReleased = false
    const releaseTexture = () => {
        if (textureReleased) return
        textureReleased = true
        port.postMessage({ type: "releaseTexture", id, seq })
    }
    // Every member sends at its own size and format. Full-size members in the main format share the main
    // readback buffer; each other (size, format) gets a target: produced on the GPU in the same pass when the
    // addon supports it, else derived on this thread from a BGRA main. All buffers are refcounted pacer
    // buffers: the addon writes straight into them and no frame is copied here on the GPU path.
    const targets = opts.targets || []
    const mainFormat = opts.mainFormat ?? format
    const bytesFor = (w: number, h: number, f: number) => (f === 1 ? w * h * 2 : f === 2 ? w * h * 3 : f === 4 ? w * h + 2 * (Math.floor(w / 2) * Math.floor(h / 2)) : w * h * 4)
    const gpuTargets = twoPhase && targets.length > 0 && !opts.cpuTargets && !!osr.targetsSupported
    const framePbuf = twoPhase ? acquirePacerBuf(id, bytesFor(size.width, size.height, format)) : null
    const targetPbufs: PacerBuf[] = gpuTargets ? targets.map((t, i) => acquirePacerBuf(`${id}#t${i}`, bytesFor(t.width, t.height, t.format))) : []
    const heldBufs: PacerBuf[] = [] // every pacer buffer this frame took; unqueued ones go back to their pools
    if (framePbuf) heldBufs.push(framePbuf)
    heldBufs.push(...targetPbufs)
    const queued = new Set<PacerBuf>()
    try {
        let buffer: Buffer
        let scaled: Buffer | undefined
        if (singleDispatch) {
            if (tl) tl.cS = Date.now()
            const onRelease = () => {
                if (tl && !tl.cE) tl.cE = tl.fS = Date.now()
                releaseTexture()
            }
            const res = await osr.readbackOnce(source, size.width, size.height, format, rbKey, wantScaled ? dstW : 0, wantScaled ? dstH : 0, onRelease)
            if (tl) {
                tl.fE = Date.now()
                if (!tl.cE) tl.cE = tl.fS = tl.fE
            }
            releaseTexture()
            if (wantScaled && res && res.main) {
                buffer = res.main
                scaled = res.scaled
            } else {
                buffer = res
            }
        } else if (twoPhase) {
            if (tl) tl.cS = Date.now()
            await osr.readbackConsume(source, size.width, size.height, format, rbKey, wantScaled ? dstW : 0, wantScaled ? dstH : 0, gpuTargets ? targets : undefined, video || undefined)
            if (video && !videoLayerReported.has(id)) {
                videoLayerReported.add(id)
                port.postMessage({ type: "videoLayerActive", id })
            }
            if (tl) tl.cE = Date.now()
            releaseTexture()
            if (tl) tl.fS = Date.now()
            const res = await osr.readbackFinish(rbKey, size.width, size.height, format, wantScaled ? dstW : 0, wantScaled ? dstH : 0, framePbuf!.buf, gpuTargets ? targets : undefined, gpuTargets ? targetPbufs.map((p) => p.buf) : undefined)
            if (tl) tl.fE = Date.now()
            if (res && res.main) {
                buffer = res.main
                scaled = res.scaled
            } else {
                buffer = res
            }
        } else {
            if (tl) tl.cS = Date.now()
            buffer = await osr.readback(source, size.width, size.height, format, rbKey)
            if (tl) tl.cE = tl.fS = tl.fE = Date.now()
            releaseTexture()
        }

        // the app window's previews are served straight from here, so main never holds a preview frame
        if (scaled && scaled.length) {
            const server = previewFrames()
            const now = Date.now()
            // the addon reuses its scaled buffer for the next readback, and the server may still be
            // holding this frame waiting for the window, so it gets its own copy - on this thread
            const frame: ServedFrame = { xres: dstW, yres: dstH, format: "bgra", data: Buffer.from(new Uint8Array(scaled.buffer, scaled.byteOffset, scaled.byteLength)) }
            for (const m of members) server.deliver(m, "PREVIEW", m, frame, now, true)
        }

        const tFan = performance.now()
        type FrameBuf = { pbuf: PacerBuf; width: number; height: number; format: number }
        const convertBgra = (bgra: Buffer, w: number, h: number, f: number): Buffer => {
            // every branch below walks the frame on a CPU core, which the GPU convert exists to avoid
            ruleViolation("cpu-frame", "worker convert format " + f)
            if (f === 2) return osr.convertBgraToUyva ? osr.convertBgraToUyva(bgra, w, h) : bgraToUyva(bgra, w, h)
            if (f === 1) return osr.convertBgraToUyvy ? osr.convertBgraToUyvy(bgra, w, h) : bgraToUyvy(bgra, w, h)
            if (f === 4) return osr.convertBgraToI420(bgra, w, h)
            return bgra
        }
        const intoPacerBuf = (owner: string, data: Buffer): PacerBuf => {
            const tCopy = performance.now()
            const pb = acquirePacerBuf(owner, data.length)
            data.copy(pb.buf, 0, 0, data.length)
            loopDiag.copyMs += performance.now() - tCopy
            loopDiag.copyN++
            heldBufs.push(pb)
            return pb
        }

        // main buffer, in the format full-size members send in
        let main: FrameBuf
        if (format === 0 && mainFormat !== 0) {
            // CPU-target path (or legacy single-phase): the readback is BGRA; convert once for the full-size members
            main = { pbuf: intoPacerBuf(`${id}#m`, convertBgra(buffer, size.width, size.height, mainFormat)), width: size.width, height: size.height, format: mainFormat }
        } else if (framePbuf && buffer === framePbuf.buf) {
            main = { pbuf: framePbuf, width: size.width, height: size.height, format }
        } else {
            main = { pbuf: intoPacerBuf(id, buffer), width: size.width, height: size.height, format }
        }

        // per-target buffers
        const targetBufs: FrameBuf[] = []
        if (gpuTargets) {
            targets.forEach((t, i) => targetBufs.push({ pbuf: targetPbufs[i], width: t.width, height: t.height, format: t.format }))
        } else if (targets.length && format === 0 && typeof osr.downscaleBgra === "function") {
            for (const t of targets) {
                ruleViolation("cpu-frame", "worker downscale for a target")
                const small: Buffer = osr.downscaleBgra(buffer, size.width, size.height, t.width, t.height)
                targetBufs.push({ pbuf: intoPacerBuf(`${id}#t`, convertBgra(small, t.width, t.height, t.format)), width: t.width, height: t.height, format: t.format })
            }
        }
        const bufFor = (m: string): FrameBuf => {
            const ti = opts.memberTarget?.[m] ?? -1
            return ti >= 0 && targetBufs[ti] ? targetBufs[ti] : main
        }
        const enqueue = (m: string, frame: any, pbuf: PacerBuf, interval: number) => {
            const md = SENDERS[m]!
            md.offMain = true
            md.paceInterval = interval
            if (md.paceTimer && md.paceNextDue && md.paceNextDue > Date.now() + md.paceInterval) {
                clearTimeout(md.paceTimer)
                md.paceTimer = undefined
                startPacer(m)
            }
            md.paceCap = Math.max(2, (opts.depth ?? 1) + 1)
            const queue = (md.paceQueue ||= [])
            while (queue.length >= md.paceCap) {
                const dropped = queue.shift()!
                releasePacerRef(dropped.pbuf)
                md.coalescedReal = (md.coalescedReal || 0) + 1
            }
            pbuf.refs++ // queue entry's ref
            queue.push({ frame, pbuf })
            pbuf.refs++ // lastPace pin's ref (repeats only fire when the queue is empty, i.e. this
            if (md.lastPace) releasePacerRef(md.lastPace.pbuf) // frame has already been sent or dropped)
            md.lastPace = { frame, pbuf }
            queued.add(pbuf)
            startPacer(m)
        }

        // Each member sends at its own size and format. A member whose buffer is still BGRA is converted
        // by the adapter, which reports the format it produced; the rest already hold what it wants.
        if (hasSenders) {
            const transparent = opts.transparent !== false
            for (const m of sendMembers) {
                const ad = SENDERS[m]!.adapter
                const lib = libs[ad.tag]
                let b = bufFor(m)
                if (b.format === 0) {
                    const prepared = ad.prepareVideo(lib, b.pbuf.buf.subarray(0, bytesFor(b.width, b.height, 0)), { width: b.width, height: b.height }, 0, transparent)
                    if (prepared.format !== 0) b = { pbuf: intoPacerBuf(`${id}#${ad.tag}`, prepared.data), width: b.width, height: b.height, format: prepared.format }
                }
                const mfr = Math.max(1, opts.memberFramerates?.[m] || framerate)
                const frame = ad.videoFrame(lib, b.pbuf.buf, { size: { width: b.width, height: b.height }, ratio: b.height ? b.width / b.height : ratio, framerate: mfr, transparent, format: b.format })
                enqueue(m, frame, b.pbuf, 1000 / mfr)
            }
        }

        // RTMP: ffmpeg takes a planar I420 frame at the broadcast size (1.5 bytes/px, no swscale in the
        // encoder). The engine borrows the pacer buffer (one ref) and releases it when a newer frame
        // replaces it, so no copy is made on this thread
        for (const m of rtmpMembers) {
            const want = opts.rtmpMembers![m]
            const ti = targetBufs.findIndex((t) => t.width === want.width && t.height === want.height && (t.format === 4 || t.format === 0))
            const b = ti >= 0 ? targetBufs[ti] : main.format === 0 && main.width === want.width && main.height === want.height ? main : null
            if (!b) continue
            const pb = b.pbuf
            const bytes = bytesFor(b.width, b.height, b.format)
            pb.refs++
            queued.add(pb)
            RtmpStreamer.updateFrame(m, pb.buf.length === bytes ? pb.buf : pb.buf.subarray(0, bytes), { width: b.width, height: b.height }, () => releasePacerRef(pb), b.format === 4 ? "yuv420p" : "bgra")
        }
        // WebRTC: the host window draws a BGRA frame at the output's size, served over shared memory
        // (FrameServer); the server holds a pacer reference while it keeps or copies the frame
        if (hasWebrtc) {
            const server = webrtcFrames()
            const now = Date.now()
            for (const m of webrtcMembers) {
                const want = opts.webrtcMembers![m]
                const ti = targetBufs.findIndex((t) => t.width === want.width && t.height === want.height && t.format === 0)
                const b = ti >= 0 ? targetBufs[ti] : main.format === 0 && main.width === want.width && main.height === want.height ? main : null
                if (!b) continue
                const bytes = bytesFor(b.width, b.height, 0)
                const frame: ServedFrame = { xres: b.width, yres: b.height, format: "bgra", data: b.pbuf.buf.length === bytes ? b.pbuf.buf : b.pbuf.buf.subarray(0, bytes) }
                servedPacer.set(frame, b.pbuf)
                // the buffer is the server's to release once it retained it; without a window it stays
                // unqueued and returns to its pool below
                server.deliver(m, "WEBRTC", m, frame, now)
                if (b.pbuf.refs > 0) queued.add(b.pbuf)
            }
        }
        // the on-screen window of a captured output, served like the WebRTC host window
        if (hasPresent) {
            const server = presentFrames()
            const now = Date.now()
            for (const m of presentMembers) {
                const want = opts.presentMembers![m]
                const ti = targetBufs.findIndex((t) => t.width === want.width && t.height === want.height && t.format === 0)
                const b = ti >= 0 ? targetBufs[ti] : main.format === 0 && main.width === want.width && main.height === want.height ? main : null
                if (!b) continue
                const bytes = bytesFor(b.width, b.height, 0)
                const frame: ServedFrame = { xres: b.width, yres: b.height, format: "bgra", data: b.pbuf.buf.length === bytes ? b.pbuf.buf : b.pbuf.buf.subarray(0, bytes) }
                servedPacer.set(frame, b.pbuf)
                server.deliver(m, "PRESENT", m, frame, now)
                if (b.pbuf.refs > 0) queued.add(b.pbuf)
            }
        }
        // Blackmagic: the card's scheduler retains what it is given, so it gets its own copy of the frame at
        // the card's mode (UYVY straight in when the card takes it raw, else BGRA converted by the sender)
        for (const m of bmdMembers) {
            const want = opts.bmdMembers![m]
            if (!BlackmagicSender.canAcceptFrame(m)) continue
            const ti = targetBufs.findIndex((t) => t.width === want.width && t.height === want.height && t.format === want.format)
            const b = ti >= 0 ? targetBufs[ti] : main.width === want.width && main.height === want.height && main.format === want.format ? main : null
            if (!b) continue
            const bytes = bytesFor(b.width, b.height, b.format)
            const marker = BlackmagicSender.audioQueueLength > 0 ? BMD_AUDIO_MARKER : null
            BlackmagicSender.scheduleFrame(m, Buffer.from(b.pbuf.buf.subarray(0, bytes)), marker, want.framerate, b.format === 1)
        }
        // FS_CONVERT_CHECK: the GPU produced this frame in the real format as a target, and `main` holds
        // the same frame as BGRA, so converting that here gives the CPU reference to compare it against.
        // FS_CONVERT_CHECK: every packed format was produced by the GPU as a full-size target, alongside
        // a plain BGRA one. Converting that BGRA here with the CPU reference gives something to compare
        // each GPU kernel against on a real frame — the check that would have caught the UYVY chroma
        // order being swapped.
        if (opts.convertCheck && !convertChecked.has(id)) {
            const si = targetBufs.findIndex((t) => t.width === size.width && t.height === size.height && t.format === 0)
            if (si >= 0) {
                convertChecked.add(id)
                const backend = typeof osr._readbackBackend === "function" ? osr._readbackBackend() : "?"
                const bgra = targetBufs[si].pbuf.buf.subarray(0, bytesFor(size.width, size.height, 0))
                for (const f of [1, 2, 4]) {
                    const ti = targetBufs.findIndex((t) => t.width === size.width && t.height === size.height && t.format === f)
                    if (ti < 0) {
                        console.info(`[CONVERT-CHECK ${id}] format ${f}: the GPU produced no target for it`)
                        continue
                    }
                    const bytes = bytesFor(size.width, size.height, f)
                    const cpu = convertBgra(bgra, size.width, size.height, f)
                    const gpu = targetBufs[ti].pbuf.buf
                    let worst = 0
                    let at = -1
                    let differing = 0
                    for (let k = 0; k < bytes; k++) {
                        const d = Math.abs(cpu[k] - gpu[k])
                        if (!d) continue
                        differing++
                        if (d > worst) {
                            worst = d
                            at = k
                        }
                    }
                    const verdict = worst === 0 ? "identical to the CPU reference" : `worst ${worst} at byte ${at}, ${differing} of ${bytes} bytes differ`
                    console.info(`[CONVERT-CHECK ${id}] ${size.width}x${size.height} format ${f} on ${backend}: ${verdict}`)
                }
            }
        }

        if (opts.serverStream && Date.now() - (lastServerPush.get(id) || 0) >= opts.serverStream.intervalMs) {
            const cfg = opts.serverStream
            lastServerPush.set(id, Date.now())
            const ti = targetBufs.findIndex((t) => t.width === cfg.width && t.height === cfg.height && t.format === 3)
            if (ti >= 0) {
                const bytes = cfg.width * cfg.height * 4
                const copy = Buffer.from(targetBufs[ti].pbuf.buf.subarray(0, bytes))
                port.postMessage({ type: "serverFrame", id, buffer: copy, size: { width: cfg.width, height: cfg.height } }, [copy.buffer])
            }
        }

        // a controller asked for a thumbnail: encode the frame already to hand
        if (opts.thumbStream) {
            const cfg = opts.thumbStream
            const ti = targetBufs.findIndex((t) => t.width === cfg.width && t.height === cfg.height && t.format === 3)
            if (ti >= 0) encodeThumbFrame(id, targetBufs[ti].pbuf.buf.subarray(0, cfg.width * cfg.height * 4), cfg)
        }

        if (opts.stageStream) {
            const cfg = opts.stageStream
            const ti = targetBufs.findIndex((t) => t.width === cfg.width && t.height === cfg.height && t.format === 3)
            if (ti >= 0) encodeStageFrame(id, members, targetBufs[ti].pbuf.buf.subarray(0, cfg.width * cfg.height * 4), cfg)
        }

        loopDiag.fanMs += performance.now() - tFan
        if (tl) tl.enq = Date.now() // pacer enqueue complete (memcpy + fan-out done) — nonzero = clean path
    } catch (err) {
        console.error("Worker readback error:", err)
    } finally {
        // buffers no member queued (error, or a target/main nobody used): return them to their pools
        for (const pb of heldBufs) {
            if (queued.has(pb) || pb.refs !== 0) continue
            const pool = pacerPools[pb.owner]
            if (pool && !pool.includes(pb.buf)) pool.push(pb.buf)
        }
        if (layerBuf) layerBuf.inUse = false
        releaseTexture() // safety: ensure the texture is released even on error
        releaseReadbackSlot(id, slot)
        // capture fully done -> this pipeline slot frees (main may forward another frame for this output)
        port.postMessage({ type: "captureDone", id, seq, tl })
    }
}

async function sendQueuedAudioFrame(id: string) {
    const senderData = SENDERS[id]
    if (!senderData?.sender || senderData.sendingAudio) return

    senderData.sendingAudio = true

    try {
        while (senderData.audioQueue && senderData.audioQueue.length > 0) {
            if (!SENDERS[id]?.sender) break

            // sending is falling behind: drop all but the newest
            if (senderData.audioQueue.length > 50) {
                senderData.audioQueue.splice(0, senderData.audioQueue.length - 20)
            }

            const frame = senderData.audioQueue.shift()
            if (frame) await senderData.sendAudio!(frame)
        }
    } catch (err) {
        console.error("Error sending audio frame:", err)
    } finally {
        senderData.sendingAudio = false
        if (SENDERS[id]?.sender && senderData.audioQueue && senderData.audioQueue.length > 0) {
            sendQueuedAudioFrame(id)
        }
    }
}

async function makeAudioFrame(adapter: SenderAdapter, buffer: Buffer, sampleRate: number, channelCount: number) {
    if (!buffer || buffer.length === 0) return null
    if (Math.trunc(buffer.length / (channelCount * BYTES_PER_FLOAT32)) <= 0) return null

    const lib = await adapter.load()
    if (!lib) return null

    return adapter.audioFrame(lib, buffer, sampleRate, channelCount)
}

/** audio for one output */
async function sendAudioBufferTarget(id: string, buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
    const senderData = SENDERS[id]
    if (!senderData?.sender) return

    const frame = await makeAudioFrame(senderData.adapter, buffer, sampleRate, channelCount)
    if (!frame || !SENDERS[id]?.sender) return

    if (!senderData.audioQueue) senderData.audioQueue = []
    senderData.audioQueue.push(frame)
    sendQueuedAudioFrame(id)
}

/** the same audio to every sender */
async function sendAudioBuffer(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
    if (!Object.values(SENDERS).some((s) => s?.sender)) return

    // one frame per protocol present: each library takes its own frame shape
    const frames: { [tag: string]: any } = {}
    for (const id of Object.keys(SENDERS)) {
        const senderData = SENDERS[id]
        if (!senderData?.sender) continue

        const tag = senderData.adapter.tag
        if (!(tag in frames)) frames[tag] = await makeAudioFrame(senderData.adapter, buffer, sampleRate, channelCount)
        if (!frames[tag]) continue

        if (!senderData.audioQueue) senderData.audioQueue = []
        senderData.audioQueue.push({ ...frames[tag] })
        sendQueuedAudioFrame(id)
    }
}

function startStats() {
    let lastCpu = process.cpuUsage()
    let lastCpuAt = Date.now()
    setInterval(() => {
        const nowCpu = process.cpuUsage()
        const nowAt = Date.now()
        const cpuCores = (nowCpu.user + nowCpu.system - lastCpu.user - lastCpu.system) / 1000 / Math.max(1, nowAt - lastCpuAt)
        lastCpu = nowCpu
        lastCpuAt = nowAt
        const rb = loadOsrCapture()?._readbackBackend?.() ?? "?"
        for (const [id, s] of Object.entries(SENDERS)) {
            if (!s?.sender) continue
            const sends = (s.sentReal || 0) + (s.sentRepeat || 0)
            const avg = sends ? Math.round((s.sendMsSum || 0) / sends) : 0
            let gapMean = 0
            let gapP95 = 0
            const gaps = s.realGaps || []
            if (gaps.length) {
                gapMean = gaps.reduce((a, b) => a + b, 0) / gaps.length
                const sorted = [...gaps].sort((a, b) => a - b)
                gapP95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
            }
            console.info(`[SEND-STATS ${s.adapter.tag}#${id}] sentReal=${s.sentReal || 0} sentRepeat=${s.sentRepeat || 0} coalescedReal=${s.coalescedReal || 0} paceQ=${s.paceQueue?.length || 0} paceMisses=${s.paceMisses || 0} paceBusy=${s.paceBusy || 0} wireGap(mean=${Math.round(gapMean)} p95=${Math.round(gapP95)}) avgSendMs=${avg} rejected=${s.sendRejected || 0} rb=${rb} cpuCores=${cpuCores.toFixed(2)}`)
            s.sentReal = 0
            s.sentRepeat = 0
            s.coalescedReal = 0
            s.sendRejected = 0
            s.paceMisses = 0
            s.paceBusy = 0
            s.sendMsSum = 0
            gaps.length = 0
        }
    }, 1000)
}

/**
 * in:  create, destroy, video, audio, audioTarget, captureFrame
 * out: status, createFailed, videoDone, releaseTexture, captureDone, scaledFrame
 */
export function runSenderWorker(adapters: SenderAdapter[]) {
    for (const a of adapters) ADAPTERS[a.tag] = a
    DEFAULT_ADAPTER = adapters[0]
    if (process.env.FS_CAP_STATS) startStats()

    port.on("message", (msg: any) => {
        switch (msg?.type) {
            case "create":
                createSender(msg.id, msg)
                break
            case "destroy":
                stopSender(msg.id)
                break
            case "video":
                sendVideoBuffer(msg.id, Buffer.from(msg.buffer, msg.byteOffset, msg.byteLength), msg.opts)
                break
            case "captureFrame":
                captureAndSend(msg.id, msg.source, msg.opts)
                break
            case "cpuFrame": {
                // a frame that could not be captured as a shared texture: main read it back once and
                // every consumer's version is derived here
                const osr = loadOsrCapture()
                const buf = Buffer.from(msg.buffer, msg.byteOffset, msg.byteLength)
                const { id, size, server, stage, preview } = msg
                if (!osr || typeof osr.previewFrame !== "function") break
                const rgbaAt = (maxWidth: number) => osr.previewFrame(buf, size.width, size.height, 0, maxWidth)
                try {
                    if (server) {
                        const f = rgbaAt(server.width)
                        port.postMessage({ type: "serverFrame", id, buffer: f.data, size: { width: f.width, height: f.height } }, [f.data.buffer])
                    }
                    if (stage) {
                        const f = rgbaAt(stage.width)
                        encodeStageFrame(id, msg.members || [id], f.data, { width: f.width, height: f.height, quality: stage.quality, intervalMs: stage.intervalMs })
                    }
                    if (preview) {
                        const f = rgbaAt(preview.width)
                        previewFrames().deliver(id, "PREVIEW", id, { xres: f.width, yres: f.height, format: "rgba", data: f.data }, Date.now(), true)
                    }
                } catch (err: any) {
                    console.error("cpu frame fan-out failed:", err?.message)
                }
                break
            }
            case "videoSource":
                connectVideoSource(msg.targetId, msg.outputId, msg.port, msg.token)
                break
            case "previewReset":
                if (previewServer) for (const m of Object.keys(previewServer.targets())) previewServer.drop(m)
                break
            case "presentReset":
                if (presentServer) for (const m of Object.keys(presentServer.targets())) presentServer.drop(m)
                break
            case "webrtcReset":
                if (webrtcServer) for (const m of Object.keys(webrtcServer.targets())) webrtcServer.drop(m)
                break
            case "audio":
                sendAudioBuffer(Buffer.from(msg.buffer, msg.byteOffset, msg.byteLength), msg.opts)
                break
            case "audioTarget":
                sendAudioBufferTarget(msg.id, Buffer.from(msg.buffer, msg.byteOffset, msg.byteLength), msg.opts)
                break
        }
    })
}
