// import pcmconvert from "pcm-converter"
import os from "os"
import { isLinux, toApp } from ".."
import { updateFramerate } from "./capture"
import util from "./vingester-util"

// WIP - NDI issue on Linux: libndi.so.5: No such file or dialog

const ndiDisabled = isLinux && os.arch() !== "x64" && os.arch() !== "ia32"

// Resources:
// https://www.npmjs.com/package/grandiose-mac
// https://github.com/Streampunk/grandiose
// https://github.com/rse/grandiose
// https://github.com/rse/vingester

// TODO: audio

let timeStart = BigInt(Date.now()) * BigInt(1e6) - process.hrtime.bigint()

// RECEIVER

export async function findStreamsNDI(): Promise<any> {
    if (ndiDisabled) return
    const grandiose = require("grandiose")

    return new Promise((resolve, reject) => {
        grandiose
            .find({ showLocalSources: true })
            .then((a: any) => {
                // embedded, destroy(), sources(), wait()
                // sources = [{ name: "<source_name>", urlAddress: "<IP-address>:<port>" }]
                // this is returned as JSON string
                resolve(a.sources())
            })
            .catch((err: any) => reject(err))
    })
}

const receiverTimeout = 5000
export async function receiveStreamFrameNDI({ source }: any) {
    if (ndiDisabled) return
    const grandiose = require("grandiose")

    let receiver = await grandiose.receive({ source })

    try {
        let videoFrame = await receiver.video(receiverTimeout)
        sendBuffer(source.id, videoFrame)
    } catch (err) {
        console.error(err)
    }
}

// let previewSize: Size = { width: 320, height: 180 }
export function sendBuffer(id: string, frame: any) {
    if (!frame) return

    frame.data = Buffer.from(frame.data)
    toApp("NDI", { channel: "RECEIVE_STREAM", data: { id, frame } })

    // const image: NativeImage = nativeImage.createFromBuffer(frame.data)
    // // image = resizeImage(image, {width: frame.xres, height: frame.yres}, previewSize)
    // const buffer = image.getBitmap()

    // /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
    // if (os.endianness() === "BE") util.ImageBufferAdjustment.ARGBtoRGBA(buffer)
    // else util.ImageBufferAdjustment.BGRAtoRGBA(buffer)

    // frame.data = buffer
    // toApp("NDI", { channel: "RECEIVE_STREAM", data: { id, frame } })
}

export async function captureStreamNDI({ source, frameRate }: any) {
    if (NDI_RECEIVERS[source.id]) return

    if (ndiDisabled) return
    const grandiose = require("grandiose")

    NDI_RECEIVERS[source.id] = {
        frameRate: frameRate || 0.1,
    }
    NDI_RECEIVERS[source.id].receiver = await grandiose.receive({ source })

    try {
        NDI_RECEIVERS[source.id].interval = setInterval(async () => {
            let videoFrame = await NDI_RECEIVERS[source.id].receiver.video(receiverTimeout)

            toApp("NDI", { channel: "RECEIVE_STREAM", data: { id: source.id, frame: videoFrame } })
        }, NDI_RECEIVERS[source.id].frameRate * 1000)
    } catch (err) {
        console.error(err)
    }
}

let NDI_RECEIVERS: any = {}
export function stopReceiversNDI(data: any = null) {
    if (data.id) {
        clearInterval(NDI_RECEIVERS[data.id].interval)
        delete NDI_RECEIVERS[data.id]
        return
    }

    Object.values(NDI_RECEIVERS).forEach((interval: any) => {
        clearInterval(interval)
    })

    NDI_RECEIVERS = {}
}

// SENDER

export function stopSenderNDI(id: string) {
    if (!NDI[id]?.timer) return

    console.log("NDI - stopping sender: " + NDI[id].name)
    clearInterval(NDI[id].timer)

    try {
        NDI[id].sender.destroy()
    } catch (error) {
        console.log("ERROR", error)
    }

    delete NDI[id]
}

