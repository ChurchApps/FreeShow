import { toApp } from ".."
import { NDI } from "../../types/Channels"
import { OutputHelper } from "../output/OutputHelper"

let warned = false
const loadGrandiose = async () => {
    try {
        return await import('grandiose')
    } catch (err) {
        if (!warned) console.warn('NDI not available:', err.message)
        warned = true
        return null
    }
}

export class NdiReceiver {
    static ndiDisabled = false
    static NDI_RECEIVERS: { [key: string]: { frameRate: number; isReceiving?: boolean; shouldStop?: boolean } } = {}

    private static isCreatingReceiver = false
    private static findSourcesInterval: NodeJS.Timeout | null = null
    static allActiveReceivers: { [key: string]: any } = {}
    static sendToOutputs: string[] = []

    private static async createReceiver(source: { name: string; urlAddress: string }, lowbandwidth = false) {
        while (this.isCreatingReceiver) await new Promise(resolve => setTimeout(resolve, 50))
        this.isCreatingReceiver = true

        try {
            const grandiose = await loadGrandiose()
            if (!grandiose) return

            const config: any = { source, colorFormat: grandiose.COLOR_FORMAT_RGBX_RGBA, allowVideoFields: false }
            if (lowbandwidth) config.bandwidth = grandiose.BANDWIDTH_LOWEST

            const receiver = await Promise.race([
                grandiose.receive(config),
                new Promise((_, reject) => setTimeout(() => reject(new Error("NDI receiver timeout")), 10000))
            ])
            return receiver
        } finally {
            this.isCreatingReceiver = false
        }
    }

    static async findStreamsNDI() {
        if (this.ndiDisabled) return []
        if (this.findSourcesInterval) clearInterval(this.findSourcesInterval)

        const grandiose = await loadGrandiose()
        if (!grandiose) return

        const finder: any = await (grandiose).find({ showLocalSources: true })
        return new Promise<any[]>((resolve) => {
            let previousLength = 0
            this.findSourcesInterval = setInterval(() => {
                const sources = finder.sources()
                if (previousLength === sources.length) {
                    clearInterval(this.findSourcesInterval!)
                    resolve(sources)
                }
                previousLength = sources.length
            }, 1000)
        })
    }

    static async receiveStreamFrameNDI({ source }: { source: { name: string; urlAddress: string; id: string } }) {
        if (this.ndiDisabled) return

        try {
            if (!this.allActiveReceivers[source.id]) {
                this.allActiveReceivers[source.id] = await this.createReceiver({ name: source.name, urlAddress: source.urlAddress || source.id }, true)
            }

            const receiver = this.allActiveReceivers[source.id]
            if (!receiver?.video) { delete this.allActiveReceivers[source.id]; return }

            // For NDI-HX sources, start continuous reception for thumbnail generation
            if (!this.NDI_RECEIVERS[source.id]) {
                this.NDI_RECEIVERS[source.id] = { frameRate: 0.1, isReceiving: false, shouldStop: false }

                const receiverData = this.NDI_RECEIVERS[source.id]
                if (!receiverData.isReceiving) {
                    receiverData.isReceiving = true
                    // Start lightweight frame loop for thumbnails only
                    this.thumbnailLoop(source.id, receiver, receiverData)
                }
            }

            let rawFrame: any = null
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    rawFrame = await receiver.video(50)
                    break
                } catch (err: any) {
                    const msg = err.message || ''
                    if (msg.includes('Non-video data received')) {
                        if (attempt < 2) continue
                        return
                    }
                    if (msg.includes("source change") && attempt < 2) continue
                    delete this.allActiveReceivers[source.id]
                    return
                }
            }

