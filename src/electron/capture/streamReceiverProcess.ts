// Runs in an Electron utilityProcess: owns every NDI/OMT receive loop, the frame packing and the
// preview downscale, and posts frames straight to the renderers that draw them over MessagePorts.
//
// Video must never touch the main thread. Receiving in the main process cost it ~15ms of event-loop
// lag per 4K source (the IPC write alone is ~17ms per 8MB frame), which is what made the UI crawl
// while a stream was live. From here the main process only brokers ports and control messages: it
// never sees a frame, and its lag stays around 1ms no matter how many 4K sources are running.

import { ensureOmtCodecSearchPath } from "../omt/omtModule"
import { packStreamFrame, previewStreamFrame, type StreamFrame, type StreamFrameFormat } from "./streamFrames"

const parentPort: any = (process as any).parentPort

// ----- transport -----

// the app window draws previews a few hundred pixels wide
const PREVIEW_MAX_WIDTH = 480
const APP_TARGET = "app"

// How many frames a window may have in flight is measured, not chosen: a frame's round trip (post to
// ack) divided by the source's frame interval is how many must overlap to keep the transport busy on
// this machine. A 4K frame's round trip is ~100ms, so at 17fps it takes two; a 1080p frame's is
// shorter, so one. Beyond that the newest frame waits its turn, replacing whatever was waiting: the
// window is never sent a frame it will have to catch up on. A window that goes away is dropped by
// the main process (see StreamReceiverHost), so no timeout is needed to notice one either.
type Pending = { ipcChannel: string; id: string; frame: StreamFrame; time: number }
type Subscriber = {
    port: any
    inFlight: number
    sentAt: number[]
    pending: Pending | null
    roundTrip: number // measured post->ack, ms (smoothed)
    frameInterval: number // measured arrival spacing, ms (smoothed)
    lastFrameAt: number
}

// smoothing weight for the two measurements above; a weight, not a machine-dependent threshold
const SMOOTHING = 0.2

function smooth(previous: number, sample: number) {
    return previous ? previous + (sample - previous) * SMOOTHING : sample
}

function allowedInFlight(subscriber: Subscriber) {
    if (!subscriber.roundTrip || !subscriber.frameInterval) return 1
    return Math.max(1, Math.ceil(subscriber.roundTrip / subscriber.frameInterval))
}
const subscribers: { [targetId: string]: Subscriber } = {}
const requestedPorts = new Set<string>()

function toMain(message: any) {
    parentPort?.postMessage(message)
}

function log(text: string) {
    toMain({ type: "log", text })
}

// A port is only asked for when there is actually a frame to deliver, so nothing is wired up for
// outputs that never show a stream.
function needPort(targetId: string, preview: boolean) {
    if (subscribers[targetId] || requestedPorts.has(targetId)) return
    requestedPorts.add(targetId)
    toMain({ type: "needPort", targetId, preview })
}

// Frames are structured-cloned rather than transferred: a MessagePortMain transfer list only accepts
// ports, and the copy happens here, off the main thread, which is the whole point.
//
// Sending faster than a window draws only grows a backlog, and the frames then arrive later and
// later, which looks like a stall rather than a dropped frame. So one frame is in flight at a time
// and the newest replaces whatever was waiting: live video wants the newest frame, not every frame.
function deliver(targetId: string, ipcChannel: string, id: string, frame: StreamFrame, time: number) {
    const subscriber = subscribers[targetId]
    if (!subscriber) return

    if (subscriber.lastFrameAt) subscriber.frameInterval = smooth(subscriber.frameInterval, time - subscriber.lastFrameAt)
    subscriber.lastFrameAt = time

    if (subscriber.inFlight >= allowedInFlight(subscriber)) {
        subscriber.pending = { ipcChannel, id, frame, time }
        return
    }

    post(targetId, subscriber, { ipcChannel, id, frame, time })
}

function post(targetId: string, subscriber: Subscriber, next: Pending) {
    try {
        subscriber.inFlight++
        subscriber.sentAt.push(Date.now())
        subscriber.port.postMessage({
            ipcChannel: next.ipcChannel,
            args: { channel: "RECEIVE_STREAM", data: { id: next.id, frame: next.frame, time: next.time } }
        })
    } catch {
        delete subscribers[targetId]
        requestedPorts.delete(targetId)
    }
}

