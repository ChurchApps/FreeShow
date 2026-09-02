import { parentPort } from "worker_threads"

// NDI engine in a worker_thread: colour-convert, padding and grandiose send-dispatch all run off the
// main thread. NdiSender on the main thread is a thin proxy that forwards messages here.

if (!parentPort) throw new Error("ndiWorker must be run as a worker_thread")
const port = parentPort

const BYTES_PER_FLOAT32 = 4
const CONNECTION_POLL_INTERVAL_MS = 250
const TIMECODE_DIVISOR = BigInt(100)

const timeStart = BigInt(Date.now()) * BigInt(1e6) - process.hrtime.bigint()

// grandiose (native NDI addon), loaded inside the worker
let grandioseModule: any | null = null
let grandiosePromise: Promise<any | null> | null = null
let warned = false
const loadGrandiose = async () => {
    if (grandioseModule) return grandioseModule
    if (grandiosePromise) return grandiosePromise

    grandiosePromise = import("grandiose")
        .then((imported) => {
            grandioseModule = imported
            return imported
        })
        .catch((err: any) => {
            if (!warned) console.warn("NDI not available:", err?.message || err)
            warned = true
            return null
        })
        .finally(() => {
            grandiosePromise = null
        })

    return grandiosePromise
}

type Sender = {
    name: string
    groups?: string
    status?: string
    previousStatus?: string
    sender?: any
    timer?: NodeJS.Timeout
    sendingVideo?: boolean
    pendingVideoFrame?: any
    sendingAudio?: boolean
    audioQueue?: any[]
    offMain?: boolean
    pendingReal?: boolean // meta for pendingVideoFrame: true = fresh capture (real), false = repeat (main path only)
    coalescedReal?: number // FS_CAP_STATS: REAL frames lost — pace-queue overflow (off-main) / pending-slot overwrite (main)
    sendMsSum?: number // FS_CAP_STATS: total ms spent inside sender.video() this window
    sentReal?: number // FS_CAP_STATS: completed sends of REAL frames this window (= true wire-unique fps)
    sentRepeat?: number // FS_CAP_STATS: completed sends of repeated frames (fresh timecode, same pixels)
    // send-side pacer (off-main path): FIFO of real frames + one drift-corrected pace timer at the
    // configured frame interval. Each tick sends exactly one frame (oldest real, else a repeat with a
    // fresh timecode) — the receiver plays at our send-call cadence, so evening the sends evens playback.
    paceQueue?: { frame: any; pbuf: PacerBuf }[]
    lastPace?: { frame: any; pbuf: PacerBuf } // newest real frame, pinned (refcounted) for repeats
    paceTimer?: NodeJS.Timeout
    paceNextDue?: number // absolute-timeline schedule (nextDue += interval) — drift-corrected, no setTimeout creep
    paceInterval?: number // 1000/captureFramerate (configured intent, same source scheduleRepeat used)
    paceCap?: number // queue capacity = renderer's derived depth_r + 1 (measured/derived, not tuned)
    paceMisses?: number // FS_CAP_STATS: ticks with no queued real frame -> repeat sent
    // a busy tick is simply skipped (the frame re-quantizes to the next tick); re-running skipped
    // ticks on send completion worsens jitter
    paceBusy?: number // FS_CAP_STATS: ticks skipped because the previous send was still in flight
    lastRealSendAt?: number // wire-side evenness: Date.now() of the previous REAL send call
    realGaps?: number[] // FS_CAP_STATS: gaps between consecutive REAL send calls this window (mean/p95 reported)
}
const NDI: { [id: string]: Sender } = {}

