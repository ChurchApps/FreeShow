import { parentPort } from "worker_threads"

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
let ADAPTER: SenderAdapter

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
    if (SENDERS[id]) {
        stopSender(id)
        if (ADAPTER.recreateDelayMs) await new Promise((resolve) => setTimeout(resolve, ADAPTER.recreateDelayMs))
    }

    const name: string = msg.name
    SENDERS[id] = { name }
    console.info(`${ADAPTER.label} - creating sender: ` + name + (ADAPTER.describe?.(msg) || ""))

    try {
        const lib = await ADAPTER.load()
        const created = lib ? await ADAPTER.create(lib, id, msg) : null
        if (!created) {
            delete SENDERS[id]
            port.postMessage({ type: "createFailed", id })
            return
        }

        // destroy arriving while the create was in progress: destroy instead of leaking
        if (!SENDERS[id]) {
            try {
                ADAPTER.destroy(created.sender)
            } catch {}
            return
        }

        SENDERS[id].sender = created.sender
        SENDERS[id].sendFrame = created.sendFrame
        SENDERS[id].sendAudio = created.sendAudio
        SENDERS[id].tsKey = created.tsKey
    } catch (err) {
        console.error(`Could not create ${ADAPTER.label} sender:`, err)
        delete SENDERS[id]
        port.postMessage({ type: "createFailed", id })
        return
    }

    SENDERS[id].timer = setInterval(() => {
        const s = SENDERS[id]
        if (!s?.sender) return
        const conns = ADAPTER.connections(s.sender)
        s.status = conns > 0 ? "connected" : "unconnected"

        const newStatus = String(s.status) + conns.toString()
        if (newStatus !== s.previousStatus) {
            port.postMessage({ type: "status", id, status: s.status, connections: conns })
            s.previousStatus = newStatus
            if (s.status === "connected") console.log(`[${ADAPTER.label}] Reconnected for ${id}`)
        }
    }, CONNECTION_POLL_INTERVAL_MS)
}

