import { parentPort } from "worker_threads"

// render-overhaul #17: NDI engine running in a worker_thread so all colour-convert, 16-byte padding and
// grandiose send-dispatch happen OFF the main thread. The main process only does the (main-thread-bound)
// capturePage/paint readback and transfers the resulting buffer here. This mirrors the proven NdiSender
// logic exactly; NdiSender on the main thread is now a thin proxy that forwards messages to this worker.

if (!parentPort) throw new Error("ndiWorker must be run as a worker_thread")
const port = parentPort

// confirm the enlarged libuv thread pool propagated to this worker (readbacks + NDI sends run on it)
console.info(`[NDI-WORKER] started; UV_THREADPOOL_SIZE=${process.env.UV_THREADPOOL_SIZE || "(default 4)"}`)

const BYTES_PER_FLOAT32 = 4
const CONNECTION_POLL_INTERVAL_MS = 250
const TIMECODE_DIVISOR = BigInt(100)

const timeStart = BigInt(Date.now()) * BigInt(1e6) - process.hrtime.bigint()
let audioSamplesSent: bigint | null = null

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
    lastFmtLabel?: string
    // off-main capture path (NDI-only outputs): the worker does readback+send itself
    repeatTimer?: NodeJS.Timeout
    lastFrame?: any
    captureFramerate?: number
    offMain?: boolean
    // diagnostics
    path?: string
    lastReadbackMs?: number
    realN?: number
    repeatN?: number
}
const NDI: { [id: string]: Sender } = {}