// FS_CAP_STATS: once/sec per sender — sentReal (wire-unique fps), sentRepeat (static re-sends),
// coalescedReal (real frames lost at the send stage), pacer counters, wireGap (send evenness),
// rb (the addon's readback backend), cpuCores (process-wide CPU per window)
if (process.env.FS_CAP_STATS) {
    let lastCpu = process.cpuUsage()
    let lastCpuAt = Date.now()
    setInterval(() => {
        const nowCpu = process.cpuUsage()
        const nowAt = Date.now()
        const cpuCores = (nowCpu.user + nowCpu.system - lastCpu.user - lastCpu.system) / 1000 / Math.max(1, nowAt - lastCpuAt)
        lastCpu = nowCpu
        lastCpuAt = nowAt
        const rb = loadOsrCapture()?._readbackBackend?.() ?? "?"
        for (const id of Object.keys(NDI)) {
            const s = NDI[id]
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
            console.info(
                `[SEND-STATS ${id}] sentReal=${s.sentReal || 0} sentRepeat=${s.sentRepeat || 0} coalescedReal=${s.coalescedReal || 0} paceQ=${s.paceQueue?.length || 0} paceMisses=${s.paceMisses || 0} paceBusy=${s.paceBusy || 0} wireGap(mean=${Math.round(gapMean)} p95=${Math.round(gapP95)}) avgSendMs=${avg} rb=${rb} cpuCores=${cpuCores.toFixed(2)}`
            )
            s.sentReal = 0
            s.sentRepeat = 0
            s.coalescedReal = 0
            s.paceMisses = 0
            s.paceBusy = 0
            s.sendMsSum = 0
            gaps.length = 0
        }
    }, 1000)
}

async function createSender(id: string, name: string, groups?: string) {
    // replace an existing sender instead of skipping the create
    if (NDI[id]) stopSender(id)

    NDI[id] = { name, groups }
    console.info("NDI - creating sender: " + name, groups ? `; In group: ${groups}` : "")

    try {
        const grandiose = await loadGrandiose()
        if (!grandiose) {
            delete NDI[id]
            port.postMessage({ type: "createFailed", id })
            return
        }

        /* eslint @typescript-eslint/await-thenable: 0 */
        const sender = await grandiose.send({ name, groups, clockVideo: false, clockAudio: false })

        // if stopSender was called while `await grandiose.send` was in progress, the entry is gone —
        // destroy the freshly created sender instead of leaking it
        if (!NDI[id]) {
            try {
                sender.destroy()
            } catch {}
            return
        }

        NDI[id].sender = sender
    } catch (err) {
        console.error("Could not create NDI sender:", err)
        delete NDI[id]
        port.postMessage({ type: "createFailed", id })
        return
    }

    NDI[id].timer = setInterval(() => {
        if (!NDI[id]?.sender) return
        const conns: number = NDI[id].sender?.connections() || 0
        if (!NDI[id]) return
        NDI[id].status = conns > 0 ? "connected" : "unconnected"

        const newStatus = String(NDI[id].status) + conns.toString()
        if (newStatus !== NDI[id].previousStatus) {
            port.postMessage({ type: "status", id, status: NDI[id].status, connections: conns })
            NDI[id].previousStatus = newStatus
            if (NDI[id].status === "connected") console.log(`[NDI] Reconnected for ${id}`)
        }
    }, CONNECTION_POLL_INTERVAL_MS)
}

