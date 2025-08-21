// import pcmconvert from "pcm-converter"
import { toApp } from ".."
import { NDI } from "../../types/Channels"
import { OutputHelper } from "../output/OutputHelper"

// Resources:
// https://www.npmjs.com/package/grandiose-mac
// https://github.com/Streampunk/grandiose
// https://github.com/rse/grandiose
// https://github.com/rse/vingester


// TODO: audio
export class NdiReceiver {
    static ndiDisabled = false // isLinux && os.arch() !== "x64" && os.arch() !== "ia32"
    static receiverTimeout = -1 // 5000 // looks like this timeout exits the app even if the request is successful (if video() is called rapidly)
    static NDI_RECEIVERS: { [key: string]: { frameRate: number; interval?: NodeJS.Timeout } } = {}

    private static isCreatingReceiver = false
    private static findSourcesInterval: NodeJS.Timeout | null = null
    static allActiveReceivers: { [key: string]: any } = {}
    static sendToOutputs: string[] = []

    private static async createReceiverSerialized(source: { name: string; urlAddress: string }, lowbandwidth: boolean = false): Promise<any> {
        const timeoutMs = 10000

        // Wait for any existing receiver creation to complete
        while (this.isCreatingReceiver) await new Promise(resolve => setTimeout(resolve, 50))
        this.isCreatingReceiver = true

        try {
            const grandiose = require("grandiose")
            const config: any = {
                source: {
                    name: source.name,
                    urlAddress: source.urlAddress
                },
                colorFormat: grandiose.COLOR_FORMAT_BGRX_BGRA,
                allowVideoFields: false
            }
            if (lowbandwidth) config.bandwidth = grandiose.BANDWIDTH_LOWEST

            await new Promise(resolveTimeout => setTimeout(resolveTimeout, 100))

            const receiverPromise = grandiose.receive(config)
            const timeoutPromise = new Promise((_, reject) => { setTimeout(() => reject(new Error("NDI receiver creation timeout")), timeoutMs) })

            const receiver = await Promise.race([receiverPromise, timeoutPromise])
            return receiver
        } finally {
            this.isCreatingReceiver = false
        }
    }

    static async findStreamsNDI(): Promise<{ name: string; urlAddress: string }[]> {
        if (this.ndiDisabled) return []
        const grandiose = require("grandiose")

        if (this.findSourcesInterval) clearInterval(this.findSourcesInterval)

        // grandiose.find() crashes the app without "{}"
        const finder = await grandiose.find({ showLocalSources: true })

        return new Promise((resolve) => {
            // without the interval it only finds one source
            // https://github.com/emanspeaks/grandiose/commit/271cd73b5269ab827155a1a944c15d3b5fe4d564
            let previousLength = 0
            this.findSourcesInterval = setInterval(() => {
                const sources = finder.sources()
                const currentLength = sources.length
                if (previousLength === currentLength) {
                    if (this.findSourcesInterval) clearInterval(this.findSourcesInterval)
                    resolve(sources)
                    return
                }
                // finder.wait()
                previousLength = currentLength
            }, 1000)
        })
    }

    static async receiveStreamFrameNDI({ source }: { source: { name: string; urlAddress: string; id: string } }) {
        if (this.ndiDisabled) return
        try {
            if (!this.allActiveReceivers[source.id]) {
                try {
                    this.allActiveReceivers[source.id] = await this.createReceiverSerialized({ name: source.name, urlAddress: source.urlAddress || source.id }, true)
                } catch (error) {
                    delete this.allActiveReceivers[source.id]
                    throw error
                }
            }

            const receiver = this.allActiveReceivers[source.id]
            if (!receiver) return

            if (typeof receiver.video !== 'function') {
                delete this.allActiveReceivers[source.id]
                return
            }

            await new Promise(resolveTimeout => setTimeout(resolveTimeout, 200))
            let rawFrame: any = null

            const maxRetries = 3
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    rawFrame = await receiver.video(500)
                    break
                } catch (videoError: any) {
                    const errorMessage = videoError.message || ''

                    // Handle non-video data (might be metadata or audio)
                    // Failure to do so make NDI feed sluggish
                    if (errorMessage.includes('Non-video data received')) {
                        if (attempt < maxRetries - 1) {
                            await new Promise(resolve => setTimeout(resolve, 100))
                            continue
                        }
                        // Don't delete receiver for non-video data
                        return
                    }

                    const isConnectionEvent = errorMessage.includes("source change")
                    if (isConnectionEvent && attempt < maxRetries - 1) continue
                    else { delete this.allActiveReceivers[source.id]; return }
                }
            }