async function createSender(id: string, name: string, groups?: string) {
    if (NDI[id]) return

    NDI[id] = { name, groups }
    console.info("NDI - creating sender: " + name, groups ? `; In group: ${groups}` : "")

    try {
        const grandiose = await loadGrandiose()
        if (!grandiose) return

        /* eslint @typescript-eslint/await-thenable: 0 */
        NDI[id].sender = await grandiose.send({ name, groups, clockVideo: false, clockAudio: false })
    } catch (err) {
        console.error("Could not create NDI sender:", err)
        delete NDI[id]
        return
    }

    NDI[id].timer = setInterval(() => {
        const conns: number = NDI[id]?.sender?.connections() || 0
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
    if (!NDI[id]?.timer) return
    console.info("NDI - stopping sender: " + NDI[id].name)
    clearInterval(NDI[id].timer)

    try {
        NDI[id].sender.destroy()
    } catch (err) {
        console.error("ERROR", err)
    }

    if (NDI[id].repeatTimer) clearTimeout(NDI[id].repeatTimer)
    // free the worker's reused readback buffers for this output. Off-main uses per-seq slotted keys (id#0/id#1),
    // each with its own pooled main + scaled buffers, so release every slot.
    try {
        const osr = loadOsrCapture()
        osr?.releasePool?.(id)
        for (let s = 0; s < OFF_MAIN_SLOTS; s++) osr?.releasePool?.(`${id}#${s}`)
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

    senderData.pendingVideoFrame = undefined
    senderData.sendingVideo = true

    try {
        const vt = Date.now()
        await senderData.sender.video(frame)
        logUyvyTiming(id, (senderData as any).lastConvertMs || 0, Date.now() - vt)
    } catch (err) {
        console.error("Error sending NDI video frame:", err)
    } finally {
        senderData.sendingVideo = false
        // videoDone only drives the MAIN-path in-flight counter; the off-main capture path uses captureDone
        // instead, so posting videoDone for it just floods the main thread (~100 useless msgs/s at 2 outputs).
        if (!senderData.offMain) port.postMessage({ type: "videoDone", id })
        if (senderData.pendingVideoFrame) void sendQueuedVideoFrame(id)
    }
}

// #18: native BGRA->UYVY/UYVA converter from osr-capture (an order of magnitude faster than the JS loops
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

// #18: integer/fixed-point BGRA -> UYVY packed 4:2:2 (BT.601 full range, coefficients scaled by 256).
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

// #18: BGRA -> UYVA = UYVY colour plane (width*2*height) immediately followed by a full-res alpha plane
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

const uyvyTiming: { [id: string]: { conv: number; vid: number; n: number; last: number } } = {}
function logUyvyTiming(id: string, convMs: number, videoMs: number) {
    let t = uyvyTiming[id]
    if (!t) t = uyvyTiming[id] = { conv: 0, vid: 0, n: 0, last: Date.now() }
    t.conv += convMs
    t.vid += videoMs
    t.n++
    const now = Date.now()
    if (now - t.last >= 1000) {
        const sd = NDI[id]
        const conns = sd?.sender?.connections?.() ?? -1
        const info = sd?.lastFmtLabel || "?"
        const path = sd?.path || "?"
        const rb = sd?.lastReadbackMs ?? -1
        const real = sd?.realN || 0
        const rep = sd?.repeatN || 0
        console.info(`[NDI-UYVY] ${id}: ${t.n}/s  ${path}  ${info}  video() ${(t.vid / t.n).toFixed(0)}ms  readback ${rb}ms  real ${real}/s repeat ${rep}/s  conns ${conns}`)
        if (sd) {
            sd.realN = 0
            sd.repeatN = 0
        }
        t.conv = 0
        t.vid = 0
        t.n = 0
        t.last = now
    }
}

// format: 0 = BGRA (convert here), 1 = UYVY (already converted, opaque), 2 = UYVA (already converted, alpha)
async function sendVideoBuffer(id: string, buffer: Buffer, { size, ratio, framerate, transparent, format = 0 }: { size: { width: number; height: number }; ratio: number; framerate: number; transparent: boolean; format?: number }) {
    const senderData = NDI[id]
    if (!senderData?.sender) return
    senderData.path = "MAIN"
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
        ;(senderData as any).lastFmtLabel = `${format === 2 ? "UYVA" : "UYVY"} ${size.width}x${size.height}`
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

// Free readback-slot pool per output. Off-main captures for one output run concurrently (pipelined) and can
// finish out of order, so each needs a distinct osr-capture key; slots are recycled here. The count matches the
// main-side max in-flight (FS_INFLIGHT, default 2), so a slot is always free; a fallback slot 0 is returned if
// somehow exhausted. stopSender releases every slot.
const OFF_MAIN_SLOTS = Math.max(1, parseInt(process.env.FS_INFLIGHT || "2", 10) || 2)
const freshSlotPool = () => Array.from({ length: OFF_MAIN_SLOTS }, (_, i) => i)
const readbackSlots: { [id: string]: number[] } = {}
function acquireReadbackSlot(id: string): number {
    const pool = (readbackSlots[id] ||= freshSlotPool())
    return pool.length ? pool.pop()! : 0
}
function releaseReadbackSlot(id: string, slot: number) {
    const pool = (readbackSlots[id] ||= freshSlotPool())
    if (!pool.includes(slot)) pool.push(slot)
}

// OFF-MAIN capture-and-send (NDI-only outputs): the worker reads back the shared texture AND sends, so the
// MAIN process never touches 4K frame data — it only forwards the 8-byte texture handle. `source` is the
// Windows/mac shared handle (Buffer) or the Linux { planes, modifier }. osr-capture converts to UYVY/UYVA on
// the GPU during readback (format 1/2), so no CPU convert here. After readback (which copies the texture) we
// tell main it can release the texture. This removes the ~16-25MB/frame main-thread copy entirely, which is
// what caps multi-4K.
async function captureAndSend(id: string, source: any, opts: { size: { width: number; height: number }; ratio: number; framerate: number; format: number; transparent?: boolean; dstW?: number; dstH?: number; seq?: number; members?: string[] }) {
    // seq identifies this in-flight capture (main pipelines up to OFF_MAIN_MAX_INFLIGHT of them). The osr-capture
    // key is slotted by seq so two concurrent readbacks for this output use independent pending/pool entries.
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
    // shared-render: one readback fans out to every group member's sender ([id] when sharing is off)
    const members = opts.members?.length ? opts.members : [id]
    // GPU downscale (server/stage) only works via the Windows two-phase readback; ignore it otherwise
    const wantScaled = dstW > 0 && dstH > 0
    // Acquire a free readback slot for this output. Main pipelines up to OFF_MAIN_MAX_INFLIGHT captures, which
    // can COMPLETE out of order, so a seq%N key is unsafe (a straggler + a new frame can collide). A free-slot
    // pool guarantees the concurrent captures for this output always use distinct osr-capture keys.
    const slot = acquireReadbackSlot(id)
    const rbKey = `${id}#${slot}`
    senderData.path = "OFF-MAIN"
    senderData.offMain = true
    const twoPhase = typeof osr.readbackConsume === "function" && typeof osr.readbackFinish === "function"
    let textureReleased = false
    // Tell main it can RELEASE the Electron shared texture (frees the compositor frame pool). In two-phase
    // this happens right after the GPU consume; otherwise after the whole readback.
    const releaseTexture = () => {
        if (textureReleased) return
        textureReleased = true
        port.postMessage({ type: "releaseTexture", id, seq })
    }
    try {
        const rbStart = Date.now()
        // NDI frame data (UYVY/UYVA). For a mixed output the addon ALSO returns a GPU-downscaled small BGRA
        // (`scaled`) for server/stage — read back in the same pass, so only ~16MB + a few MB cross PCIe.
        let buffer: Buffer
        let scaled: Buffer | undefined
        if (twoPhase) {
            // phase 1: GPU-convert (+ GPU-downscale when wantScaled) + wait for the GPU to finish reading the
            // shared texture -> release it early
            await osr.readbackConsume(source, size.width, size.height, format, rbKey, wantScaled ? dstW : 0, wantScaled ? dstH : 0)
            releaseTexture()
            // phase 2: the slow PCIe copy-out (texture already released, so the compositor isn't stalled)
            const res = await osr.readbackFinish(rbKey, size.width, size.height, format, wantScaled ? dstW : 0, wantScaled ? dstH : 0)
            if (wantScaled && res && res.main) {
                buffer = res.main
                scaled = res.scaled
            } else {
                buffer = res
            }
        } else {
            // single-phase (mac/linux): no GPU downscale -> NDI only (mixed stays on the main path there)
            buffer = await osr.readback(source, size.width, size.height, format, rbKey)
            releaseTexture()
        }
        senderData.lastReadbackMs = Date.now() - rbStart
        senderData.realN = (senderData.realN || 0) + 1

        // ship the GPU-downscaled server/stage buffer to main (COPY via structured clone, NOT transfer — it is
        // a reused pooled buffer, so detaching it would corrupt the pool). Do this before captureDone frees the slot.
        if (scaled && scaled.length) {
            port.postMessage({ type: "scaledFrame", id, members, buffer: scaled.buffer, byteOffset: scaled.byteOffset, byteLength: scaled.byteLength, size: { width: dstW, height: dstH } })
        }

        const fourCC: number = format === 2 ? grandiose.FOURCC_UYVA : grandiose.FOURCC_UYVY
        senderData.lastFmtLabel = `${format === 2 ? "UYVA" : "UYVY"} ${size.width}x${size.height}${wantScaled ? " +s" : ""}${members.length > 1 ? ` x${members.length}` : ""}`

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
            data: buffer
        }
        // fan the SAME readback out to every member's sender (renderer is members[0]). The UYVY buffer is read
        // read-only by grandiose's async send, so multiple senders can share it safely; the pool keeps it valid.
        for (const m of members) {
            const md = NDI[m]
            if (!md?.sender) continue
            md.pendingVideoFrame = frame
            md.lastFrame = frame
            md.captureFramerate = framerate
            md.path = "OFF-MAIN"
            md.offMain = true
            void sendQueuedVideoFrame(m)
            scheduleRepeat(m)
        }
    } catch (err) {
        console.error("NDI worker readback error:", err)
    } finally {
        releaseTexture() // safety: ensure the texture is released even on error
        releaseReadbackSlot(id, slot)
        // capture fully done -> this pipeline slot frees (main may forward another frame for this output)
        port.postMessage({ type: "captureDone", id, seq })
    }
}

// Hold a constant output rate on static content: if no new frame is forwarded within a frame interval,
// re-send the last frame (fresh timecode, no new pixels). Reset on every real captured frame.
function scheduleRepeat(id: string) {
    const s = NDI[id]
    if (!s) return
    if (s.repeatTimer) clearTimeout(s.repeatTimer)
    const interval = Math.max(1, Math.round(1000 / Math.max(1, s.captureFramerate || 30)))
    s.repeatTimer = setTimeout(() => {
        const sd = NDI[id]
        if (sd?.sender && sd.lastFrame) {
            sd.pendingVideoFrame = { ...sd.lastFrame, timecode: (timeStart + process.hrtime.bigint()) / TIMECODE_DIVISOR }
            sd.repeatN = (sd.repeatN || 0) + 1
            void sendQueuedVideoFrame(id)
        }
        scheduleRepeat(id)
    }, interval)
}

async function sendAudioBuffer(ndiAudioBuffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
    const activeSender = Object.values(NDI).find((s) => s?.sender)
    if (!activeSender) return

    const grandiose = await loadGrandiose()
    if (!grandiose) return

    const noSamples = Math.trunc(ndiAudioBuffer.byteLength / channelCount / BYTES_PER_FLOAT32)
    const currentHrTime = process.hrtime.bigint()

    if (audioSamplesSent === null || audioSamplesSent === undefined) {
        audioSamplesSent = (currentHrTime * BigInt(sampleRate)) / BigInt(1e9)
    } else {
        const expectedHrTime = (audioSamplesSent * BigInt(1e9)) / BigInt(sampleRate)
        const driftMs = Number(currentHrTime - expectedHrTime) / 1e6
        if (Math.abs(driftMs) > 500) audioSamplesSent = (currentHrTime * BigInt(sampleRate)) / BigInt(1e9)
    }

    const timecode = (timeStart + (audioSamplesSent * BigInt(1e9)) / BigInt(sampleRate)) / TIMECODE_DIVISOR
    audioSamplesSent += BigInt(noSamples)

    const frame = {
        timecode,
        sampleRate,
        noChannels: channelCount,
        noSamples,
        channelStrideBytes: Math.trunc(ndiAudioBuffer.byteLength / channelCount),
        fourCC: grandiose.FOURCC_FLTp,
        data: ndiAudioBuffer
    }

    Object.values(NDI).forEach((data) => {
        if (!data?.sender) return
        try {
            data.sender.audio(frame)
        } catch (err) {
            console.error("Error sending NDI audio frame:", err)
        }
    })
}

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
            sendAudioBuffer(Buffer.from(msg.buffer, msg.byteOffset, msg.byteLength), msg.opts)
            break
        case "destroy":
            stopSender(msg.id)
            break
    }
})
