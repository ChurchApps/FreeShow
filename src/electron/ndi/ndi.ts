// import grandiose from "grandiose"
import os from "os"
// import type { VideoFrame } from "grandiose"
import { toApp } from ".."
import { updateFramerate } from "./capture"
// import pcmconvert from "pcm-converter"
import util from "./vingester-util"

// Resources:
// https://www.npmjs.com/package/grandiose-mac
// https://github.com/Streampunk/grandiose
// https://github.com/rse/grandiose
// https://github.com/rse/vingester

// TODO: audio

let timeStart = BigInt(Date.now()) * BigInt(1e6) - process.hrtime.bigint()

export async function findStreamsNDI(): Promise<any> {
    // not linux
    if (os.platform() === "linux") return
    const grandiose = require("grandiose")

    return new Promise((resolve, reject) => {
        grandiose
            .find({ showLocalSources: true })
            .then((a: any) => {
                resolve(a)
            })
            .catch((err: any) => reject(err))
    })
}

// let source = { name: "<source_name>", urlAddress: "<IP-address>:<port>" };
export async function receiveStreamNDI({ source }: any) {
    if (receivers[source.urlAddress]) return

    // not linux
    if (os.platform() === "linux") return
    const grandiose = require("grandiose")

    let receiver = await grandiose.receive({ source })

    let timeout = 5000 // Optional timeout, default is 10000ms

    try {
        receivers[source.urlAddress] = setInterval(async () => {
            let videoFrame = await receiver.video(timeout)

            toApp("NDI", { channel: "RECEIVE_STREAM", data: videoFrame })
        }, 100)

        // for ( let x = 0 ; x < 10 ; x++) {
        //     let videoFrame = await receiver.video(timeout);
        //     return videoFrame
        // }
    } catch (e) {
        console.error(e)
    }
}

let receivers: any = {}
export function stopReceiversNDI() {
    Object.values(receivers).forEach((interval: any) => {
        clearInterval(interval)
    })

    receivers = {}
}

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
    // not linux
    if (os.platform() === "linux") return
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

    // not linux
    if (os.platform() === "linux") return
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

    // not linux
    if (os.platform() === "linux") return
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
