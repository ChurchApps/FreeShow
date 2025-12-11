import os from "os"
import { toApp } from ".."
import { CaptureHelper } from "../capture/CaptureHelper"
import { CaptureTransmitter } from "../capture/helpers/CaptureTransmitter"
import util from "./vingester-util"

// Dynamic import for grandiose ES module to prevent TypeScript compilation issues
let warned = false
const loadGrandiose = async () => {
    try {
        return await import("grandiose")
    } catch (err) {
        if (!warned) console.warn("NDI not available:", err.message)
        warned = true
        return null
    }
}

// Resources:
// https://www.npmjs.com/package/grandiose-mac
// https://github.com/Streampunk/grandiose
// https://github.com/rse/grandiose
// https://github.com/rse/vingester

export class NdiSender {
    static ndiDisabled = false // isLinux && os.arch() !== "x64" && os.arch() !== "ia32"
    static timeStart = BigInt(Date.now()) * BigInt(1e6) - process.hrtime.bigint()
    static NDI: { [key: string]: { name: string; groups?: string; status?: string; previousStatus?: string; sender?: any; timer?: NodeJS.Timeout; sendAudio?: boolean } } = {}

    static stopSenderNDI(id: string) {
        if (!this.NDI[id]?.timer) return

        console.info("NDI - stopping sender: " + this.NDI[id].name)
        clearInterval(this.NDI[id].timer)

        try {
            this.NDI[id].sender.destroy()
        } catch (err) {
            console.error("ERROR", err)
        }

        delete this.NDI[id]
    }

    static initNameNDI(name?: string, outputName?: string) {
        return name || `FreeShow NDI${outputName ? ` - ${outputName}` : ""}`
    }

    static async createSenderNDI(id: string, name = "", groups?: string) {
        if (this.ndiDisabled || this.NDI[id]) return

        this.NDI[id] = { name, groups }
        console.info("NDI - creating sender: " + this.NDI[id].name, groups ? `; In group: ${groups}` : "")

        try {
            const grandiose = await loadGrandiose()
            if (!grandiose) return

            /* eslint @typescript-eslint/await-thenable: 0 */
            this.NDI[id].sender = await grandiose.send({
                name: this.NDI[id].name,
                groups: this.NDI[id].groups,
                clockVideo: false,
                clockAudio: false
            })
        } catch (err) {
            console.error("Could not create NDI sender:", err)
            delete this.NDI[id]
            return
        }

        this.NDI[id].timer = setInterval(() => {
            /*  poll NDI for connections  */
            const conns: number = this.NDI[id].sender?.connections() || 0
            this.NDI[id].status = conns > 0 ? "connected" : "unconnected"

            const newStatus = String(this.NDI[id].status) + conns.toString()
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

    // static frames = 0
    static async sendVideoBufferNDI(id: string, buffer: Buffer, { size = { width: 1280, height: 720 }, ratio = 16 / 9, framerate = 1 }) {
        if (this.ndiDisabled || !this.NDI[id]?.sender) return

        // DEBUG log fps
        // this.frames++
        // setTimeout(() => this.frames--, 1000)
        // console.log(`NDI FPS ${id}:`, this.frames)

        /*  convert from ARGB (Electron/Chromium on big endian CPU)
        to BGRA (supported input of NDI SDK). On little endian
        CPU the input is already BGRA.  */
        if (os.endianness() === "BE") {
            util.ImageBufferAdjustment.ARGBtoBGRA(buffer)
        }

        /*  optionally convert from BGRA to BGRX (no alpha channel)  */
        const grandiose = await loadGrandiose()
        if (!grandiose) return

        const fourCC = grandiose.FOURCC_BGRA
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
            frameFormatType: grandiose.FORMAT_TYPE_PROGRESSIVE,
            lineStrideBytes: size.width * bytesForBGRA,

            /*  the data itself  */
            fourCC,
            data: buffer
        }

        try {
            await this.NDI[id].sender.video(frame)
        } catch (err) {
            console.error("Error sending NDI video frame:", err)
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
    static async sendAudioBufferNDI(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
        if (this.ndiDisabled || !Object.values(this.NDI).find((a) => a?.sendAudio)) return

        const ndiAudioBuffer = convertPCMtoPlanarFloat32(buffer, channelCount)
        if (!ndiAudioBuffer) return

        const grandiose = await loadGrandiose()
        if (!grandiose) return

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
            fourCC: grandiose.FOURCC_FLTp,
            data: ndiAudioBuffer
        }

        Object.values(this.NDI).forEach((data) => {
            if (!data?.sendAudio || !data?.sender) return

            try {
                data.sender.audio(frame)
            } catch (err) {
                console.error("Error sending NDI audio frame:", err)
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
        console.error("Could not convert audio")
        return null
    }
}