function stopSender(id: string) {
    // tear down even when the timer/sender never got assigned (e.g. destroy arriving while createSender
    // is still awaiting grandiose.send — deleting the entry makes createSender's race guard fire)
    if (!NDI[id]) return
    console.info("NDI - stopping sender: " + (NDI[id].name || id))
    if (NDI[id].timer) clearInterval(NDI[id].timer)

    if (NDI[id].sender) {
        try {
            NDI[id].sender.destroy()
        } catch (err) {
            console.error("ERROR", err)
        }
    }

    // pacer teardown: stop the tick, release every ref this sender holds (queue entries + the lastPace pin).
    // An in-flight paceSend holds its own ref and releases it in its finally — releasePacerRef only recycles
    // at refcount 0 and only into a still-existing pool, so nothing is recycled or leaked mid-send.
    const s = NDI[id]
    if (s.paceTimer) clearTimeout(s.paceTimer)
    for (const entry of s.paceQueue || []) releasePacerRef(entry.pbuf)
    s.paceQueue = []
    const pin = s.lastPace
    if (pin) {
        releasePacerRef(pin.pbuf)
        s.lastPace = undefined
    }
    delete pacerPools[id] // renderer's pacer free list (members never own one); unreturned bufs just GC
    // free the worker's reused readback buffers for this output. Off-main uses per-seq slotted keys (id#0/id#1),
    // each with its own pooled main + scaled buffers, so release every slot ever allocated (high-water mark).
    try {
        const osr = loadOsrCapture()
        osr?.releasePool?.(id)
        const allocated = readbackSlots[id]?.next ?? 0
        for (let s = 0; s < allocated; s++) osr?.releasePool?.(`${id}#${s}`)
    } catch {
        // ignore
    }
    delete readbackSlots[id]
    delete NDI[id]
}

async function sendQueuedVideoFrame(id: string) {
    const senderData = NDI[id]
    if (!senderData?.sender || senderData.sendingVideo) return

    const frame = senderData.pendingVideoFrame
    if (!frame) return

    // claim frame + meta ATOMICALLY (before any await) so a concurrent enqueue can't desync them
    const wasReal = senderData.pendingReal === true
    senderData.pendingVideoFrame = undefined
    senderData.pendingReal = undefined
    senderData.sendingVideo = true

    const sendT0 = process.env.FS_CAP_STATS ? Date.now() : 0
    try {
        await senderData.sender.video(frame)
    } catch (err) {
        console.error("Error sending NDI video frame:", err)
    } finally {
        if (sendT0) {
            senderData.sendMsSum = (senderData.sendMsSum || 0) + (Date.now() - sendT0)
            if (wasReal) senderData.sentReal = (senderData.sentReal || 0) + 1
            else senderData.sentRepeat = (senderData.sentRepeat || 0) + 1
        }
        senderData.sendingVideo = false
        // videoDone only drives the MAIN-path in-flight counter; the off-main capture path uses captureDone
        // instead, so posting videoDone for it just floods the main thread (~100 useless msgs/s at 2 outputs).
        if (!senderData.offMain) port.postMessage({ type: "videoDone", id })
        if (senderData.pendingVideoFrame) void sendQueuedVideoFrame(id)
    }
}

// native BGRA->UYVY/UYVA converter from osr-capture (an order of magnitude faster than the JS loops
// below, which stay as a fallback for older builds / platforms without it). Loaded lazily in the worker.
let osrCaptureModule: any = null
function loadOsrCapture(): any {
    if (osrCaptureModule !== null) return osrCaptureModule
    try {
        const m = require("osr-capture")
        osrCaptureModule = typeof m?.convertBgraToUyvy === "function" ? m : false
    } catch {
        osrCaptureModule = false
    }
    return osrCaptureModule
}

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
            const b0 = bgra[si], g0 = bgra[si + 1], r0 = bgra[si + 2]
            const b1 = bgra[si + 4], g1 = bgra[si + 5], r1 = bgra[si + 6]
            let u = (((-43 * r0 - 85 * g0 + 128 * b0) >> 8) + 128)
            let v = (((128 * r0 - 107 * g0 - 21 * b0) >> 8) + 128)
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
            const b0 = bgra[si], g0 = bgra[si + 1], r0 = bgra[si + 2], a0 = bgra[si + 3]
            const b1 = bgra[si + 4], g1 = bgra[si + 5], r1 = bgra[si + 6], a1 = bgra[si + 7]
            let u = (((-43 * r0 - 85 * g0 + 128 * b0) >> 8) + 128)
            let v = (((128 * r0 - 107 * g0 - 21 * b0) >> 8) + 128)
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