export let NDI: any = {}
export async function createSenderNDI(id: string, title: string = "") {
    if (ndiDisabled) return
    const grandiose = require("grandiose")

    if (NDI[id]) return
    NDI[id] = {}

    NDI[id].name = "FreeShow NDI"
    if (title) NDI[id].name = NDI[id].name + " - " + title
    console.log("NDI - creating sender: " + NDI[id].name)

    let error = false

    try {
        NDI[id].sender = await grandiose.send({
            name: NDI[id].name,
            clockVideo: false,
            clockAudio: false,
        })
    } catch (err) {
        console.log("Could not create NDI sender:", err)
        error = true
    }

    if (error) {
        delete NDI[id]
        return
    }

    NDI[id].timer = setInterval(() => {
        /*  poll NDI for connections  */
        const conns = NDI[id].sender?.connections() || 0

        NDI[id].status = "unconnected"
        if (conns > 0) NDI[id].status = "connected"

        let newStatus = NDI[id].status + conns
        if (newStatus !== NDI[id].previousStatus) {
            toApp("NDI", { channel: "SEND_DATA", data: { id, status: NDI[id].status, connections: conns } })
            updateFramerate(id)

            NDI[id].previousStatus = newStatus
        }
    }, 1000)
}

export async function sendVideoBufferNDI(id: string, buffer: any, { size = { width: 1280, height: 720 }, ratio = 16 / 9, framerate = 1 }) {
    if (!NDI[id]?.sender) return

    if (ndiDisabled) return
    const grandiose = require("grandiose")

    /*  convert from ARGB (Electron/Chromium on big endian CPU)
        to BGRA (supported input of NDI SDK). On little endian
        CPU the input is already BGRA.  */
    if (os.endianness() === "BE") {
        util.ImageBufferAdjustment.ARGBtoBGRA(buffer)
    }

    /*  optionally convert from BGRA to BGRX (no alpha channel)  */
    let fourCC = (grandiose as any).FOURCC_BGRA
    // if (!this.cfg.v) {
    //     util.ImageBufferAdjustment.BGRAtoBGRX(buffer)
    //     fourCC = grandiose.FOURCC_BGRX
    // }

    /*  send NDI video frame  */
    const now = timeStart + process.hrtime.bigint()
    const timecode = now / BigInt(100)
    const bytesForBGRA = 4
    const frame = {
        /*  base information  */
        // type: "video",
        timecode,

        /*  type-specific information  */
        xres: size.width,
        yres: size.height,
        frameRateN: framerate * 1000,
        frameRateD: 1000,
        pictureAspectRatio: ratio,
        frameFormatType: (grandiose as any).FORMAT_TYPE_PROGRESSIVE,
        lineStrideBytes: size.width * bytesForBGRA,

        /*  the data itself  */
        fourCC,
        data: buffer,
    }

    try {
        await NDI[id].sender.video(frame)
    } catch (error) {
        console.log(error)
    }
}

// TODO: audio ??
export async function sendAudioBufferNDI(id: string, buffer: Buffer, { sampleRate, noChannels, bytesForFloat32 }: any) {
    if (!NDI[id].sender) return

    if (ndiDisabled) return
    const grandiose = require("grandiose")

    /*  convert from PCM/signed-16-bit/little-endian data
        to NDI's "PCM/planar/signed-float32/little-endian  */
    const pcmconvert: any = {} // TODO:
    const buffer2 = pcmconvert(
        buffer,
        {
            channels: noChannels,
            dtype: "int16",
            endianness: "le",
            interleaved: true,
        },
        {
            dtype: "float32",
            endianness: "le",
            interleaved: false,
        }
    )

    /*  create frame  */
    const now = timeStart + process.hrtime.bigint()
    const timecode = now / BigInt(100)
    const frame = {
        /*  base information  */
        timecode,

        /*  type-specific information  */
        sampleRate,
        noChannels,
        noSamples: Math.trunc(buffer2.byteLength / noChannels / bytesForFloat32),
        channelStrideBytes: Math.trunc(buffer2.byteLength / noChannels),

        /*  the data itself  */
        fourCC: (grandiose as any).FOURCC_FLTp,
        data: buffer2,
    }

    await NDI[id].sender.audio(frame)
}
