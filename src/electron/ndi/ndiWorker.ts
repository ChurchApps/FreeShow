import os from "os"
import { parentPort } from "worker_threads"
import util from "./vingester-util"

// render-overhaul #17: NDI engine running in a worker_thread so all colour-convert, 16-byte padding and
// grandiose send-dispatch happen OFF the main thread. The main process only does the (main-thread-bound)
// capturePage/paint readback and transfers the resulting buffer here. This mirrors the proven NdiSender
// logic exactly; NdiSender on the main thread is now a thin proxy that forwards messages to this worker.

if (!parentPort) throw new Error("ndiWorker must be run as a worker_thread")
const port = parentPort

const BYTES_PER_PIXEL = 4
const BYTES_PER_FLOAT32 = 4
const PADDING_ALIGNMENT = 16
const CONNECTION_POLL_INTERVAL_MS = 1000
const TIMECODE_DIVISOR = BigInt(100)
const IS_BIG_ENDIAN = os.endianness() === "BE"

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
    paddedVideoBuffer?: Buffer
    paddedVideoBufferStride?: number
    paddedVideoBufferHeight?: number
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
        await senderData.sender.video(frame)
    } catch (err) {
        console.error("Error sending NDI video frame:", err)
    } finally {
        senderData.sendingVideo = false
        // let the main-thread proxy clear its busy flag so the next frame is produced (drop-to-latest)
        port.postMessage({ type: "videoDone", id })
        if (senderData.pendingVideoFrame) void sendQueuedVideoFrame(id)
    }
}

function copyRowsToPaddedBuffer(source: Buffer, dest: Buffer, size: { width: number; height: number }, stride: number) {
    const rowBytes = size.width * BYTES_PER_PIXEL
    for (let y = 0; y < size.height; y++) {
        source.copy(dest, y * stride, y * rowBytes, (y + 1) * rowBytes)
    }
}

function getPaddedBuffer(senderData: Sender, buffer: Buffer, size: { width: number; height: number }, stride: number, paddedWidth: number): Buffer {
    if (paddedWidth === size.width) return buffer

    if (senderData.paddedVideoBuffer && senderData.paddedVideoBufferStride === stride && senderData.paddedVideoBufferHeight === size.height) {
        const cachedBuffer = senderData.paddedVideoBuffer
        copyRowsToPaddedBuffer(buffer, cachedBuffer, size, stride)
        return cachedBuffer
    }

    const paddedBuffer = Buffer.alloc(stride * size.height)
    senderData.paddedVideoBuffer = paddedBuffer
    senderData.paddedVideoBufferStride = stride
    senderData.paddedVideoBufferHeight = size.height

    copyRowsToPaddedBuffer(buffer, paddedBuffer, size, stride)
    return paddedBuffer
}

async function sendVideoBuffer(id: string, buffer: Buffer, { size, ratio, framerate, transparent }: { size: { width: number; height: number }; ratio: number; framerate: number; transparent: boolean }) {
    const senderData = NDI[id]
    if (!senderData?.sender) return

    const grandiose = await loadGrandiose()
    if (!grandiose) return

    if (IS_BIG_ENDIAN) util.ImageBufferAdjustment.ARGBtoBGRA(buffer)

    const fourCC = transparent ? grandiose.FOURCC_BGRA : grandiose.FOURCC_BGRX
    if (!transparent) util.ImageBufferAdjustment.BGRAtoBGRX(buffer)

    const timecode = (timeStart + process.hrtime.bigint()) / TIMECODE_DIVISOR

    const paddedWidth = (size.width + PADDING_ALIGNMENT - 1) & ~(PADDING_ALIGNMENT - 1)
    const stride = paddedWidth * BYTES_PER_PIXEL
    const sendBuffer = getPaddedBuffer(senderData, buffer, size, stride, paddedWidth)

    senderData.pendingVideoFrame = {
        timecode,
        xres: paddedWidth,
        yres: size.height,
        frameRateN: framerate * 1000,
        frameRateD: 1000,
        pictureAspectRatio: ratio,
        frameFormatType: grandiose.FORMAT_TYPE_PROGRESSIVE,
        lineStrideBytes: stride,
        fourCC,
        data: sendBuffer
    }

    void sendQueuedVideoFrame(id)
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
        case "audio":
            sendAudioBuffer(Buffer.from(msg.buffer, msg.byteOffset, msg.byteLength), msg.opts)
            break
        case "destroy":
            stopSender(msg.id)
            break
    }
})