// the window took a frame: measure the round trip, then send whatever arrived meanwhile, newest only
function onAck(targetId: string) {
    const subscriber = subscribers[targetId]
    if (!subscriber) return

    subscriber.inFlight = Math.max(0, subscriber.inFlight - 1)
    const sentAt = subscriber.sentAt.shift()
    if (sentAt) subscriber.roundTrip = smooth(subscriber.roundTrip, Date.now() - sentAt)

    const next = subscriber.pending
    if (!next || subscriber.inFlight >= allowedInFlight(subscriber)) return

    subscriber.pending = null
    post(targetId, subscriber, next)
}

// Outputs render the stream itself and need every pixel; the app window only ever previews it (drawer
// card, output mirror) so it gets a small copy of every frame, which keeps the preview as smooth as
// the output without paying full frame size for it.
function sendFrame(ipcChannel: string, id: string, outputIds: string[], packed: StreamFrame) {
    const time = Date.now()

    outputIds.forEach((outputId) => {
        needPort(outputId, false)
        deliver(outputId, ipcChannel, id, packed, time)
    })

    needPort(APP_TARGET, true)
    if (subscribers[APP_TARGET]) deliver(APP_TARGET, ipcChannel, id, previewStreamFrame(packed, PREVIEW_MAX_WIDTH), time)
}

type ReceiverState = {
    shouldStop?: boolean
    source: any
    lowbandwidth?: boolean
}

// ----- NDI -----

let grandioseModule: any = null
let grandioseWarned = false
async function loadGrandiose() {
    if (grandioseModule) return grandioseModule
    try {
        grandioseModule = await import("grandiose")
        return grandioseModule
    } catch (err: any) {
        if (!grandioseWarned) log("NDI not available: " + err.message)
        grandioseWarned = true
        return null
    }
}

class Ndi {
    static receivers: { [id: string]: ReceiverState } = {}
    static active: { [id: string]: any } = {}
    static outputs: string[] = []
    static fourCCUyvy: number | null = null
    private static findInterval: NodeJS.Timeout | null = null

    static async createReceiver(source: { name: string; urlAddress: string }, lowbandwidth = false) {
        try {
            const grandiose = await loadGrandiose()
            if (!grandiose) return null

            // UYVY is half the bytes of RGBA and every one of them costs time in the copy to the
            // renderer; the renderer converts it on the GPU. Sources with alpha still arrive as RGBA.
            this.fourCCUyvy = grandiose.FOURCC_UYVY
            const config: any = {
                source,
                colorFormat: grandiose.COLOR_FORMAT_UYVY_RGBA,
                allowVideoFields: false
            }
            if (lowbandwidth) config.bandwidth = grandiose.BANDWIDTH_LOWEST

            let timeout: NodeJS.Timeout | null = null
            try {
                return await Promise.race([
                    grandiose.receive(config),
                    new Promise((_, reject) => {
                        timeout = setTimeout(() => reject(new Error("NDI receiver timeout")), 10000)
                    })
                ])
            } catch (err: any) {
                log("Failed to create NDI receiver: " + err.message)
                return null
            } finally {
                if (timeout) clearTimeout(timeout)
            }
        } catch (err: any) {
            log("Failed to create NDI receiver: " + err.message)
            return null
        }
    }

    static async findStreams(data: { groups?: string }) {
        if (this.findInterval) clearInterval(this.findInterval)

        const grandiose = await loadGrandiose()
        if (!grandiose) return []

        const finder: any = await grandiose.find({
            showLocalSources: true,
            groups: data.groups || ""
        })
        return new Promise<any[]>((resolve) => {
            // without the interval it only finds one source: https://github.com/emanspeaks/grandiose/commit/271cd73b5269ab827155a1a944c15d3b5fe4d564
            let previousLength = 0
            this.findInterval = setInterval(() => {
                const sources = finder.sources()
                if (previousLength === sources.length) {
                    clearInterval(this.findInterval!)
                    resolve(sources)
                }
                previousLength = sources.length
            }, 1000)
        })
    }

    static handleError(err: any, consecutiveErrors: number) {
        const msg = err.message || ""
        if (msg.includes("Non-video data received"))
            return {
                shouldContinue: true,
                delay: 0,
                newErrorCount: Math.max(0, consecutiveErrors - 1)
            }
        if (msg.includes("No video data received"))
            return {
                shouldContinue: true,
                delay: 1,
                newErrorCount: consecutiveErrors
            }

        const newCount = consecutiveErrors + 1
        return {
            shouldContinue: newCount < 10,
            delay: Math.min(5 * Math.pow(1.5, newCount), 100),
            newErrorCount: newCount
        }
    }

