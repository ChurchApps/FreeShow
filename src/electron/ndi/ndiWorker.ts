import { loadOsrCapture, runSenderWorker, frameTimestamp, type FrameSize, type SenderAdapter, type VideoFrameOpts } from "../capture/senderWorker"

// NDI adapter for the shared sender engine (../capture/senderWorker): everything grandiose-specific.
//
// Resources:
// https://www.npmjs.com/package/grandiose-mac
// https://github.com/Streampunk/grandiose
// https://github.com/rse/grandiose
// https://github.com/rse/vingester

const BYTES_PER_FLOAT32 = 4

// grandiose (native NDI addon), loaded inside the worker
let grandioseModule: any | null = null
let grandiosePromise: Promise<any | null> | null = null
let warned = false
const loadGrandiose = async (): Promise<any | null> => {
    if (grandioseModule) return grandioseModule
    if (!grandiosePromise) {
        grandiosePromise = import("grandiose")
            .then((m: any) => {
                grandioseModule = m.default || m
                return grandioseModule
            })
            .catch((err) => {
                if (!warned) console.error("Could not load NDI module:", err)
                warned = true
                grandiosePromise = null
                return null
            })
    }
    return grandiosePromise
}

// integer/fixed-point BGRA -> UYVY packed 4:2:2 (BT.601 full range, coefficients scaled by 256);
// the fallback for platforms without osr-capture's native converter
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

// BGRA -> UYVA: a UYVY colour plane (width*2*height) followed by a full-res alpha plane (width*height)
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

const ndiAdapter: SenderAdapter = {
    tag: "ndi",
    label: "NDI",
    load: loadGrandiose,
    describe: (msg) => (msg.groups ? `; In group: ${msg.groups}` : ""),

    async create(grandiose: any, _id: string, msg: any) {
        /* eslint @typescript-eslint/await-thenable: 0 */
        const sender = await grandiose.send({ name: msg.name, groups: msg.groups, clockVideo: false, clockAudio: false })
        if (!sender) return null
        return { sender, sendFrame: (frame: any) => sender.video(frame), sendAudio: (frame: any) => sender.audio(frame), tsKey: "timecode" }
    },
    connections: (sender: any) => sender?.connections?.() || 0,
    destroy: (sender: any) => sender.destroy(),

    // NDI's wire format is UYVY 4:2:2, so sending it directly skips the SDK's own conversion: a frame
    // osr-capture converted on the GPU (format 1/2) goes as it is, BGRA is converted here
    prepareVideo(_grandiose: any, buffer: Buffer, size: FrameSize, format: number, transparent: boolean) {
        if (format === 1 || format === 2) return { data: buffer, format }

        const osr = loadOsrCapture()
        if (transparent) return { data: osr ? osr.convertBgraToUyva(buffer, size.width, size.height) : bgraToUyva(buffer, size.width, size.height), format: 2 }
        return { data: osr ? osr.convertBgraToUyvy(buffer, size.width, size.height) : bgraToUyvy(buffer, size.width, size.height), format: 1 }
    },

    videoFrame(grandiose: any, data: Buffer, { size, ratio, framerate, format }: VideoFrameOpts) {
        return {
            timecode: frameTimestamp(),
            xres: size.width,
            yres: size.height,
            frameRateN: Math.round(framerate * 1000),
            frameRateD: 1000,
            pictureAspectRatio: ratio,
            frameFormatType: grandiose.FORMAT_TYPE_PROGRESSIVE,
            lineStrideBytes: size.width * 2,
            fourCC: format === 2 ? grandiose.FOURCC_UYVA : grandiose.FOURCC_UYVY,
            data
        }
    },

    audioFrame(grandiose: any, buffer: Buffer, sampleRate: number, channelCount: number) {
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
}

runSenderWorker(ndiAdapter)
