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
    timeStart = BigInt(Date.now()) * BigInt(1e6) - process.hrtime.bigint()
    static receiverTimeout = -1 // 5000 // looks like this timeout exits the app even if the request is successful (if video() is called rapidly)
    static NDI_RECEIVERS: { [key: string]: { frameRate: number; interval?: NodeJS.Timeout } } = {}

    private static findSourcesInterval: NodeJS.Timeout | null = null
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
                let currentLength = sources.length
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

    static allActiveReceivers: { [key: string]: any } = {}
    static async receiveStreamFrameNDI({ source }: { source: { name: string; urlAddress: string; id: string } }) {
        if (this.ndiDisabled) return
        const grandiose = require("grandiose")

        // https://github.com/Streampunk/grandiose/issues/12
        if (!this.allActiveReceivers[source.id]) {
            this.allActiveReceivers[source.id] = await grandiose.receive({ source: { name: source.name, urlAddress: source.urlAddress || source.id }, colorFormat: grandiose.COLOR_FORMAT_RGBX_RGBA })
        }
        // , allowVideoFields: false

        try {
            let videoFrame = await this.allActiveReceivers[source.id].video(this.receiverTimeout)
            this.sendBuffer(source.id, videoFrame)
        } catch (err) {
            console.error(err)
        }
    }

    static sendBuffer(id: string, frame: any) {
        if (!frame) return

        let msg = { channel: "RECEIVE_STREAM", data: { id, frame, time: Date.now() } }
        toApp(NDI, msg)

        this.sendToOutputs.forEach((outputId) => {
            OutputHelper.Send.sendToWindow(outputId, msg, NDI)
        })
    }

    static sendToOutputs: string[] = []
    static async captureStreamNDI({ source, outputId }: { source: { name: string; urlAddress: string; id: string }; outputId: string }) {
        if (this.ndiDisabled) return
        const grandiose = require("grandiose")

        if (!this.sendToOutputs.includes(outputId)) this.sendToOutputs.push(outputId)
        if (this.NDI_RECEIVERS[source.id]) return
        this.NDI_RECEIVERS[source.id] = { frameRate: 0.1 }

        // this.NDI_RECEIVERS[source.id] = { frameRate: frameRate || 0.1 }
        let receiver = this.allActiveReceivers[source.id]
        if (!receiver) {
            this.allActiveReceivers[source.id] = receiver = await grandiose.receive({ source: { name: source.name, urlAddress: source.urlAddress || source.id }, colorFormat: grandiose.COLOR_FORMAT_RGBX_RGBA })
        }

        let frameRate = (receiver.frameRateN || 30000) / (receiver.frameRateD || 1001)
        this.NDI_RECEIVERS[source.id].frameRate = Math.round(1000 / frameRate)

        let gettingFrame: boolean = false
        if (this.NDI_RECEIVERS[source.id].interval) clearInterval(this.NDI_RECEIVERS[source.id].interval)
        this.NDI_RECEIVERS[source.id].interval = setInterval(async () => {
            if (gettingFrame) return
            gettingFrame = true

            try {
                // WIP app crashes if the ndi source stops sending data! (problem in grandiose package)
                let videoFrame = await receiver.video(this.receiverTimeout)
                this.sendBuffer(source.id, videoFrame)
            } catch (err) {
                console.error(err)
                this.stopReceiversNDI({ id: source.id })
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