    static async frameLoop(sourceId: string, thumbnail: boolean) {
        let consecutiveErrors = 0

        while (this.receivers[sourceId] && !this.receivers[sourceId].shouldStop) {
            const state = this.receivers[sourceId]
            try {
                let receiver = this.active[sourceId]
                if (!receiver) {
                    const source = state.source
                    receiver = this.active[sourceId] = await this.createReceiver({ name: source.name, urlAddress: source.urlAddress || source.id }, state.lowbandwidth)
                }
                if (!receiver?.video) {
                    delete this.active[sourceId]
                    throw new Error("No video data received")
                }

                const rawFrame = await receiver.video(50)
                if (rawFrame) {
                    this.sendBuffer(sourceId, rawFrame)
                    consecutiveErrors = 0

                    // video() already blocks until the next frame, so pace on the source: waiting
                    // after every frame pushes the next fetch past the frame after it
                    if (thumbnail) await new Promise((resolve) => setTimeout(resolve, 500))
                    else await new Promise((resolve) => setImmediate(resolve))
                    continue
                }
            } catch (err: any) {
                const { shouldContinue, delay, newErrorCount } = this.handleError(err, consecutiveErrors)
                consecutiveErrors = newErrorCount

                if (!shouldContinue) {
                    log("NDI source " + sourceId + ": too many errors, stopping")
                    this.stop({ id: sourceId })
                    return
                }

                await new Promise((resolve) => setTimeout(resolve, delay))
            }
        }
    }

    static sendBuffer(id: string, frame: any) {
        if (!frame?.data) return

        const format: StreamFrameFormat = frame.fourCC === this.fourCCUyvy ? "uyvy" : "rgba"
        const packed = packStreamFrame(frame.data, frame.xres, frame.yres, frame.lineStrideBytes || 0, format)
        if (!packed) return

        sendFrame("NDI", id, this.outputs, packed)
    }

    static async thumbnail({ source }: { source: any }) {
        if (this.receivers[source.id]) return
        this.receivers[source.id] = {
            shouldStop: false,
            source,
            lowbandwidth: true
        }
        this.frameLoop(source.id, true).catch((err) => log("NDI thumbnail error for " + source.id + ": " + err.message))
    }

    static async capture({ source, outputId }: { source: any; outputId: string }) {
        if (!this.outputs.includes(outputId)) this.outputs.push(outputId)

        // if a thumbnail loop is running, upgrade it to full capture
        if (this.receivers[source.id]) {
            this.receivers[source.id].shouldStop = true
            await new Promise((resolve) => setTimeout(resolve, 100))
        }
        delete this.active[source.id]

        this.receivers[source.id] = {
            shouldStop: false,
            source,
            lowbandwidth: false
        }
        this.frameLoop(source.id, false).catch((err) => {
            log("NDI reception error for " + source.id + ": " + err.message)
            this.stop({ id: source.id })
        })
    }

    static stop(data: { id: string; outputId?: string } | null = null) {
        if (data?.id) {
            if (data.outputId) {
                const index = this.outputs.indexOf(data.outputId)
                if (index >= 0) this.outputs.splice(index, 1)
            } else this.outputs = []

            if (!this.outputs.length && this.receivers[data.id]) {
                this.receivers[data.id].shouldStop = true
                setTimeout(() => {
                    delete this.active[data.id]
                    delete this.receivers[data.id]
                }, 100)
            }
            return
        }

        Object.keys(this.receivers).forEach((id) => (this.receivers[id].shouldStop = true))
        setTimeout(() => {
            this.active = {}
            this.receivers = {}
        }, 100)
    }
}

// ----- OMT -----

let omtModule: any = null
let omtWarned = false
async function loadOmt() {
    if (omtModule) return omtModule
    try {
        // the codec DLL lives beside the addon; this process has its own environment, so the search
        // path set here is the one its loader actually uses
        ensureOmtCodecSearchPath()
        omtModule = await import("openmediatransport")
        return omtModule
    } catch (err: any) {
        if (!omtWarned) log("OMT not available: " + err.message)
        omtWarned = true
        return null
    }
}