function stopSender(id: string) {
    // tear down even when the sender never got assigned: deleting the entry makes the race guard in
    // createSender fire if a create is still awaiting the library
    const s = SENDERS[id]
    if (!s) return
    console.info(`${ADAPTER.label} - stopping sender: ` + (s.name || id))
    if (s.timer) clearInterval(s.timer)

    if (s.sender) {
        try {
            ADAPTER.destroy(s.sender)
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
    if (ADAPTER.connections(senderData.sender) <= 0) return
    senderData.sendRejected = (senderData.sendRejected || 0) + 1
    if (senderData.rejectLogged) return
    senderData.rejectLogged = true
    console.error(`${ADAPTER.label} sender ${id} rejected a video frame: ${frame.width || frame.xres}x${frame.height || frame.yres} stride=${frame.stride || frame.lineStrideBytes} bytes=${frame.data?.length}`)
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

    const lib = await ADAPTER.load()
    if (!lib) return

    const prepared = ADAPTER.prepareVideo(lib, buffer, opts.size, opts.format ?? 0, opts.transparent !== false)

    // main-path frames are always real; count the loss when overwriting an unsent one
    if (senderData.pendingVideoFrame && senderData.pendingReal) senderData.coalescedReal = (senderData.coalescedReal || 0) + 1
    senderData.pendingReal = true
    senderData.pendingVideoFrame = ADAPTER.videoFrame(lib, prepared.data, { ...opts, format: prepared.format })

    void sendQueuedVideoFrame(id)
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
        void paceSend(id, entry, true)
        return
    }
    if (s.lastPace) {
        s.paceMisses = (s.paceMisses || 0) + 1
        s.lastPace.pbuf.refs++
        void paceSend(id, s.lastPace, false)
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
function enqueuePaced(id: string, frame: any, pbuf: PacerBuf, framerate: number, depth: number) {
    const s = SENDERS[id]
    if (!s) return
    s.offMain = true
    s.paceInterval = 1000 / framerate
    if (s.paceTimer && s.paceNextDue && s.paceNextDue > Date.now() + s.paceInterval) {
        clearTimeout(s.paceTimer)
        s.paceTimer = undefined
        startPacer(id)
    }
    s.paceCap = Math.max(2, depth + 1)
    const queue = (s.paceQueue ||= [])
    while (queue.length >= s.paceCap) {
        const dropped = queue.shift()!
        releasePacerRef(dropped.pbuf)
        s.coalescedReal = (s.coalescedReal || 0) + 1
    }
    pbuf.refs++ // queue entry's ref
    queue.push({ frame, pbuf })
    pbuf.refs++ // lastPace pin's ref (repeats only fire when the queue is empty, i.e. this frame has
    if (s.lastPace) releasePacerRef(s.lastPace.pbuf) // already been sent or dropped)
    s.lastPace = { frame, pbuf }
    startPacer(id)
}

export type CaptureOpts = { size: FrameSize; ratio: number; framerate: number; memberFramerates?: { [id: string]: number }; format: number; transparent?: boolean; dstW?: number; dstH?: number; seq?: number; members?: string[]; depth?: number }

// reads the output's shared GPU texture back, then fans that one readback out to every output sharing
// the render, each at its own framerate
async function captureAndSend(id: string, source: any, opts: CaptureOpts) {
    // seq identifies this in-flight capture; the osr-capture key is slotted so concurrent readbacks for
    // one output use independent pool entries
    const seq = opts.seq ?? 0
    const senderData = SENDERS[id]
    const osr = loadOsrCapture()
    const lib = senderData?.sender ? await ADAPTER.load() : null
    if (!lib || !osr?.readback) {
        port.postMessage({ type: "releaseTexture", id, seq })
        port.postMessage({ type: "captureDone", id, seq })
        return
    }
    const { size, ratio, framerate, format, dstW = 0, dstH = 0 } = opts
    // FS_CAP_STATS: per-frame hop timestamps posted back with captureDone
    const tl = process.env.FS_CAP_STATS ? { recv: Date.now(), cS: 0, cE: 0, fS: 0, fE: 0, enq: 0 } : null
    const members = opts.members?.length ? opts.members : [id]
    const wantScaled = dstW > 0 && dstH > 0
    const slot = acquireReadbackSlot(id)
    const rbKey = `${id}#${slot}`
    senderData!.offMain = true
    const twoPhase = typeof osr.readbackConsume === "function" && typeof osr.readbackFinish === "function"
    const singleDispatch = !twoPhase && typeof osr.readbackOnce === "function"
    let textureReleased = false
    const releaseTexture = () => {
        if (textureReleased) return
        textureReleased = true
        port.postMessage({ type: "releaseTexture", id, seq })
    }
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
            await osr.readbackConsume(source, size.width, size.height, format, rbKey, wantScaled ? dstW : 0, wantScaled ? dstH : 0)
            if (tl) tl.cE = Date.now()
            releaseTexture()
            if (tl) tl.fS = Date.now()
            const res = await osr.readbackFinish(rbKey, size.width, size.height, format, wantScaled ? dstW : 0, wantScaled ? dstH : 0)
            if (tl) tl.fE = Date.now()
            if (wantScaled && res && res.main) {
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

        if (scaled && scaled.length) {
            port.postMessage({ type: "scaledFrame", id, members, buffer: scaled.buffer, byteOffset: scaled.byteOffset, byteLength: scaled.byteLength, size: { width: dstW, height: dstH } })
        }

        const activeMembers = members.filter((m) => SENDERS[m]?.sender)
        if (activeMembers.length) {
            const transparent = opts.transparent !== false
            const prepared = ADAPTER.prepareVideo(lib, buffer, size, format, transparent)
            // one copy, referenced by every output that queues it
            const pbuf = acquirePacerBuf(id, prepared.data.length)
            prepared.data.copy(pbuf.buf, 0, 0, prepared.data.length)
            for (const m of activeMembers) {
                const mfr = Math.max(1, opts.memberFramerates?.[m] || framerate)
                const frame = ADAPTER.videoFrame(lib, pbuf.buf, { size, ratio, framerate: mfr, transparent, format: prepared.format })
                enqueuePaced(m, frame, pbuf, mfr, opts.depth ?? 1)
            }
        }
        if (tl) tl.enq = Date.now() // pacer enqueue complete (memcpy + fan-out done) — nonzero = clean path
    } catch (err) {
        console.error("Worker readback error:", err)
    } finally {
        releaseTexture() // safety: ensure the texture is released even on error
        releaseReadbackSlot(id, slot)
        // capture done: this pipeline slot frees, so main may forward another frame
        port.postMessage({ type: "captureDone", id, seq, tl })
    }
}

// Audio buffers arrive as planar float32 LE PCM. Each sender's FIFO queue is drained by a serial send
// loop, capped so a stalled sender can't accumulate unbounded memory/latency.
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
            void sendQueuedAudioFrame(id)
        }
    }
}