// format: 0 = BGRA (convert here), 1 = UYVY (already converted, opaque), 2 = UYVA (already converted, alpha)
async function sendVideoBuffer(id: string, buffer: Buffer, { size, ratio, framerate, transparent, format = 0 }: { size: { width: number; height: number }; ratio: number; framerate: number; transparent: boolean; format?: number }) {
    const senderData = NDI[id]
    if (!senderData?.sender) return
    senderData.offMain = false

    const grandiose = await loadGrandiose()
    if (!grandiose) return

    // NDI's wire format is UYVY 4:2:2; sending it directly skips the SDK's (slow, esp. at 4K) BGRA->UYVY
    // conversion. If osr-capture already converted on the GPU (format 1/2) send as-is; otherwise convert the
    // BGRA here (native osr-capture, JS fallback) to UYVA (transparent) / UYVY (opaque).
    const useAlpha = transparent !== false
    let data: Buffer
    let fourCC: number
    if (format === 2 || format === 1) {
        data = buffer
        fourCC = format === 2 ? grandiose.FOURCC_UYVA : grandiose.FOURCC_UYVY
    } else {
        const osr = loadOsrCapture()
        if (useAlpha) {
            data = osr ? osr.convertBgraToUyva(buffer, size.width, size.height) : bgraToUyva(buffer, size.width, size.height)
            fourCC = grandiose.FOURCC_UYVA
        } else {
            data = osr ? osr.convertBgraToUyvy(buffer, size.width, size.height) : bgraToUyvy(buffer, size.width, size.height)
            fourCC = grandiose.FOURCC_UYVY
        }
    }

    // main-path frames are always real; count the loss if we overwrite a pending unsent real frame
    if (senderData.pendingVideoFrame && senderData.pendingReal) senderData.coalescedReal = (senderData.coalescedReal || 0) + 1
    senderData.pendingReal = true
    senderData.pendingVideoFrame = {
        timecode: (timeStart + process.hrtime.bigint()) / TIMECODE_DIVISOR,
        xres: size.width,
        yres: size.height,
        frameRateN: framerate * 1000,
        frameRateD: 1000,
        pictureAspectRatio: ratio,
        frameFormatType: grandiose.FORMAT_TYPE_PROGRESSIVE,
        lineStrideBytes: size.width * 2,
        fourCC,
        data
    }

    void sendQueuedVideoFrame(id)
}

// free readback-slot pool per output: concurrent captures can finish out of order, so each needs a
// distinct osr-capture key. Allocated on demand (main bounds concurrency with its in-flight depth);
// stopSender releases every slot ever allocated.
const readbackSlots: { [id: string]: { free: number[]; next: number } } = {}
function acquireReadbackSlot(id: string): number {
    const pool = (readbackSlots[id] ||= { free: [], next: 0 })
    return pool.free.length ? pool.free.pop()! : pool.next++
}
function releaseReadbackSlot(id: string, slot: number) {
    const pool = (readbackSlots[id] ||= { free: [], next: 0 })
    if (!pool.free.includes(slot)) pool.free.push(slot)
}

// ---- send-side pacer (even wire delivery) ----
// The receiver plays frames at our send-call cadence, so clumped sends mean juddery playback no matter
// how many unique frames get through. Per sender: a FIFO of real frames + one pace timer at the
// configured frame interval; every tick sends exactly one frame — the oldest queued real if any, else a
// repeat of the newest real with a fresh timecode. Clumps drain over multiple ticks; static content
// holds the NDI keepalive rate.
//
// Ownership: the pooled readback buffer is memcpy'd once per capture into a pacer-owned recycled
// Buffer; one refcounted copy is shared across all fan-out members. Holders (one ref each): every
// queue entry, each member's lastPace pin, each in-flight send. The Buffer returns to the free list
// only at refcount 0, so it can never be recycled while anything still reads it.
type PacerBuf = { buf: Buffer; refs: number; owner: string }
const pacerPools: { [rendererId: string]: Buffer[] } = {}
function acquirePacerBuf(owner: string, length: number): PacerBuf {
    const pool = (pacerPools[owner] ||= [])
    const idx = pool.findIndex((b) => b.byteLength === length)
    if (idx >= 0) return { buf: pool.splice(idx, 1)[0], refs: 0, owner }
    // no match -> the size regime changed (resolution/alpha toggle); pooled bufs are unreferenced by
    // definition, so drop the stale ones instead of accumulating dead memory
    pool.length = 0
    return { buf: Buffer.allocUnsafe(length), refs: 0, owner }
}
function releasePacerRef(pb: PacerBuf) {
    pb.refs--
    if (pb.refs > 0) return
    const pool = pacerPools[pb.owner]
    if (pool && !pool.includes(pb.buf)) pool.push(pb.buf)
}