// One loop per source. The loop is the only thing that ever calls receive() or destroy() on its
// instance, and it destroys the instance itself after its final receive() has settled: the addon runs
// receive() on the libuv threadpool holding the raw libomt pointer, so a destroy from anywhere else
// while one is in flight is a use-after-free. A loop ends when it is stopped or its record is replaced,
// checked after every await; callers that need the instance gone await the loop, not a timer.
type OmtLoop = {
    source: any
    lowbandwidth: boolean
    stopped: boolean
    receiver: any
    done: Promise<void>
    wake: (() => void) | null
}

class Omt {
    // Reference count per output: an output's two crossfade layers each mount a stream component for
    // the same source and output, so a plain list would let the first one to unmount stop a live
    // stream that the other still shows.
    private static outputRefs: { [outputId: string]: number } = {}
    static codecs: any = null
    private static loops: { [sourceId: string]: OmtLoop } = {}

    private static get outputs() {
        return Object.keys(this.outputRefs)
    }

    private static readonly RECEIVE_TIMEOUT_MS = 50
    private static readonly FULL_LOOP_DELAY_MS = 16 // ~60fps ceiling
    private static readonly THUMBNAIL_LOOP_DELAY_MS = 500

    static async createReceiver(address: string, lowbandwidth = false) {
        try {
            const omt = await loadOmt()
            if (!omt) return null
            this.codecs = omt.Codec

            // UYVY where the source allows it; the renderer converts on the GPU. Sources with alpha still arrive as BGRA.
            const flags = lowbandwidth ? omt.ReceiveFlags.Preview : omt.ReceiveFlags.None
            return new omt.Receiver(address, omt.FrameType.Video, omt.PreferredVideoFormat.UYVYorBGRA, flags)
        } catch (err: any) {
            log("Failed to create OMT receiver: " + err.message)
            return null
        }
    }

    static async findStreams() {
        const omt = await loadOmt()
        if (!omt) return []

        // discovery populates over time (DNS-SD); poll briefly until we have results
        let addresses: string[] = []
        for (let attempt = 0; attempt < 4; attempt++) {
            addresses = omt.getAddresses() || []
            if (addresses.length) break
            await new Promise((resolve) => setTimeout(resolve, 400))
        }

        return addresses.map((address) => ({ name: address, urlAddress: address }))
    }

    static async thumbnail({ source }: { source: any }) {
        const existing = this.loops[source.id]
        if (existing) {
            if (!existing.stopped) return
            await this.stopLoop(existing)
        }
        this.startLoop(source, true, this.THUMBNAIL_LOOP_DELAY_MS)
    }

    static async capture({ source, outputId }: { source: any; outputId: string }) {
        this.outputRefs[outputId] = (this.outputRefs[outputId] || 0) + 1

        // a running full-quality loop already serves this source; a thumbnail loop holds a
        // low-bandwidth instance and a stopping loop still holds its instance, so either is ended and
        // awaited before the full-quality one starts
        const existing = this.loops[source.id]
        if (existing) {
            if (!existing.lowbandwidth && !existing.stopped) return
            await this.stopLoop(existing)
        }

        this.startLoop(source, false, this.FULL_LOOP_DELAY_MS)
    }

    private static startLoop(source: any, lowbandwidth: boolean, delayMs: number) {
        const loop: OmtLoop = { source, lowbandwidth, stopped: false, receiver: null, done: Promise.resolve(), wake: null }
        this.loops[source.id] = loop
        loop.done = this.frameLoop(source.id, loop, delayMs).catch((err) => log("OMT reception error for " + source.id + ": " + err.message))
    }

    // ends the loop and resolves once it has destroyed its instance
    private static stopLoop(loop: OmtLoop) {
        loop.stopped = true
        loop.wake?.()
        return loop.done
    }

    // a sleep that ends early when the loop is stopped, so a stop never waits out a thumbnail interval
    private static pause(loop: OmtLoop, ms: number) {
        return new Promise<void>((resolve) => {
            const timer = setTimeout(finish, ms)
            function finish() {
                clearTimeout(timer)
                loop.wake = null
                resolve()
            }
            loop.wake = finish
        })
    }

