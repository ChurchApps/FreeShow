import type { NativeImage, Size } from "electron"
import os from "os"
import { OUTPUT, OUTPUT_STREAM } from "../../../types/Channels"
import { NdiSender } from "../../ndi/NdiSender"
import util from "../../ndi/vingester-util"
import { OutputHelper } from "../../output/OutputHelper"
import { toServer } from "../../servers"
import { CaptureHelper } from "../CaptureHelper"
import { toApp } from "../.."
import { BlackmagicSender } from "../../blackmagic/BlackmagicSender"

export type Channel = {
    key: string
    captureId: string
    timer: NodeJS.Timeout
    lastImage: NativeImage
}
export class CaptureTransmitter {
    static stageWindows: string[] = []
    static requestList: any[] = []
    //static ndiFrameCount = 0
    static channels: { [key: string]: Channel } = {}

    static startTransmitting(captureId: string) {
        const capture = OutputHelper.getOutput(captureId)?.captureOptions
        if (!capture) return
        //this.startChannel(captureId, "preview")
        if (capture.options.ndi) this.startChannel(captureId, "ndi")
        if (capture.options.blackmagic) this.startChannel(captureId, "blackmagic")
        if (capture.options.server) this.startChannel(captureId, "server")
        if (capture.options.stage) this.startChannel(captureId, "stage")

        if (capture.options.ndi) {
            //ENABLE TO TRACK NDI FRAME RATES
            /*
            console.log("SETTING INTERVAL");
            setInterval(() => {
                console.log("NDI FRAMES:", this.ndiFrameCount, " - ", captureId);
                this.ndiFrameCount = 0
            },1000);
            */
        }
    }

    static startChannel(captureId: string, key: string) {
        const combinedKey = `${captureId}-${key}`
        const interval = 1000 / OutputHelper.getOutput(captureId)?.captureOptions?.framerates?.[key] || 30

        if (this.channels[combinedKey]?.timer) {
            clearInterval(this.channels[combinedKey].timer)
            this.channels[combinedKey].timer = setInterval(() => this.handleChannelInterval(captureId, key), interval)
        } else {
            this.channels[combinedKey] = {
                key,
                captureId,
                timer: setInterval(() => this.handleChannelInterval(captureId, key), interval),
                lastImage: CaptureHelper.storedFrames[captureId],
            }
        }
    }

    static stopChannel(captureId: string, key: string) {
        const combinedKey = `${captureId}-${key}`
        if (!this.channels[combinedKey].timer) return

        clearInterval(this.channels[combinedKey].timer)
    }

    static handleChannelInterval(captureId: string, key: string) {
        const combinedKey = `${captureId}-${key}`
        const channel = this.channels[combinedKey]
        if (!channel) return

        const image = CaptureHelper.storedFrames[captureId]
        if (!image || channel.lastImage === image) return

        const size = image.getSize()
        channel.lastImage = image

        switch (key) {
            //case "preview":
            //this.sendBufferToPreview(channel.captureId, image, { size })
            //break
            case "ndi":
                this.sendBufferToNdi(channel.captureId, image, { size })
                break
            case "blackmagic":
                this.sendBufferToBlackmagic(captureId, image)
                break
            case "server":
                // const options = OutputHelper.getOutput(captureId)?.captureOptions
                this.sendBufferToServer(captureId, image)
                break
            case "stage":
                this.sendBufferToMain(captureId, image)
                break
        }
    }

    // NDI
    static sendBufferToNdi(captureId: string, image: NativeImage, { size }: any) {
        const buffer = image.getBitmap()
        const ratio = image.getAspectRatio()
        //this.ndiFrameCount++
        // WIP refresh on enable?
        NdiSender.sendVideoBufferNDI(captureId, buffer, { size, ratio, framerate: OutputHelper.getOutput(captureId)?.captureOptions?.framerates?.ndi || 10 })
    }

    static resizeImage(image: NativeImage, initialSize: Size, newSize: Size) {
        if (initialSize.width / initialSize.height >= newSize.width / newSize.height) image = image.resize({ width: newSize.width, quality: "good" })
        else image = image.resize({ height: newSize.height, quality: "good" })

        return image
    }

    static sendToStageOutputs(msg: any, excludeId: string = "") {
        ;[...new Set(this.stageWindows)].forEach((id) => id !== excludeId && OutputHelper.Send.sendToWindow(id, msg))
    }

    static sendToRequested(msg: any) {
        let newList: any[] = []

        ;[...new Set(this.requestList)].forEach((data: any) => {
            data = JSON.parse(data)

            if (data.previewId !== msg.data?.id) {
                newList.push(JSON.stringify(data))
                return
            }

            OutputHelper.Send.sendToWindow(data.id, msg)
        })

        this.requestList = newList
    }

    // BLACKMAGIC
    static sendBufferToBlackmagic(captureId: string, image: NativeImage) {
        if (!image) return

        const buffer = image.getBitmap()
        // const size = image.getSize()

        /*  convert from ARGB (Electron/Chromium on big endian CPU)
        to BGRA (supported input of NDI SDK). On little endian
        CPU the input is already BGRA.  */
        if (os.endianness() === "BE") {
            util.ImageBufferAdjustment.ARGBtoBGRA(buffer)
        }

        let framerate = OutputHelper.getOutput(captureId)?.captureOptions?.framerates?.blackmagic
        if (!framerate) return

        // WIP blackmagic audio
        BlackmagicSender.scheduleFrame(captureId, buffer, null, framerate)
    }

    // MAIN (STAGE OUTPUT)
    static sendBufferToMain(captureId: string, image: NativeImage) {
        if (!image) return
        // image = this.resizeImage(image, options.size, previewSize)

        const buffer = image.getBitmap()
        const size = image.getSize()

        /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
        if (os.endianness() === "BE") util.ImageBufferAdjustment.ARGBtoRGBA(buffer)
        else util.ImageBufferAdjustment.BGRAtoRGBA(buffer)

        let msg = { channel: "BUFFER", data: { id: captureId, time: Date.now(), buffer, size } }
        toApp(OUTPUT, msg)
        this.sendToStageOutputs(msg, captureId) // don't send to itself
        this.sendToRequested(msg)
    }

    // SERVER

    // const outputServerSize: Size = { width: 1280, height: 720 }
    static sendBufferToServer(outputId: string, image: NativeImage) {
        // capture: CaptureOptions
        if (!image) return

        // send output image size
        // image = resizeImage(image, options.size, outputServerSize)

        const buffer = image.getBitmap()
        const size = image.getSize()

        /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
        if (os.endianness() === "BE") util.ImageBufferAdjustment.ARGBtoRGBA(buffer)
        else util.ImageBufferAdjustment.BGRAtoRGBA(buffer)

        toServer(OUTPUT_STREAM, { channel: "STREAM", data: { id: outputId, time: Date.now(), buffer, size } })
    }

    static requestPreview(data: any) {
        this.requestList.push(JSON.stringify(data))
    }

    static removeAllChannels(captureId: string) {
        Object.keys(this.channels).forEach((key) => {
            if (key.includes(captureId)) this.removeChannel(captureId, key)
        })
    }

    static removeChannel(captureId: string, key: string) {
        const combinedKey = `${captureId}-${key}`
        if (!this.channels[combinedKey]) return
        if (this.channels[combinedKey].timer) clearInterval(this.channels[combinedKey].timer)
        delete this.channels[combinedKey]
    }
}
