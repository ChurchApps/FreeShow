// import pcmconvert from "pcm-converter"
import { toApp } from ".."
import { NDI } from "../../types/Channels"
import { OutputHelper } from "../output/OutputHelper"
// Dynamic import for grandiose ES module using eval to prevent TypeScript compilation issues
const loadGrandiose = () => eval('import("grandiose")')

// Resources:
// https://www.npmjs.com/package/grandiose-mac
// https://github.com/Streampunk/grandiose
// https://github.com/rse/grandiose
// https://github.com/rse/vingester


// TODO: audio
export class NdiReceiver {
    static ndiDisabled = false // isLinux && os.arch() !== "x64" && os.arch() !== "ia32"
    static receiverTimeout = -1 // 5000 // looks like this timeout exits the app even if the request is successful (if video() is called rapidly)
    static NDI_RECEIVERS: { [key: string]: { frameRate: number; isReceiving?: boolean; shouldStop?: boolean; interval?: NodeJS.Timeout } } = {}

    private static isCreatingReceiver = false
    private static findSourcesInterval: NodeJS.Timeout | null = null
    static allActiveReceivers: { [key: string]: any } = {}
    static sendToOutputs: string[] = []

    private static async createReceiverSerialized(source: { name: string; urlAddress: string }, lowbandwidth = false): Promise<any> {
        const timeoutMs = 10000

        // Wait for any existing receiver creation to complete
        while (this.isCreatingReceiver) await new Promise(resolve => setTimeout(resolve, 50))
        this.isCreatingReceiver = true

        try {
            const grandiose = await loadGrandiose()
            const config: any = {
                source: {
                    name: source.name,
                    urlAddress: source.urlAddress
                },
                colorFormat: grandiose.COLOR_FORMAT_RGBX_RGBA,
                allowVideoFields: false
            }
            if (lowbandwidth) config.bandwidth = grandiose.BANDWIDTH_LOWEST

            // REMOVED: 100ms artificial delay that was adding latency
            // await new Promise(resolveTimeout => setTimeout(resolveTimeout, 100))

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

        if (this.findSourcesInterval) clearInterval(this.findSourcesInterval)

        // grandiose.find() crashes the app without "{}"
        const grandiose = await loadGrandiose()
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

            // REMOVED: 200ms artificial delay that was adding latency
            // await new Promise(resolveTimeout => setTimeout(resolveTimeout, 200))
            
            let rawFrame: any = null

            const maxRetries = 3
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    // Reduced timeout from 500ms to 50ms for lower latency
                    rawFrame = await receiver.video(50)
                    break
                } catch (videoError: any) {
                    const errorMessage = videoError.message || ''

                    // Handle non-video data (might be metadata or audio)
                    // Failure to do so make NDI feed sluggish
                    if (errorMessage.includes('Non-video data received')) {
                        if (attempt < maxRetries - 1) {
                            // REMOVED: 100ms delay between retries - just continue immediately
                            // await new Promise(resolve => setTimeout(resolve, 100))
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
        
        // Initialize receiver data with continuous reception control
        this.NDI_RECEIVERS[source.id] = { 
            frameRate: 0.1, // Keep for compatibility, but won't be used for timing
            isReceiving: false,
            shouldStop: false
        }

        let receiver = this.allActiveReceivers[source.id]
        if (!receiver) {
            this.allActiveReceivers[source.id] = receiver = await this.createReceiverSerialized({ name: source.name, urlAddress: source.urlAddress || source.id }, false)
        }

        // Start continuous frame reception
        this.startContinuousReception(source.id, receiver)
    }

    private static startContinuousReception(sourceId: string, receiver: any) {
        const receiverData = this.NDI_RECEIVERS[sourceId]
        if (!receiverData || receiverData.isReceiving) return

        receiverData.isReceiving = true
        let consecutiveErrors = 0
        const maxConsecutiveErrors = 10
        const baseErrorDelay = 5 // Much shorter base delay
        const maxErrorDelay = 100 // Cap the maximum error delay

        // console.log(`Starting continuous NDI reception for source: ${sourceId}`)

        // Continuous reception loop - optimized for NDI-HX
        const receiveFrames = async (): Promise<void> => {
            while (receiverData && !receiverData.shouldStop) {
                try {
                    // Use much shorter timeout for lower latency
                    const rawFrame = await receiver.video(50) // Reduced from 500ms to 50ms
                    
                    if (rawFrame) {
                        this.sendBuffer(sourceId, rawFrame)
                        consecutiveErrors = 0
                        
                        // IMPORTANT FIX FOR NDI-HX: Don't return, continue the loop
                        // NDI-HX sources need continuous polling, not callback-based
                        // Regular NDI sources will also work fine with this approach
                        
                        // For ultra-low latency, use setImmediate but don't exit loop
                        await new Promise(resolve => setImmediate(resolve))
                        continue // Continue the while loop instead of returning
                    }
                } catch (err: any) {
                    const errorMessage = err.message || ''

                    // Handle non-video data gracefully (common in NDI streams)
                    if (errorMessage.includes('Non-video data received')) {
                        // Don't count as error, just continue immediately
                        consecutiveErrors = Math.max(0, consecutiveErrors - 1)
                        await new Promise(resolve => setImmediate(resolve))
                        continue
                    }

                    // Handle timeout errors differently for NDI-HX
                    if (errorMessage.includes('No video data received')) {
                        // For NDI-HX, this is normal between frames, don't count as severe error
                        // Just add a tiny delay and continue
                        await new Promise(resolve => setTimeout(resolve, 1))
                        continue
                    }

                    // For other errors, implement exponential backoff
                    consecutiveErrors++
                    if (consecutiveErrors >= maxConsecutiveErrors) {
                        console.error(`NDI source ${sourceId}: Too many consecutive errors (${consecutiveErrors}), stopping receiver`)
                        this.stopReceiversNDI({ id: sourceId })
                        return
                    }

                    // Exponential backoff for real errors, but keep it minimal
                    const errorDelay = Math.min(baseErrorDelay * Math.pow(1.5, consecutiveErrors), maxErrorDelay)
                    // console.warn(`NDI source ${sourceId}: Error ${consecutiveErrors}/${maxConsecutiveErrors}, retrying in ${errorDelay}ms`)
                    
                    await new Promise(resolve => setTimeout(resolve, errorDelay))
                    continue
                }
            }
        }

        // Start the continuous reception
        receiveFrames().catch(err => {
            console.error(`Fatal error in continuous NDI reception for ${sourceId}:`, err)
            this.stopReceiversNDI({ id: sourceId })
        })
    }

    static stopReceiversNDI(data: { id: string; outputId?: string } | null = null) {
        if (data?.id) {
            if (data.outputId) this.sendToOutputs.splice(this.sendToOutputs.indexOf(data.outputId), 1)
            else this.sendToOutputs = [] // error

            if (!this.sendToOutputs.length) {
                // Signal continuous reception to stop gracefully
                if (this.NDI_RECEIVERS[data.id]) {
                    this.NDI_RECEIVERS[data.id].shouldStop = true
                    console.log(`Stopping continuous NDI reception for source: ${data.id}`)
                }
                
                // Clean up receiver data after a brief delay to allow graceful shutdown
                setTimeout(() => {
                    delete this.NDI_RECEIVERS[data.id]
                    // Optionally clean up the actual receiver
                    // delete this.allActiveReceivers[data.id]
                }, 100)
            }
            return
        }

        // Stop all receivers
        console.log(`Stopping all NDI receivers`)
        Object.keys(this.NDI_RECEIVERS).forEach(sourceId => {
            if (this.NDI_RECEIVERS[sourceId]) {
                this.NDI_RECEIVERS[sourceId].shouldStop = true
            }
        })
        
        // Clean up all receiver data after brief delay
        setTimeout(() => {
            this.NDI_RECEIVERS = {}
        }, 100)
    }
}