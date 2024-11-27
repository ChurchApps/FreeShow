import type { NativeImage, Size } from "electron"
import os from "os"
import { OUTPUT, OUTPUT_STREAM } from "../../../types/Channels"
import { NdiSender } from "../../ndi/NdiSender"
import util from "../../ndi/vingester-util"
import { OutputHelper } from "../../output/OutputHelper"
import { toServer } from "../../servers"
import { CaptureHelper } from "../CaptureHelper"
import { toApp } from "../.."

export type Channel = {
    key: string
    captureId: string
    timer: NodeJS.Timeout
    // compare to not update when not changing
    lastImage: Buffer // toBitmap
    imageIsSame: boolean
    lastCheck: number
}
export class CaptureTransmitter {
    static stageWindows: string[] = []
    static requestList: any[] = []
    //static ndiFrameCount = 0
    static channels: { [key: string]: Channel } = {}

    static startTransmitting(captureId: string) {
        const captureOptions = OutputHelper.getOutput(captureId)?.captureOptions
        if (!captureOptions) return
        //this.startChannel(captureId, "preview")

        const { ndi, server, stage } = captureOptions.options
        if (ndi) this.startChannel(captureId, "ndi")
        if (server) this.startChannel(captureId, "server")
        if (stage) this.startChannel(captureId, "stage")

        if (ndi) {
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

    // WIP one global capture (on the highest frame rate) instead of multiple per frame rate - but using multipe at once is probably an edge case
    static startChannel(captureId: string, key: string) {
        const combinedKey = `${captureId}-${key}`
        const interval = 1000 / OutputHelper.getOutput(captureId)?.captureOptions?.framerates?.[key] || 30
        // console.log("START CHANNEL:", key, interval)

        if (this.channels[combinedKey]?.timer) {
            clearInterval(this.channels[combinedKey].timer)
            this.channels[combinedKey].timer = setInterval(() => this.handleChannelInterval(captureId, key), interval)
        } else {
            this.channels[combinedKey] = {
                key,
                captureId,
                timer: setInterval(() => this.handleChannelInterval(captureId, key), interval),
                lastImage: Buffer.from([]),
                imageIsSame: false,
                lastCheck: 0,
            }
        }
    }

    static stopChannel(captureId: string, key: string) {
        const combinedKey = `${captureId}-${key}`
        if (!this.channels[combinedKey].timer) return

        // console.log("STOP CHANNEL:", key)
        clearInterval(this.channels[combinedKey].timer)
    }

    private static checkImageCount = 100 // about every 3-5 seconds (50*100 / 33*100)
    static handleChannelInterval(captureId: string, key: string) {
        const combinedKey = `${captureId}-${key}`
        const channel = this.channels[combinedKey]
        if (!channel) return

        const image = CaptureHelper.storedFrames[captureId]
        if (!image) return

        // check if image is the same as last once in a while
        // if it's the same don't send a frame until it has changed
        channel.lastCheck++
        let compareImageCount = channel.imageIsSame ? 10 : this.checkImageCount
        if (channel.lastCheck > compareImageCount) {
            channel.lastCheck = 0

            // console.time("toBitmap")
            const imgData = image.toBitmap({ scaleFactor: 0.5 })
            // https://stackoverflow.com/a/78093344
            channel.imageIsSame = channel.lastImage.equals(imgData)
            // console.timeEnd("toBitmap") // aprx. 4ms

            if (!channel.imageIsSame) {
                // store frame for next check
                channel.lastImage = imgData
            }
        }

        if (channel.imageIsSame) return

        const size = image.getSize()
        if (!size.width || !size.height) return

        switch (key) {
            //case "preview":
            //this.sendBufferToPreview(channel.captureId, image, { size })
            //break
            case "ndi":
                this.sendBufferToNdi(channel.captureId, image, { size })
                break
            case "server":
                // const options = OutputHelper.getOutput(captureId)?.captureOptions
                // phone screen size
                this.sendBufferToServer(captureId, image.resize({ width: size.width / 5, height: size.height / 5, quality: "good" }))
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
        // image = image.resize({ width: size.width / 3, height: size.height / 3, quality: "good" })
        // image = this.resizeImage(image, size, { width: size.width / 3, height: size.height / 3 })

        const buffer = image.getBitmap() // {scaleFactor: 0.5}
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
