import os from "os"
import { toApp } from ".."
import { CaptureHelper } from "../capture/CaptureHelper"
import { CaptureTransmitter } from "../capture/helpers/CaptureTransmitter"
import util from "./vingester-util"

// Resources:
// https://www.npmjs.com/package/grandiose-mac
// https://github.com/Streampunk/grandiose
// https://github.com/rse/grandiose
// https://github.com/rse/vingester

// TODO: audio
export class NdiSender {
    static ndiDisabled = false // isLinux && os.arch() !== "x64" && os.arch() !== "ia32"
    static timeStart = BigInt(Date.now()) * BigInt(1e6) - process.hrtime.bigint()
    static NDI: { [key: string]: { name: string; status?: string; previousStatus?: string; sender?: any; timer?: NodeJS.Timeout; sendAudio?: boolean } } = {}

    static stopSenderNDI(id: string) {
        if (!this.NDI[id]?.timer) return

        console.log("NDI - stopping sender: " + this.NDI[id].name)
        clearInterval(this.NDI[id].timer)

        try {
            this.NDI[id].sender.destroy()
        } catch (error) {
            console.log("ERROR", error)
        }

        delete this.NDI[id]
    }

    static async createSenderNDI(id: string, title: string = "") {
        if (this.ndiDisabled || this.NDI[id]) return
        const grandiose = require("grandiose")

        this.NDI[id] = { name: `FreeShow NDI${title ? ` - ${title}` : ""}` }
        console.log("NDI - creating sender: " + this.NDI[id].name)

        try {
            this.NDI[id].sender = await grandiose.send({
                name: this.NDI[id].name,
                clockVideo: false,
                clockAudio: false,
            })
        } catch (err) {
            console.log("Could not create NDI sender:", err)
            delete this.NDI[id]
            return
        }

        this.NDI[id].timer = setInterval(() => {
            /*  poll NDI for connections  */
            const conns = this.NDI[id].sender?.connections() || 0
            this.NDI[id].status = conns > 0 ? "connected" : "unconnected"

            let newStatus = this.NDI[id].status + conns
            if (newStatus !== this.NDI[id].previousStatus) {
                toApp("NDI", { channel: "SEND_DATA", data: { id, status: this.NDI[id].status, connections: conns } })
                CaptureHelper.updateFramerate(id)

                this.NDI[id].previousStatus = newStatus

                if (this.NDI[id].status === "connected") {
                    Object.keys(CaptureTransmitter.channels).forEach((key) => {
                        if (key.includes("ndi")) {
                            // force an instant check / output refresh when reconnected
                            CaptureTransmitter.channels[key].lastCheck = 999
                        }
                    })
                }
            }
        }, 1000)
    }

    static async sendVideoBufferNDI(id: string, buffer: Buffer, { size = { width: 1280, height: 720 }, ratio = 16 / 9, framerate = 1 }) {
        if (this.ndiDisabled || !this.NDI[id]?.sender) return
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
        const now = this.timeStart + process.hrtime.bigint()
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
            await this.NDI[id].sender.video(frame)
        } catch (err) {
            console.log("Error sending NDI video frame:", err)
        }
    }

    static enableAudio(id: string) {
        if (!this.NDI[id]) return
        this.NDI[id].sendAudio = true
    }

    static disableAudio(id: string) {
        if (!this.NDI[id]) return
        this.NDI[id].sendAudio = false
    }

    static bytesForFloat32 = 4
    static sendAudioBufferNDI(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
        if (this.ndiDisabled || !Object.values(this.NDI).find((a) => a?.sendAudio)) return
        const grandiose = require("grandiose")

        const ndiAudioBuffer = convertPCMtoPlanarFloat32(buffer, channelCount)
        if (!ndiAudioBuffer) return

        const now = this.timeStart + process.hrtime.bigint()
        const frame = {
            /*  base information  */
            timecode: now / BigInt(100),

            /*  type-specific information  */
            sampleRate,
            noChannels: channelCount,
            noSamples: Math.trunc(ndiAudioBuffer.byteLength / channelCount / this.bytesForFloat32),
            channelStrideBytes: Math.trunc(ndiAudioBuffer.byteLength / channelCount),

            /*  the data itself  */
            fourCC: (grandiose as any).FOURCC_FLTp,
            data: ndiAudioBuffer,
        }

        Object.values(this.NDI).forEach((data) => {
            if (!data?.sendAudio || !data?.sender) return

            try {
                data.sender.audio(frame)
            } catch (err) {
                console.log("Error sending NDI audio frame:", err)
            }
        })
    }
}

// convert from PCM/signed-16-bit/little-endian data to NDI's "PCM/planar/signed-float32/little-endian"
function convertPCMtoPlanarFloat32(buffer: Buffer, channels: number) {
    try {
        const pcmconvert = require("pcm-convert")
        return pcmconvert(buffer, { channels, dtype: "int16", endianness: "le", interleaved: true }, { dtype: "float32", endianness: "le", interleaved: false }) as Buffer
    } catch (err) {
        console.log("Could not convert audio")
        return null
    }
}
