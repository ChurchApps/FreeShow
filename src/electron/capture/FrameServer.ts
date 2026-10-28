// Loopback WebSocket frame server: pixels go through shared-memory ring slots, or as binary messages to windows without osr-capture.

import http from "http"
import { randomBytes } from "crypto"

export type ServedFrame = { xres: number; yres: number; data: Buffer; format: string }

export type FrameServerOptions = {
    log: (text: string) => void
    onListening: (info: { port: number; token: string }) => void
    /** called once per target that has frames but no window */
    onNeedTarget?: (targetId: string, preview: boolean) => void
    /** refcount hooks for frames held while waiting or being copied */
    retain?: (frame: ServedFrame) => void
    release?: (frame: ServedFrame) => void
    /** log delivery stats every second */
    stats?: boolean
}

type Pending = { ipcChannel: string; id: string; frame: ServedFrame; time: number }
type ShmRing = { name: string; slotBytes: number; slots: number; busy: boolean[]; announced: boolean }
type Subscriber = {
    ws: any
    inFlight: number
    sentAt: number[]
    roundTrips: number[] // post->ack samples, ms
    pending: Pending | null
    roundTrip: number // min of roundTrips
    frameInterval: number // smoothed arrival spacing, ms
    lastFrameAt: number
    wantsShm: boolean
    ring: ShmRing | null
}

// initial ring slots; growRing adds more
const SHM_SLOTS = 3
const SMOOTHING = 0.2
const ROUND_TRIP_SAMPLES = 32

let shmModule: any = null
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    shmModule = require("osr-capture")
    if (typeof shmModule?.shmMap !== "function" || typeof shmModule?.shmWriteAsync !== "function") shmModule = null
} catch {
    shmModule = null
}
let shmSeq = 0

function smooth(previous: number, sample: number) {
    return previous ? previous + (sample - previous) * SMOOTHING : sample
}

export class FrameServer {
    private subscribers: { [targetId: string]: Subscriber } = {}
    private requested = new Set<string>()
    private token = randomBytes(24).toString("hex")
    private port = 0
    private server: http.Server
    private wss: any
    private stats: { [targetId: string]: { offered: number; posted: number; acked: number; replaced: number } } = {}
    private stallTimer: NodeJS.Timeout | null = null
    private statsTimer: NodeJS.Timeout | null = null
    /** ms spent in shared-memory copies */
    shmMs = 0

