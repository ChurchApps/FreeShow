// import pcmconvert from "pcm-converter"
import os from "os"
import { isLinux, toApp } from ".."

// WIP - NDI issue on Linux: libndi.so.5: No such file or dialog

// Resources:
// https://www.npmjs.com/package/grandiose-mac
// https://github.com/Streampunk/grandiose
// https://github.com/rse/grandiose
// https://github.com/rse/vingester

// TODO: audio
export class NdiReceiver {
  static ndiDisabled = isLinux && os.arch() !== "x64" && os.arch() !== "ia32";
  timeStart = BigInt(Date.now()) * BigInt(1e6) - process.hrtime.bigint();
  static receiverTimeout = 5000;
  static NDI_RECEIVERS: any = {}


  static async findStreamsNDI(): Promise<any> {
    if (this.ndiDisabled) return
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

  static async receiveStreamFrameNDI({ source }: any) {
    if (this.ndiDisabled) return
    const grandiose = require("grandiose")

    let receiver = await grandiose.receive({ source })

    try {
        let videoFrame = await receiver.video(this.receiverTimeout)
        this.sendBuffer(source.id, videoFrame)
    } catch (err) {
        console.error(err)
    }
  }

  static sendBuffer(id: string, frame: any) {
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

  static async captureStreamNDI({ source, frameRate }: any) {
    if (this.NDI_RECEIVERS[source.id]) return

    if (this.ndiDisabled) return
    const grandiose = require("grandiose")

    this.NDI_RECEIVERS[source.id] = { frameRate: frameRate || 0.1 }
    this.NDI_RECEIVERS[source.id].receiver = await grandiose.receive({ source })

    try {
      this.NDI_RECEIVERS[source.id].interval = setInterval(async () => {
            let videoFrame = await this.NDI_RECEIVERS[source.id].receiver.video(this.receiverTimeout)
            toApp("NDI", { channel: "RECEIVE_STREAM", data: { id: source.id, frame: videoFrame } })
        }, this.NDI_RECEIVERS[source.id].frameRate * 1000)
    } catch (err) {
        console.error(err)
    }
  }

  static stopReceiversNDI(data: any = null) {
    if (data?.id) {
        clearInterval(this.NDI_RECEIVERS[data.id].interval)
        delete this.NDI_RECEIVERS[data.id]
        return
    }

    Object.values(this.NDI_RECEIVERS).forEach((interval: any) => { clearInterval(interval); })
    this.NDI_RECEIVERS = {}
  }


}