    private static async frameLoop(sourceId: string, loop: OmtLoop, delayMs: number) {
        let consecutiveErrors = 0

        try {
            // a replaced record belongs to a newer loop for the same source: this one is finished
            while (!loop.stopped && this.loops[sourceId] === loop) {
                try {
                    if (!loop.receiver) {
                        loop.receiver = await this.createReceiver(loop.source.urlAddress || loop.source.id, loop.lowbandwidth)
                        if (!loop.receiver) throw new Error("Could not create receiver")
                        if (loop.stopped) break
                    }

                    const frame = await loop.receiver.receive(this.RECEIVE_TIMEOUT_MS, 2 /* Video */)
                    if (loop.stopped) break
                    if (frame?.data) {
                        this.sendBuffer(sourceId, frame)
                        consecutiveErrors = 0
                    }

                    // receive() already blocks until the next frame, so pace on the source rather than a timer.
                    // Idle (no frame) still backs off, and thumbnails keep their slow rate.
                    if (frame?.data && delayMs < this.THUMBNAIL_LOOP_DELAY_MS) await new Promise((resolve) => setImmediate(resolve))
                    else await this.pause(loop, delayMs)
                } catch (err: any) {
                    consecutiveErrors++
                    // the failed receive() has settled, so this loop's instance can be dropped and recreated
                    this.destroyInstance(loop)

                    if (consecutiveErrors >= 10) {
                        log("OMT source " + sourceId + ": too many errors, stopping")
                        loop.stopped = true
                        break
                    }

                    await this.pause(loop, Math.min(5 * Math.pow(1.5, consecutiveErrors), 100))
                }
            }
        } finally {
            // every receive() this loop issued has settled by now, so nothing can still be using it
            this.destroyInstance(loop)
            if (this.loops[sourceId] === loop) delete this.loops[sourceId]
        }
    }

    private static destroyInstance(loop: OmtLoop) {
        const receiver = loop.receiver
        loop.receiver = null
        if (!receiver) return
        try {
            receiver.destroy()
        } catch (err: any) {
            log("Error destroying OMT receiver: " + err.message)
        }
    }

    static sendBuffer(id: string, frame: any) {
        if (!frame?.data) return

        const format: StreamFrameFormat = frame.codec === this.codecs?.UYVY ? "uyvy" : "bgra"
        const packed = packStreamFrame(frame.data, frame.width, frame.height, frame.stride || 0, format)
        if (!packed) return

        sendFrame("OMT", id, this.outputs, packed)
    }

    static stop(data: { id: string; outputId?: string } | null = null): Promise<void> {
        if (data?.id) {
            if (data.outputId) {
                const refs = (this.outputRefs[data.outputId] || 0) - 1
                if (refs > 0) this.outputRefs[data.outputId] = refs
                else delete this.outputRefs[data.outputId]
            } else this.outputRefs = {}

            const loop = this.loops[data.id]
            if (!this.outputs.length && loop) return this.stopLoop(loop)
            return Promise.resolve()
        }

        return Promise.all(Object.values(this.loops).map((loop) => this.stopLoop(loop))).then(() => undefined)
    }
}

// ----- control channel -----

const HANDLERS: { [type: string]: (data: any) => any } = {
    "ndi:find": (data) => Ndi.findStreams(data || {}),
    "ndi:thumbnail": (data) => Ndi.thumbnail(data),
    "ndi:capture": (data) => Ndi.capture(data),
    "ndi:stop": (data) => Ndi.stop(data),
    "omt:find": () => Omt.findStreams(),
    "omt:thumbnail": (data) => Omt.thumbnail(data),
    "omt:capture": (data) => Omt.capture(data),
    "omt:stop": (data) => Omt.stop(data)
}

parentPort.on("message", async (e: any) => {
    const message = e.data
    if (!message) return

    if (message.type === "port") {
        const port = e.ports?.[0]
        if (!port) return
        requestedPorts.delete(message.targetId)
        subscribers[message.targetId] = { port, inFlight: 0, sentAt: [], pending: null, roundTrip: 0, frameInterval: 0, lastFrameAt: 0 }
        port.on("message", () => onAck(message.targetId))
        port.start()
        return
    }

    if (message.type === "dropPort") {
        delete subscribers[message.targetId]
        requestedPorts.delete(message.targetId)
        return
    }

    const handler = HANDLERS[message.type]
    if (!handler) return

    try {
        const value = await handler(message.data)
        if (message.requestId) toMain({ type: "result", requestId: message.requestId, value })
    } catch (err: any) {
        if (message.requestId)
            toMain({
                type: "result",
                requestId: message.requestId,
                value: null,
                error: err.message
            })
        else log(message.type + " failed: " + err.message)
    }
})