            if (rawFrame?.data?.length === rawFrame.xres * rawFrame.yres * 4) {
                this.sendBuffer(source.id, rawFrame)
            }
        } catch (err) {
            console.error(err)
        }
    }

    private static handleError(err: any, consecutiveErrors: number): { shouldContinue: boolean; delay: number; newErrorCount: number } {
        const msg = err.message || ''

        if (msg.includes('Non-video data received')) return { shouldContinue: true, delay: 0, newErrorCount: Math.max(0, consecutiveErrors - 1) }
        if (msg.includes('No video data received')) return { shouldContinue: true, delay: 1, newErrorCount: consecutiveErrors }

        const newCount = consecutiveErrors + 1
        return {
            shouldContinue: newCount < 10,
            delay: Math.min(5 * Math.pow(1.5, newCount), 100),
            newErrorCount: newCount
        }
    }

    private static updateAdaptiveDelay(processingTime: number, processingTimes: number[], currentDelay: number): { newTimes: number[], newDelay: number } {
        processingTimes.push(processingTime)
        if (processingTimes.length > 10) processingTimes.shift()

        let adaptiveDelay = currentDelay
        if (processingTimes.length >= 5) {
            const avgTime = processingTimes.reduce((a, b) => a + b) / processingTimes.length
            if (avgTime < 5) adaptiveDelay = Math.max(8, adaptiveDelay - 1)
            else if (avgTime > 15) adaptiveDelay = Math.min(50, adaptiveDelay + 2)
        }

        return { newTimes: processingTimes, newDelay: adaptiveDelay }
    }

    private static async frameLoop(sourceId: string, receiver: any, receiverData: any) {
        let consecutiveErrors = 0
        let processingTimes: number[] = []
        let adaptiveDelay = 16

        while (receiverData && !receiverData.shouldStop) {
            const loopStart = Date.now()

            try {
                const rawFrame = await receiver.video(50)
                if (rawFrame) {
                    this.sendBuffer(sourceId, rawFrame)
                    consecutiveErrors = 0

                    const processingTime = Date.now() - loopStart
                    const result = this.updateAdaptiveDelay(processingTime, processingTimes, adaptiveDelay)
                    processingTimes = result.newTimes
                    adaptiveDelay = result.newDelay

                    await new Promise(resolve => setTimeout(resolve, adaptiveDelay))
                    continue
                }
            } catch (err: any) {
                const { shouldContinue, delay, newErrorCount } = this.handleError(err, consecutiveErrors)
                consecutiveErrors = newErrorCount

                if (!shouldContinue) {
                    console.error(`NDI source ${sourceId}: Too many errors, stopping`)
                    this.stopReceiversNDI({ id: sourceId })
                    return
                }

                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }
    }

    private static async thumbnailLoop(sourceId: string, receiver: any, receiverData: any) {
        let consecutiveErrors = 0

        while (receiverData && !receiverData.shouldStop) {
            try {
                const rawFrame = await receiver.video(50)
                if (rawFrame) {
                    this.sendBuffer(sourceId, rawFrame)
                    consecutiveErrors = 0
                    // Slower rate for thumbnails - every 500ms
                    await new Promise(resolve => setTimeout(resolve, 500))
                    continue
                }
            } catch (err: any) {
                const { shouldContinue, delay, newErrorCount } = this.handleError(err, consecutiveErrors)
                consecutiveErrors = newErrorCount

                if (!shouldContinue) {
                    delete this.NDI_RECEIVERS[sourceId]
                    return
                }

                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }
    }

    static sendBuffer(id: string, frame: any) {
        if (!frame) return
        const msg = { channel: "RECEIVE_STREAM", data: { id, frame, time: Date.now() } }
        toApp(NDI, msg)
        this.sendToOutputs.forEach(outputId => OutputHelper.Send.sendToWindow(outputId, msg, NDI))
    }

    static async captureStreamNDI({ source, outputId }: { source: { name: string; urlAddress: string; id: string }; outputId: string }) {
        if (this.ndiDisabled) return
        if (!this.sendToOutputs.includes(outputId)) this.sendToOutputs.push(outputId)

        let receiver = this.allActiveReceivers[source.id]
        if (!receiver) {
            receiver = this.allActiveReceivers[source.id] = await this.createReceiver({ name: source.name, urlAddress: source.urlAddress || source.id })
        }

        // If thumbnail loop is running, stop it and upgrade to full capture
        if (this.NDI_RECEIVERS[source.id]) {
            this.NDI_RECEIVERS[source.id].shouldStop = true
            // Brief delay to let thumbnail loop exit cleanly
            await new Promise(resolve => setTimeout(resolve, 100))
        }

        // Start full capture loop
        this.NDI_RECEIVERS[source.id] = { frameRate: 0.1, isReceiving: true, shouldStop: false }
        const receiverData = this.NDI_RECEIVERS[source.id]

        this.frameLoop(source.id, receiver, receiverData).catch(err => {
            console.error(`NDI reception error for ${source.id}:`, err)
            this.stopReceiversNDI({ id: source.id })
        })
    }

    static stopReceiversNDI(data: { id: string; outputId?: string } | null = null) {
        if (data?.id) {
            if (data.outputId) this.sendToOutputs.splice(this.sendToOutputs.indexOf(data.outputId), 1)
            else this.sendToOutputs = []

            if (!this.sendToOutputs.length && this.NDI_RECEIVERS[data.id]) {
                this.NDI_RECEIVERS[data.id].shouldStop = true
                setTimeout(() => delete this.NDI_RECEIVERS[data.id], 100)
            }
            return
        }

        Object.keys(this.NDI_RECEIVERS).forEach(id => {
            if (this.NDI_RECEIVERS[id]) this.NDI_RECEIVERS[id].shouldStop = true
        })
        setTimeout(() => this.NDI_RECEIVERS = {}, 100)
    }
}