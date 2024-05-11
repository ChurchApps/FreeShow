// import pcmconvert from "pcm-converter"
import os from "os"
import { isLinux, toApp } from ".."
import { updateFramerate } from "../output/capture"
import util from "./vingester-util"

// WIP - NDI issue on Linux: libndi.so.5: No such file or dialog

// Resources:
// https://www.npmjs.com/package/grandiose-mac
// https://github.com/Streampunk/grandiose
// https://github.com/rse/grandiose
// https://github.com/rse/vingester

// TODO: audio
export class NdiSender {
  static ndiDisabled = isLinux && os.arch() !== "x64" && os.arch() !== "ia32"
  static timeStart = BigInt(Date.now()) * BigInt(1e6) - process.hrtime.bigint()
  static NDI: any = {}
  
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
    if (this.ndiDisabled) return
    const grandiose = require("grandiose")

    if (this.NDI[id]) return
    this.NDI[id] = {}

    this.NDI[id].name = "FreeShow NDI"
    if (title) this.NDI[id].name = this.NDI[id].name + " - " + title
    console.log("NDI - creating sender: " + this.NDI[id].name)

    let error = false

    try {
      this.NDI[id].sender = await grandiose.send({
            name: this.NDI[id].name,
            clockVideo: false,
            clockAudio: false,
        })
    } catch (err) {
        console.log("Could not create NDI sender:", err)
        error = true
    }

    if (error) {
        delete this.NDI[id]
        return
    }

    this.NDI[id].timer = setInterval(() => {
        /*  poll NDI for connections  */
        const conns = this.NDI[id].sender?.connections() || 0

        this.NDI[id].status = "unconnected"
        if (conns > 0) this.NDI[id].status = "connected"

        let newStatus = this.NDI[id].status + conns
        if (newStatus !== this.NDI[id].previousStatus) {
            toApp("NDI", { channel: "SEND_DATA", data: { id, status: this.NDI[id].status, connections: conns } })
            updateFramerate(id)

            this.NDI[id].previousStatus = newStatus
        }
    }, 1000)
  }

  static async sendVideoBufferNDI(id: string, buffer: any, { size = { width: 1280, height: 720 }, ratio = 16 / 9, framerate = 1 }) {
    if (!this.NDI[id]?.sender) return

    if (this.ndiDisabled) return
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
    } catch (error) {
        console.log(error)
    }
  }

  static async sendAudioBufferNDI(id: string, buffer: Buffer, { sampleRate, noChannels, bytesForFloat32 }: any) {
    if (!this.NDI[id].sender) return

    if (this.ndiDisabled) return
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
    const now = this.timeStart + process.hrtime.bigint()
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

    await this.NDI[id].sender.audio(frame)
  }
}