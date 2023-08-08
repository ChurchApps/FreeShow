import os from "os"
import grandiose from "grandiose"
// import type { VideoFrame } from "grandiose"
import util from "./vingester-util"
import { toApp } from ".."
import { captures } from "./capture"

// Resources:
// https://www.npmjs.com/package/grandiose-mac
// https://github.com/Streampunk/grandiose
// https://github.com/rse/grandiose
// https://github.com/rse/vingester

// TODO: audio

let timeStart = BigInt(Date.now()) * BigInt(1e6) - process.hrtime.bigint()

export async function findStreamsNDI(): Promise<any> {
    return new Promise((resolve, reject) => {
        grandiose
            .find({ showLocalSources: true })
            .then((a) => {
                console.log(1, a)
                resolve(a)
            })
            .catch((err) => reject(err))
    })
}

// let source = { name: "<source_name>", urlAddress: "<IP-address>:<port>" };
export async function receiveStreamNDI({ source }: any) {
    if (receivers[source.urlAddress]) return

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
    if (!NDI[id].timer) return

    console.log("NDI - stopping sender: " + NDI[id].name)
    clearInterval(NDI[id].timer)

    NDI[id].sender.destroy()
    delete NDI[id]
}

let NDI: any = {}
export async function createSenderNDI(id: string, title: string = "") {
    if (NDI[id]) return
    NDI[id] = {}

    NDI[id].name = "FreeShow NDI"
    if (title) NDI[id].name = NDI[id].name + " - " + title
    console.log("NDI - creating sender: " + NDI[id].name)

    try {
        NDI[id].sender = await grandiose.send({
            name: NDI[id].name,
            clockVideo: false,
            clockAudio: false,
        })
    } catch (error) {
        console.log("ERROR", error)
    }

    NDI[id].timer = setInterval(() => {
        /*  poll NDI for connections and tally status  */
        const conns = NDI[id].sender?.connections() || {}
        const tally = NDI[id].sender?.tally() || {}

        /*  determine our Vingester "tally status"  */
        NDI[id].status = "unconnected"
        if (tally.on_program) NDI[id].status = "program"
        else if (tally.on_preview) NDI[id].status = "preview"
        else if (conns > 0) NDI[id].status = "connected"

        // console.log(NDI[id].status)
        if (NDI[id].status !== NDI[id].previousStatus) toApp("NDI", { channel: "SEND_DATA", data: { status: NDI[id].status, connections: conns } })
        NDI[id].previousStatus = NDI[id].status

        if (captures[id]) captures[id].frameRate = framerates[NDI[id].status]
    }, 500)
}

const framerates: any = {
    unconnected: 1,
    program: 30,
    preview: 5,
    connected: 60,
}

export async function sendBufferNDI(id: string, buffer: any, { size = { width: 1280, height: 720 }, ratio = 16 / 9, frameRate = 1 }) {
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
        frameRateN: frameRate * 1000,
        frameRateD: 1000,
        pictureAspectRatio: ratio,
        frameFormatType: (grandiose as any).FORMAT_TYPE_PROGRESSIVE,
        lineStrideBytes: size.width * bytesForBGRA,

        /*  the data itself  */
        fourCC,
        data: buffer,
    }

    if (!NDI[id].sender) return

    try {
        await NDI[id].sender.video(frame)
    } catch (error) {
        console.log(error)
    }
}