async function makeAudioFrame(buffer: Buffer, sampleRate: number, channelCount: number) {
    if (!buffer || buffer.length === 0) return null
    if (Math.trunc(buffer.length / (channelCount * BYTES_PER_FLOAT32)) <= 0) return null

    const lib = await ADAPTER.load()
    if (!lib) return null

    return ADAPTER.audioFrame(lib, buffer, sampleRate, channelCount)
}

/** audio for one output */
async function sendAudioBufferTarget(id: string, buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
    const senderData = SENDERS[id]
    if (!senderData?.sender) return

    const frame = await makeAudioFrame(buffer, sampleRate, channelCount)
    if (!frame || !SENDERS[id]?.sender) return

    if (!senderData.audioQueue) senderData.audioQueue = []
    senderData.audioQueue.push(frame)
    void sendQueuedAudioFrame(id)
}

/** the same audio to every sender */
async function sendAudioBuffer(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
    if (!Object.values(SENDERS).some((s) => s?.sender)) return

    const frame = await makeAudioFrame(buffer, sampleRate, channelCount)
    if (!frame) return

    Object.keys(SENDERS).forEach((id) => {
        const senderData = SENDERS[id]
        if (!senderData?.sender) return

        if (!senderData.audioQueue) senderData.audioQueue = []
        senderData.audioQueue.push({ ...frame })
        void sendQueuedAudioFrame(id)
    })
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
            console.info(`[SEND-STATS ${ADAPTER.tag}#${id}] sentReal=${s.sentReal || 0} sentRepeat=${s.sentRepeat || 0} coalescedReal=${s.coalescedReal || 0} paceQ=${s.paceQueue?.length || 0} paceMisses=${s.paceMisses || 0} paceBusy=${s.paceBusy || 0} wireGap(mean=${Math.round(gapMean)} p95=${Math.round(gapP95)}) avgSendMs=${avg} rejected=${s.sendRejected || 0} rb=${rb} cpuCores=${cpuCores.toFixed(2)}`)
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
export function runSenderWorker(adapter: SenderAdapter) {
    ADAPTER = adapter
    if (process.env.FS_CAP_STATS) startStats()

    port.on("message", (msg: any) => {
        switch (msg?.type) {
            case "create":
                void createSender(msg.id, msg)
                break
            case "destroy":
                stopSender(msg.id)
                break
            case "video":
                void sendVideoBuffer(msg.id, Buffer.from(msg.buffer, msg.byteOffset, msg.byteLength), msg.opts)
                break
            case "captureFrame":
                void captureAndSend(msg.id, msg.source, msg.opts)
                break
            case "audio":
                void sendAudioBuffer(Buffer.from(msg.buffer, msg.byteOffset, msg.byteLength), msg.opts)
                break
            case "audioTarget":
                void sendAudioBufferTarget(msg.id, Buffer.from(msg.buffer, msg.byteOffset, msg.byteLength), msg.opts)
                break
        }
    })
}