// drift-corrected pace loop: ticks are scheduled against an ABSOLUTE timeline (nextDue += interval), so
// setTimeout callback latency never accumulates into cadence drift. If the loop falls behind (event-loop
// stall), it RESYNCS to now + interval — never burst-fires to catch up (each tick sends exactly one frame).
function startPacer(id: string) {
    const s = NDI[id]
    if (!s || s.paceTimer) return
    s.paceNextDue = Date.now() + (s.paceInterval || 1000 / 30)
    schedulePaceTick(id)
}
function schedulePaceTick(id: string) {
    const s = NDI[id]
    if (!s) return
    const delay = Math.max(0, (s.paceNextDue || 0) - Date.now())
    s.paceTimer = setTimeout(() => {
        const sd = NDI[id]
        if (!sd) return // stopped
        const interval = sd.paceInterval || 1000 / 30
        sd.paceNextDue = (sd.paceNextDue || Date.now()) + interval
        if (sd.paceNextDue < Date.now()) sd.paceNextDue = Date.now() + interval // resync, don't burst
        paceTick(id)
        schedulePaceTick(id)
    }, delay)
}

function paceTick(id: string) {
    const s = NDI[id]
    if (!s?.sender) return
    if (s.sendingVideo) {
        // previous send still in flight — skip this tick; the frame re-quantizes to the next one
        s.paceBusy = (s.paceBusy || 0) + 1
        return
    }
    const entry = s.paceQueue?.shift()
    if (entry) {
        // real frame: the queue's ref TRANSFERS to the send (released in paceSend's finally)
        void paceSend(id, entry, true)
        return
    }
    if (s.lastPace) {
        // no fresh content this tick — repeat the newest real frame to hold the wire cadence.
        // take a send-ref so the buffer stays valid even if lastPace is replaced mid-send.
        s.paceMisses = (s.paceMisses || 0) + 1
        s.lastPace.pbuf.refs++
        void paceSend(id, s.lastPace, false)
    }
}