            if (!rawFrame) return

            if (!rawFrame.data || !rawFrame.xres || !rawFrame.yres) return

            const videoFrame = rawFrame.data
            if (!videoFrame || videoFrame.length === 0) return
            const expectedSize = rawFrame.xres * rawFrame.yres * 4
            if (videoFrame.length !== expectedSize) return

            for (let i = 0; i < videoFrame.length; i += 4) {
                const b = videoFrame[i]
                videoFrame[i] = videoFrame[i + 2] // B -> R
                videoFrame[i + 2] = b // R -> B
            }

            rawFrame.data = videoFrame
            this.sendBuffer(source.id, rawFrame)
        } catch (err) {
            console.error(err)
        }
    }

    static sendBuffer(id: string, frame: any) {
        if (!frame) return

        const msg = { channel: "RECEIVE_STREAM", data: { id, frame, time: Date.now() } }
        toApp(NDI, msg)

        this.sendToOutputs.forEach((outputId) => {
            OutputHelper.Send.sendToWindow(outputId, msg, NDI)
        })
    }

    static async captureStreamNDI({ source, outputId }: { source: { name: string; urlAddress: string; id: string }; outputId: string }) {
        if (this.ndiDisabled) return

        if (!this.sendToOutputs.includes(outputId)) this.sendToOutputs.push(outputId)
        if (this.NDI_RECEIVERS[source.id]) return
        this.NDI_RECEIVERS[source.id] = { frameRate: 0.1 }

        // this.NDI_RECEIVERS[source.id] = { frameRate: frameRate || 0.1 }
        let receiver = this.allActiveReceivers[source.id]
        if (!receiver) {
            this.allActiveReceivers[source.id] = receiver = await this.createReceiverSerialized({ name: source.name, urlAddress: source.urlAddress || source.id }, false)
        }

        const frameRate = (receiver.frameRateN || 30000) / (receiver.frameRateD || 1001)
        this.NDI_RECEIVERS[source.id].frameRate = Math.round(1000 / frameRate)

        let gettingFrame = false
        let consecutiveErrors = 0
        const maxConsecutiveErrors = 10

        if (this.NDI_RECEIVERS[source.id].interval) clearInterval(this.NDI_RECEIVERS[source.id].interval)
        this.NDI_RECEIVERS[source.id].interval = setInterval(async () => {
            if (gettingFrame) return
            gettingFrame = true

            try {
                // WIP app crashes if the ndi source stops sending data! (problem in grandiose package)
                const rawFrame = await receiver.video(this.receiverTimeout)
                const videoFrame = rawFrame.data

                // Issue with NDI 6.2: COLOR_FORMAT_RGBX_RGBA is incorrect (green tinted), using BGRA and converting back to RGBA (this worked fine without using NDI 6.1.1)
                for (let i = 0; i < videoFrame.length; i += 4) {
                    const b = videoFrame[i]
                    videoFrame[i] = videoFrame[i + 2] // B -> R
                    videoFrame[i + 2] = b // R -> B
                }

                rawFrame.data = videoFrame
                this.sendBuffer(source.id, rawFrame)
                consecutiveErrors = 0
            } catch (err: any) {
                consecutiveErrors++
                if (consecutiveErrors >= maxConsecutiveErrors) {
                    console.error(`NDI source ${source.id}: Too many consecutive errors, stopping receiver`)
                    this.stopReceiversNDI({ id: source.id })
                }
            }

            gettingFrame = false
        }, this.NDI_RECEIVERS[source.id].frameRate)
    }

    static stopReceiversNDI(data: { id: string; outputId?: string } | null = null) {
        if (data?.id) {
            if (data.outputId) this.sendToOutputs.splice(this.sendToOutputs.indexOf(data.outputId), 1)
            else this.sendToOutputs = [] // error

            if (!this.sendToOutputs.length) {
                clearInterval(this.NDI_RECEIVERS[data.id].interval)
                // delete this.allActiveReceivers[data.id]
                delete this.NDI_RECEIVERS[data.id]
            }
            return
        }

        Object.values(this.NDI_RECEIVERS).forEach(({ interval }) => {
            clearInterval(interval)
        })
        this.NDI_RECEIVERS = {}
    }
}