    constructor(private opts: FrameServerOptions) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { WebSocketServer } = require("ws")
        this.server = http.createServer((_req, res) => {
            res.statusCode = 404
            res.end()
        })
        this.wss = new WebSocketServer({ server: this.server, perMessageDeflate: false })
        this.server.listen(0, "127.0.0.1", () => {
            const address = this.server.address()
            this.port = typeof address === "object" && address ? address.port : 0
            opts.onListening({ port: this.port, token: this.token })
        })
        this.wss.on("connection", (ws: any) => this.onConnection(ws))
        if (opts.stats) this.statsTimer = setInterval(() => this.logStats(), 1000)
        this.stallTimer = setInterval(() => this.sweepStalled(), 1000)
    }

    get info() {
        return this.port ? { port: this.port, token: this.token } : null
    }

    hasSubscriber(targetId: string) {
        return !!this.subscribers[targetId]
    }

    /** true = connected, false = requested */
    targets(): { [targetId: string]: boolean } {
        const out: { [targetId: string]: boolean } = {}
        for (const id of Object.keys(this.subscribers)) out[id] = true
        for (const id of this.requested) out[id] = false
        return out
    }

    request(targetId: string, preview = false) {
        if (this.subscribers[targetId] || this.requested.has(targetId)) return
        this.requested.add(targetId)
        this.opts.onNeedTarget?.(targetId, preview)
    }

    private onConnection(ws: any) {
        let targetId = ""
        ws.on("message", (raw: any, isBinary: boolean) => {
            if (isBinary) return
            const text = raw.toString()
            if (!targetId) {
                // handshake: { token, targetId, shm }; shm = window can map shared memory
                let hello: any = null
                try {
                    hello = JSON.parse(text)
                } catch {
                    hello = null
                }
                if (!hello || hello.token !== this.token || typeof hello.targetId !== "string") {
                    ws.close()
                    return
                }
                targetId = hello.targetId
                if (this.opts.stats) this.opts.log(`window ${targetId} connected, shared memory: ${!!hello.shm && !!shmModule} (window ${!!hello.shm}, here ${!!shmModule})`)
                this.requested.delete(targetId)
                if (this.subscribers[targetId]?.ws !== ws) this.drop(targetId)
                this.subscribers[targetId] = { ws, inFlight: 0, sentAt: [], roundTrips: [], pending: null, roundTrip: 0, frameInterval: 0, lastFrameAt: 0, wantsShm: !!hello.shm && !!shmModule, ring: null }
                return
            }
            if (text === "1") this.onAck(targetId, -1)
            else if (text.startsWith("1:")) this.onAck(targetId, Number(text.slice(2)))
        })
        ws.on("close", () => {
            if (targetId && this.subscribers[targetId]?.ws === ws) this.drop(targetId)
        })
        ws.on("error", () => {})
    }

    /** the next frame requests the window again */
    drop(targetId: string) {
        this.requested.delete(targetId)
        const sub = this.subscribers[targetId]
        if (!sub) return
        if (sub.pending) this.release(sub.pending.frame)
        this.dropRing(sub.ring)
        try {
            sub.ws?.close()
        } catch {}
        delete this.subscribers[targetId]
    }

    close() {
        for (const id of Object.keys(this.subscribers)) this.drop(id)
        if (this.statsTimer) clearInterval(this.statsTimer)
        if (this.stallTimer) clearInterval(this.stallTimer)
        try {
            this.wss.close()
            this.server.close()
        } catch {}
    }

    /** retains the frame until it is copied out or replaced by a newer one */
    deliver(targetId: string, ipcChannel: string, id: string, frame: ServedFrame, time: number, preview = false) {
        const subscriber = this.subscribers[targetId]
        if (!subscriber) {
            this.request(targetId, preview)
            return
        }

        if (subscriber.lastFrameAt) subscriber.frameInterval = smooth(subscriber.frameInterval, time - subscriber.lastFrameAt)
        subscriber.lastFrameAt = time

        this.stat(targetId).offered++
        this.retain(frame)
        if (!this.canPost(subscriber)) {
            if (subscriber.pending) {
                this.stat(targetId).replaced++
                this.release(subscriber.pending.frame)
            }
            subscriber.pending = { ipcChannel, id, frame, time }
            return
        }
        this.post(targetId, subscriber, { ipcChannel, id, frame, time })
    }

    private retain(frame: ServedFrame) {
        this.opts.retain?.(frame)
    }
    private release(frame: ServedFrame) {
        this.opts.release?.(frame)
    }
    private stat(targetId: string) {
        return (this.stats[targetId] ||= { offered: 0, posted: 0, acked: 0, replaced: 0 })
    }

    // min round trip, not the average: a lagging window's longer round trips would grow its own backlog
    private neededDepth(subscriber: Subscriber) {
        if (!subscriber.roundTrip || !subscriber.frameInterval) return 1
        return Math.ceil(subscriber.roundTrip / subscriber.frameInterval) + 1
    }

    private allowedInFlight(subscriber: Subscriber) {
        const depth = this.neededDepth(subscriber)
        return subscriber.ring ? Math.min(depth, subscriber.ring.slots) : depth
    }

    // only while idle: reallocating the region would pull a slot from under a reader
    private growRing(targetId: string, subscriber: Subscriber) {
        const ring = subscriber.ring
        if (!ring || subscriber.inFlight > 0 || subscriber.pending) return
        const needed = this.neededDepth(subscriber)
        if (needed <= ring.slots) return

        const grown = this.createRing(ring.slotBytes, needed)
        if (!grown) return
        this.opts.log(`[${targetId}] window needs ${needed} frames in flight; ring grown from ${ring.slots} slots`)
        this.dropRing(ring)
        subscriber.ring = grown
    }

    // frees slots of a window that stopped acking; the bound is relative to its own round trips
    private sweepStalled() {
        const now = Date.now()
        for (const targetId of Object.keys(this.subscribers)) {
            const subscriber = this.subscribers[targetId]
            const oldest = subscriber.sentAt[0]
            if (!subscriber.inFlight || oldest === undefined) continue

            const worst = subscriber.roundTrips.length ? Math.max(...subscriber.roundTrips) : 0
            const slots = subscriber.ring?.slots || 1
            const limit = Math.max(worst, subscriber.frameInterval * slots) * ROUND_TRIP_SAMPLES
            if (!limit || now - oldest < limit) continue

            this.opts.log(`[${targetId}] window stopped acking ${Math.round(now - oldest)}ms ago; reclaiming ${subscriber.inFlight} frame(s)`)
            if (subscriber.ring) subscriber.ring.busy.fill(false)
            subscriber.inFlight = 0
            subscriber.sentAt = []
            if (subscriber.pending) {
                this.release(subscriber.pending.frame)
                subscriber.pending = null
            }
        }
    }

    private canPost(subscriber: Subscriber) {
        if (subscriber.inFlight >= this.allowedInFlight(subscriber)) return false
        return !subscriber.ring || this.freeSlot(subscriber.ring) >= 0 || subscriber.ring.slotBytes < (subscriber.pending?.frame.data.length || 0)
    }

    private freeSlot(ring: ShmRing) {
        return ring.busy.indexOf(false)
    }

    private createRing(slotBytes: number, slots = SHM_SLOTS): ShmRing | null {
        if (!shmModule) return null
        const name = `fs-${process.pid}-${++shmSeq}`
        try {
            shmModule.shmMap(name, slotBytes * slots, true)
            return { name, slotBytes, slots, busy: new Array(slots).fill(false), announced: false }
        } catch (err: any) {
            this.opts.log("shared memory unavailable: " + err?.message)
            shmModule = null
            return null
        }
    }

    private dropRing(ring: ShmRing | null | undefined) {
        if (!ring) return
        try {
            shmModule?.shmUnmap(ring.name)
        } catch {}
    }

    // shm: the header is sent once the slot holds the frame; otherwise header then binary pixels
    private post(targetId: string, subscriber: Subscriber, next: Pending) {
        try {
            const header: any = { ipcChannel: next.ipcChannel, id: next.id, time: next.time, xres: next.frame.xres, yres: next.frame.yres, format: next.frame.format }
            if (subscriber.wantsShm) {
                const bytes = next.frame.data.length
                if (!subscriber.ring || subscriber.ring.slotBytes < bytes) {
                    this.dropRing(subscriber.ring)
                    subscriber.ring = this.createRing(bytes)
                    if (!subscriber.ring) subscriber.wantsShm = false
                }
                const ring = subscriber.ring
                if (ring) {
                    const slot = this.freeSlot(ring)
                    if (slot < 0) {
                        subscriber.pending = next
                        return
                    }
                    ring.busy[slot] = true
                    header.slot = slot
                    header.bytes = bytes
                    if (!ring.announced) {
                        header.shm = { name: ring.name, slotBytes: ring.slotBytes, slots: ring.slots }
                        ring.announced = true
                    }
                    subscriber.inFlight++
                    this.stat(targetId).posted++
                    subscriber.sentAt.push(Date.now())
                    const tShm = performance.now()
                    const ws = subscriber.ws
                    shmModule.shmWriteAsync(ring.name, slot * ring.slotBytes, next.frame.data).then(
                        () => {
                            this.shmMs += performance.now() - tShm
                            this.release(next.frame)
                            if (this.subscribers[targetId]?.ws === ws) ws.send(JSON.stringify(header))
                        },
                        () => {
                            this.release(next.frame)
                            if (this.subscribers[targetId]?.ws === ws) this.onAck(targetId, slot)
                        }
                    )
                    return
                }
            }
            subscriber.inFlight++
            this.stat(targetId).posted++
            subscriber.sentAt.push(Date.now())
            subscriber.ws.send(JSON.stringify(header))
            subscriber.ws.send(next.frame.data, { binary: true }, () => this.release(next.frame))
        } catch {
            this.release(next.frame)
            this.drop(targetId)
        }
    }

    private onAck(targetId: string, slot: number) {
        const subscriber = this.subscribers[targetId]
        if (!subscriber) return
        this.stat(targetId).acked++
        if (slot >= 0 && subscriber.ring && slot < subscriber.ring.slots) subscriber.ring.busy[slot] = false

        subscriber.inFlight = Math.max(0, subscriber.inFlight - 1)
        const sentAt = subscriber.sentAt.shift()
        if (sentAt) {
            subscriber.roundTrips.push(Date.now() - sentAt)
            if (subscriber.roundTrips.length > ROUND_TRIP_SAMPLES) subscriber.roundTrips.shift()
            subscriber.roundTrip = Math.min(...subscriber.roundTrips)
        }

        const next = subscriber.pending
        if (!next) {
            this.growRing(targetId, subscriber)
            return
        }
        if (!this.canPost(subscriber)) return
        subscriber.pending = null
        this.post(targetId, subscriber, next)
    }

    // acked/s = frames the window drew
    private logStats() {
        for (const [targetId, st] of Object.entries(this.stats)) {
            const sub = this.subscribers[targetId]
            if (!st.offered && !st.acked) continue
            this.opts.log(`[RX-STATS ${targetId}] offered=${st.offered} posted=${st.posted} acked=${st.acked} replaced=${st.replaced} inFlight=${sub?.inFlight ?? 0}/${sub ? this.allowedInFlight(sub) : 0} rtt=${sub ? Math.round(sub.roundTrip) : 0}ms interval=${sub ? Math.round(sub.frameInterval) : 0}ms`)
            st.offered = st.posted = st.acked = st.replaced = 0
        }
    }
}