async function paceSend(id: string, entry: { frame: any; pbuf: PacerBuf }, real: boolean) {
    const senderData = NDI[id]
    if (!senderData?.sender) {
        releasePacerRef(entry.pbuf)
        return
    }
    senderData.sendingVideo = true
    if (real) {
        // wire-side evenness telemetry: gap between consecutive REAL send calls (acceptance ≈ 1× tick interval)
        const now = Date.now()
        if (process.env.FS_CAP_STATS && senderData.lastRealSendAt) (senderData.realGaps ||= []).push(now - senderData.lastRealSendAt)
        senderData.lastRealSendAt = now
    }
    // fresh timecode at SEND time for real and repeat alike — the wire cadence is the pacer's, not the capture's
    const frame = { ...entry.frame, timecode: (timeStart + process.hrtime.bigint()) / TIMECODE_DIVISOR }
    const sendT0 = process.env.FS_CAP_STATS ? Date.now() : 0
    try {
        await senderData.sender.video(frame)
    } catch (err) {
        console.error("Error sending NDI video frame:", err)
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
// ---- end pacer -------------------------------------------------------------------------------------------

// off-main capture-and-send: the worker reads back the shared texture AND sends, so the main process
// never touches frame data — it only forwards the texture handle (Windows/mac shared handle, Linux
// { planes, modifier }). The addon converts to UYVY/UYVA on the GPU during readback.
async function captureAndSend(id: string, source: any, opts: { size: { width: number; height: number }; ratio: number; framerate: number; memberFramerates?: { [id: string]: number }; format: number; transparent?: boolean; dstW?: number; dstH?: number; seq?: number; members?: string[]; depth?: number }) {
    // seq identifies this in-flight capture; the osr-capture key is slotted so concurrent readbacks
    // for one output use independent pool entries
    const seq = opts.seq ?? 0
    const senderData = NDI[id]
    const osr = loadOsrCapture()
    const grandiose = await loadGrandiose()
    if (!senderData?.sender || !osr?.readback || !grandiose) {
        port.postMessage({ type: "releaseTexture", id, seq })
        port.postMessage({ type: "captureDone", id, seq })
        return
    }
    const { size, ratio, framerate, format, dstW = 0, dstH = 0 } = opts
    // FS_CAP_STATS: per-frame hop timestamps posted back with captureDone (worker_threads share the
    // process clock, so main can difference them against its forward time)
    const tl = process.env.FS_CAP_STATS ? { recv: Date.now(), cS: 0, cE: 0, fS: 0, fE: 0, enq: 0 } : null
    // shared-render: one readback fans out to every group member's sender ([id] when sharing is off)
    const members = opts.members?.length ? opts.members : [id]
    // GPU downscale (server/stage) only works via the Windows two-phase readback; ignore it otherwise
    const wantScaled = dstW > 0 && dstH > 0
    // captures can complete out of order, so a seq%N key is unsafe — the free-slot pool guarantees
    // concurrent captures always use distinct keys
    const slot = acquireReadbackSlot(id)
    const rbKey = `${id}#${slot}`
    senderData.offMain = true
    // prefer the two-phase path: its consume callback releases the Electron texture synchronously at
    // the GPU-done boundary, so the compositor frame pool never starves
    const twoPhase = typeof osr.readbackConsume === "function" && typeof osr.readbackFinish === "function"
    const singleDispatch = !twoPhase && typeof osr.readbackOnce === "function"
    let textureReleased = false
    // Tell main it can RELEASE the Electron shared texture (frees the compositor frame pool). In two-phase
    // this happens right after the GPU consume; otherwise after the whole readback.
    const releaseTexture = () => {
        if (textureReleased) return
        textureReleased = true
        port.postMessage({ type: "releaseTexture", id, seq })
    }
    try {
        // NDI frame data (UYVY/UYVA); a mixed output also gets a GPU-downscaled small BGRA (`scaled`)
        // for server/stage in the same pass
        let buffer: Buffer
        let scaled: Buffer | undefined
        if (singleDispatch) {
            // one dispatch: releaseTexture fires from the addon's onRelease callback at the GPU-done boundary
            if (tl) tl.cS = Date.now()
            const onRelease = () => {
                if (tl && !tl.cE) tl.cE = tl.fS = Date.now()
                releaseTexture()
            }
            const res = await osr.readbackOnce(source, size.width, size.height, format, rbKey, wantScaled ? dstW : 0, wantScaled ? dstH : 0, onRelease)
            if (tl) {
                tl.fE = Date.now()
                if (!tl.cE) tl.cE = tl.fS = tl.fE // release never fired (early error) — collapse the split
            }
            releaseTexture() // safety: no-op if onRelease already released
            if (wantScaled && res && res.main) {
                buffer = res.main
                scaled = res.scaled
            } else {
                buffer = res
            }
        } else if (twoPhase) {
            // phase 1: GPU-convert (+ GPU-downscale when wantScaled) + wait for the GPU to finish reading the
            // shared texture -> release it early
            if (tl) tl.cS = Date.now()
            await osr.readbackConsume(source, size.width, size.height, format, rbKey, wantScaled ? dstW : 0, wantScaled ? dstH : 0)
            if (tl) tl.cE = Date.now()
            releaseTexture()
            // phase 2: the slow PCIe copy-out (texture already released, so the compositor isn't stalled)
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
            // single-phase (mac/linux): no GPU downscale -> NDI only (mixed stays on the main path there)
            if (tl) tl.cS = Date.now()
            buffer = await osr.readback(source, size.width, size.height, format, rbKey)
            if (tl) tl.cE = tl.fS = tl.fE = Date.now() // one phase: consume spans it all, finish is empty
            releaseTexture()
        }

        // ship the GPU-downscaled server/stage buffer to main (COPY via structured clone, NOT transfer — it is
        // a reused pooled buffer, so detaching it would corrupt the pool). Do this before captureDone frees the slot.
        if (scaled && scaled.length) {
            port.postMessage({ type: "scaledFrame", id, members, buffer: scaled.buffer, byteOffset: scaled.byteOffset, byteLength: scaled.byteLength, size: { width: dstW, height: dstH } })
        }

        const fourCC: number = format === 2 ? grandiose.FOURCC_UYVA : grandiose.FOURCC_UYVY

        // pacer hand-off: copy the pooled readback buffer once into a pacer-owned recycled Buffer and
        // enqueue that — the addon slot is free to recycle at captureDone (below) without any frame the
        // pacer still holds ever tearing. ONE refcounted copy is shared across all fan-out members.
        const activeMembers = members.filter((m) => NDI[m]?.sender)
        if (activeMembers.length) {
            const pbuf = acquirePacerBuf(id, buffer.length)
            buffer.copy(pbuf.buf, 0, 0, buffer.length)
            // frame template — timecode is re-stamped at each send (the pacer owns the wire cadence)
            const frame = {
                timecode: (timeStart + process.hrtime.bigint()) / TIMECODE_DIVISOR,
                xres: size.width,
                yres: size.height,
                frameRateN: framerate * 1000,
                frameRateD: 1000,
                pictureAspectRatio: ratio,
                frameFormatType: grandiose.FORMAT_TYPE_PROGRESSIVE,
                lineStrideBytes: size.width * 2,
                fourCC,
                data: pbuf.buf
            }
            for (const m of activeMembers) {
                const md = NDI[m]!
                md.offMain = true
                // per-member pace rate: each member's sender paces at its own resolved framerate
                // (configured when connected, idle floor when not) — never the renderer's, whose idle
                // floor would throttle a connected follower
                const mfr = Math.max(1, opts.memberFramerates?.[m] || framerate)
                md.paceInterval = 1000 / mfr
                // rate rose while the pacer runs (e.g. idle floor -> receiver connected): re-phase the tick
                // to the new interval now instead of letting the old (long) due play out one last time
                if (md.paceTimer && md.paceNextDue && md.paceNextDue > Date.now() + md.paceInterval) {
                    clearTimeout(md.paceTimer)
                    md.paceTimer = undefined
                    startPacer(m)
                }
                const mFrame = mfr === framerate ? frame : { ...frame, frameRateN: mfr * 1000 }
                // queue capacity = the renderer's DERIVED depth_r (passed from main) + 1 [UNIVERSAL headroom].
                // Arrival clumps are ≤ depth by admission construction, so overflow means arrivals exceeded
                // the cadence — drop the OLDEST (keep freshest, bound latency) and count it as coalescedReal
                // (unique frames lost at the send stage; conservation sentReal+coalescedReal ≈ done holds).
                md.paceCap = Math.max(2, (opts.depth ?? 1) + 1)
                const queue = (md.paceQueue ||= [])
                while (queue.length >= md.paceCap) {
                    const dropped = queue.shift()!
                    releasePacerRef(dropped.pbuf)
                    md.coalescedReal = (md.coalescedReal || 0) + 1
                }
                pbuf.refs++ // queue entry's ref
                queue.push({ frame: mFrame, pbuf })
                pbuf.refs++ // lastPace pin's ref (repeats only fire when the queue is empty, i.e. this
                if (md.lastPace) releasePacerRef(md.lastPace.pbuf) // frame has already been sent or dropped)
                md.lastPace = { frame: mFrame, pbuf }
                startPacer(m)
            }
        }
        if (tl) tl.enq = Date.now() // pacer enqueue complete (memcpy + fan-out done) — nonzero = clean path
    } catch (err) {
        console.error("NDI worker readback error:", err)
    } finally {
        releaseTexture() // safety: ensure the texture is released even on error
        releaseReadbackSlot(id, slot)
        // capture fully done -> this pipeline slot frees (main may forward another frame for this output)
        port.postMessage({ type: "captureDone", id, seq, tl })
    }
}

// ---- audio -----------------------------------------------------------------------------------------------
// Buffers arrive already as planar/float32/little-endian PCM (the renderer converts); frames carry no
// timecode and NDI stamps them at send time. Each sender has its own FIFO audioQueue drained by a serial
// send loop, with a hard cap so a stalled sender can't accumulate unbounded memory/latency.
async function sendQueuedAudioFrame(id: string) {
    const senderData = NDI[id]
    if (!senderData?.sender || senderData.sendingAudio) return

    senderData.sendingAudio = true

    try {
        while (senderData.audioQueue && senderData.audioQueue.length > 0) {
            if (!NDI[id]?.sender) break

            // Limit queue to prevent excessive memory/latency if sending is falling behind
            if (senderData.audioQueue.length > 50) {
                senderData.audioQueue.splice(0, senderData.audioQueue.length - 20)
            }

            const frame = senderData.audioQueue.shift()
            if (frame) {
                await senderData.sender.audio(frame)
            }
        }
    } catch (err) {
        console.error("Error sending NDI audio frame:", err)
    } finally {
        senderData.sendingAudio = false
        if (NDI[id]?.sender && senderData.audioQueue && senderData.audioQueue.length > 0) {
            void sendQueuedAudioFrame(id)
        }
    }
}

async function makeAudioFrame(buffer: Buffer, sampleRate: number, channelCount: number) {
    if (!buffer || buffer.length === 0) return null

    const grandiose = await loadGrandiose()
    if (!grandiose) return null

    const noSamples = Math.trunc(buffer.length / (channelCount * BYTES_PER_FLOAT32))
    if (noSamples <= 0) return null

    return {
        sampleRate,
        noChannels: channelCount,
        noSamples,
        channelStrideBytes: noSamples * BYTES_PER_FLOAT32,
        fourCC: grandiose.FOURCC_FLTp,
        data: buffer
    }
}

async function sendAudioBufferTarget(id: string, buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
    const senderData = NDI[id]
    if (!senderData?.sender) return

    const frame = await makeAudioFrame(buffer, sampleRate, channelCount)
    if (!frame || !NDI[id]?.sender) return

    if (!senderData.audioQueue) senderData.audioQueue = []
    senderData.audioQueue.push(frame)
    void sendQueuedAudioFrame(id)
}

async function sendAudioBuffer(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
    const hasSender = Object.values(NDI).some((s) => s?.sender)
    if (!hasSender) return

    const frame = await makeAudioFrame(buffer, sampleRate, channelCount)
    if (!frame) return

    Object.keys(NDI).forEach((id) => {
        const senderData = NDI[id]
        if (!senderData?.sender) return

        if (!senderData.audioQueue) senderData.audioQueue = []
        senderData.audioQueue.push({ ...frame })
        void sendQueuedAudioFrame(id)
    })
}
// ---- end audio -------------------------------------------------------------------------------------------

port.on("message", (msg: any) => {
    switch (msg?.type) {
        case "create":
            void createSender(msg.id, msg.name, msg.groups)
            break
        case "video":
            sendVideoBuffer(msg.id, Buffer.from(msg.buffer, msg.byteOffset, msg.byteLength), msg.opts)
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
        case "destroy":
            stopSender(msg.id)
            break
    }
})
