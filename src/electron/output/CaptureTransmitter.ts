import type { NativeImage, Size } from "electron"
import os from "os"
import { toApp } from ".."
import { OUTPUT, OUTPUT_STREAM } from "../../types/Channels"
import { toServer } from "../servers"
import { sendToWindow } from "./output"
import util from "../ndi/vingester-util"
import { NdiSender } from "../ndi/NdiSender"
import { CaptureOptions, previewSize } from "./capture"

export class CaptureTransmitter {
    static stageWindows: string[] = []
    static requestList: any[] = []

    static async sendFrames(capture: CaptureOptions, image: NativeImage, rates: any) {
        if (!capture || !image) return
        const size = image.getSize()
        if (rates.previewFrame) this.sendBufferToPreview(capture, image, { size })
        if (rates.serverFrame && capture.options.server) this.sendBufferToServer(capture, image)
        if (rates.ndiFrame && capture.options.ndi) this.sendBufferToNdi(capture, image, { size })
    }

    // NDI
    static sendBufferToNdi(capture:CaptureOptions, image: NativeImage, { size }: any) {
        const buffer = image.getBitmap()
        const ratio = image.getAspectRatio()

        console.log("NDI - sending frame: " + capture.id, image.getSize().width, Math.round(Math.random() * 100))
        // WIP refresh on enable?
        NdiSender.sendVideoBufferNDI(capture.id, buffer, { size, ratio, framerate: capture.framerates.ndi })
    }

    // PREVIEW
    static sendBufferToPreview(capture:CaptureOptions, image: NativeImage, options: any) {
        if (!image) return
        image = this.resizeImage(image, options.size, previewSize)

        const buffer = image.getBitmap()
        const size = image.getSize()

        /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
        if (os.endianness() === "BE") util.ImageBufferAdjustment.ARGBtoRGBA(buffer)
        else util.ImageBufferAdjustment.BGRAtoRGBA(buffer)

        let msg = { channel: "PREVIEW", data: { id:capture.id, buffer, size, originalSize: options.size } }
        toApp(OUTPUT, msg)
        this.sendToStageOutputs(msg)
        this.sendToRequested(msg)
    }

    static resizeImage(image: NativeImage, initialSize: Size, newSize: Size) {
        if (initialSize.width / initialSize.height >= newSize.width / newSize.height) image = image.resize({ width: newSize.width })
        else image = image.resize({ height: newSize.height })

        return image
    }

    static sendToStageOutputs(msg: any) {
        ;[...new Set(this.stageWindows)].forEach((id) => sendToWindow(id, msg))
    }

    static sendToRequested(msg: any) {
        let newList: any[] = []

        ;[...new Set(this.requestList)].forEach((data: any) => {
            data = JSON.parse(data)

            if (data.previewId !== msg.data.id) {
                newList.push(JSON.stringify(data))
                return
            }

            sendToWindow(data.id, msg)
        })

        this.requestList = newList
    }

    // SERVER

    // const outputServerSize: Size = { width: 1280, height: 720 }
    static sendBufferToServer(capture: CaptureOptions, image: NativeImage) {
        if (!image) return

        // send output image size
        // image = resizeImage(image, options.size, outputServerSize)

        const buffer = image.getBitmap()
        const size = image.getSize()

        /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
        if (os.endianness() === "BE") util.ImageBufferAdjustment.ARGBtoRGBA(buffer)
        else util.ImageBufferAdjustment.BGRAtoRGBA(buffer)

        toServer(OUTPUT_STREAM, { channel: "STREAM", data: { id:capture.id, buffer, size } })
    }

    static requestPreview(data: any) {
        this.requestList.push(JSON.stringify(data))
    }
    
}