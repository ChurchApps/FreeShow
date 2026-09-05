import { BrowserWindow, screen, type BrowserWindowConstructorOptions } from "electron"
import { OUTPUT_CONSOLE, getMainWindow, hardwareAccelerationDisabled, isMac, loadWindowContent, toApp } from "../.."
import { OUTPUT } from "../../../types/Channels"
import type { Output } from "../../../types/Output"
import { BlackmagicSender } from "../../blackmagic/BlackmagicSender"
import { initializeSender } from "../../blackmagic/bmdTalk"
import { CaptureHelper } from "../../capture/CaptureHelper"
import { NdiSender } from "../../ndi/NdiSender"
import { setDataNDI } from "../../ndi/talk"
import { wait } from "../../utils/helpers"
import { outputOptions } from "../../utils/windowOptions"
import { OutputHelper } from "../OutputHelper"
import { setOutputAlwaysOnTop } from "./OutputAlwaysOnTop"
import { OutputVisibility } from "./OutputVisibility"
import { RenderGroups } from "./RenderGroups"

// Tracks timing stages for off-main GPU readback and transmission (in ms)
type OffMainSegments = { consume: number; finish: number; enqueue: number; doneMain: number }

// Tracks adaptive pipeline depth (how many frames can be in-flight concurrently)
// based on measured round-trip time (RTT) to prevent queue buildup or starvation.
type OffMainState = {
    samples: { rtt: number; unc: boolean; seg?: OffMainSegments }[]
    px: number
    depth: number
    pendingDepth: number
    depthStreak: number
}

export class OutputLifecycle {
    private static pendingCaptureStart: { [id: string]: NodeJS.Timeout } = {}

    private static clearPendingCaptureStart(id: string) {
        const pending = this.pendingCaptureStart[id]
        if (!pending) return

        clearTimeout(pending)
        delete this.pendingCaptureStart[id]
    }

    static initListeners() {
        RenderGroups.onChanged = () => toApp(OUTPUT, { channel: "RENDER_GROUPS", data: RenderGroups.snapshot() })

        screen.on("display-metrics-changed", () => {
            setTimeout(() => this.restoreAllOutputBounds(), 500)
        })
        screen.on("display-added", () => {
            setTimeout(() => this.restoreAllOutputBounds(), 1000)
        })
        screen.on("display-removed", () => {
            this.restoreAllOutputBounds()
        })
    }

    static restoreAllOutputBounds() {
        OutputHelper.getKeys().forEach((id) => {
            const output = OutputHelper.getOutput(id)
            if (!output || !output.window || output.window.isDestroyed()) return
            if (!output.intendedBounds) return

            // invisible/capture outputs: re-apply so the DPI-corrected render size follows scale changes
            if (output.invisible) {
                const expected = OutputHelper.Bounds.getRenderBounds(output, output.intendedBounds)
                const currentBounds = output.window.getBounds()
                if (currentBounds.width !== expected.width || currentBounds.height !== expected.height) {
                    OutputHelper.Bounds.updateBounds({ id, bounds: output.intendedBounds })
                }
                return
            }

            // if a specific screen is selected, check if it's available
            if (output.screen) {
                const displays = screen.getAllDisplays()
                const targetDisplay = displays.find((d) => d.id.toString() === output.screen)
                if (!targetDisplay) return
            }

            const targetBounds = OutputVisibility.resolveOutputBounds({ ...output, bounds: output.intendedBounds, id })
            const currentBounds = output.window.getBounds()
            if (JSON.stringify(currentBounds) !== JSON.stringify(targetBounds)) {
                OutputHelper.Bounds.updateBounds({ id, bounds: targetBounds })
            }
        })
    }

    static async createOutput(output: Output, groupRetries = 0) {
        const id: string = output.id || ""
        if (!id) return

        if (OutputHelper.getOutput(id)) {
            CaptureHelper.Lifecycle.stopCapture(id)
            this.removeOutput(id, output)
            return
        }

        this.clearPendingCaptureStart(id)

        // Shared-render: outputs with identical content share one render window
        const shareEligible = RenderGroups.enabled && this.canShareRender(output)
        const group = shareEligible ? RenderGroups.add(id, output) : { isRenderer: true, rendererId: id }
        if (!group.isRenderer) {
            const rendererWin = OutputHelper.getOutput(group.rendererId)?.window
            if (rendererWin && !rendererWin.isDestroyed()) {
                await this.createFollowerOutput(id, output, group.rendererId, rendererWin)
                return
            }
            RenderGroups.remove(id)
            if (groupRetries < 5) {
                setTimeout(() => {
                    if (!OutputHelper.getOutput(id)) void this.createOutput(output, groupRetries + 1)
                }, 300)
                return
            }
            console.warn(`[GROUP] renderer window for ${group.rendererId} never became ready; ${id} rendering independently`)
        }

        // disable move/resize listeners during initialization
        OutputHelper.Bounds.disableWindowMoveListener()

        // invisible/capture outputs render DPI-corrected so capturePage() matches the configured resolution
        const resolvedBounds = output.invisible ? output.bounds : OutputVisibility.resolveOutputBounds(output)
        const renderBounds = OutputHelper.Bounds.getRenderBounds(output, resolvedBounds)
        const outputWindow = this.createOutputWindow({ ...renderBounds, alwaysOnTop: output.alwaysOnTop !== false, backgroundColor: output.transparent ? "#00000000" : "#000000" }, id, output.name, output)
        // const previewWindow = this.createPreviewWindow({ ...output.bounds, backgroundColor: "#000000" })

        OutputHelper.setOutput(id, { window: outputWindow, name: output.name, osr: this.isOsrOutput(output), invisible: output.invisible, boundsLocked: output.boundsLocked, screen: output.screen, intendedBounds: resolvedBounds, transparent: output.transparent, webrtcData: output.webrtcData, rtmpData: output.rtmpData, htmlData: output.htmlData })
        // OutputHelper.setOutput(id, { window: outputWindow, previewWindow: previewWindow })
        OutputHelper.Bounds.updateBounds({ id: output.id!, bounds: resolvedBounds })
        this.updateWindowConstraints(id)

        // OutputHelper.Bounds.updatePreviewBounds()

        this.pendingCaptureStart[id] = setTimeout(() => {
            delete this.pendingCaptureStart[id]

            if (!CaptureHelper.Lifecycle || !OutputHelper.getOutput(id)) return // window closed before timeout finished
            CaptureHelper.Lifecycle.startCapture(id, { ndi: output.ndi || false, blackmagic: !!output.blackmagic, server: !!output.html, webrtc: !!output.webrtcData?.streaming, rtmp: !!output.rtmpData?.streaming })
        }, 1200)

        // NDI
        if (output.ndi) {
            await NdiSender.createSenderNDI(id, NdiSender.initNameNDI(output.ndiData?.name, output.name), output.ndiData?.groups)
            if (output.ndiData) setDataNDI({ id, ...output.ndiData })
        }

        // Blackmagic
        if (output.blackmagic) initializeSender(output, outputWindow, id)
    }

    // only NDI capture outputs share a render; blackmagic/webrtc/rtmp/html need dedicated capture,
    // and displayed (non-OSR) outputs need their own window
    private static canShareRender(output: Output): boolean {
        return !!output.ndi && !output.blackmagic && !output.webrtcData?.streaming && !output.rtmpData?.streaming && !output.html && this.isOsrOutput(output)
    }

    private static async createFollowerOutput(id: string, output: Output, rendererId: string, rendererWindow: BrowserWindow) {
        OutputHelper.setOutput(id, { window: rendererWindow, follower: true, renderGroupRenderer: rendererId, osr: true, invisible: output.invisible, boundsLocked: output.boundsLocked, screen: output.screen, intendedBounds: output.bounds, transparent: output.transparent })

        this.pendingCaptureStart[id] = setTimeout(() => {
            delete this.pendingCaptureStart[id]
            if (!CaptureHelper.Lifecycle || !OutputHelper.getOutput(id)) return
            CaptureHelper.Lifecycle.startCapture(id, { ndi: output.ndi || false })
        }, 1200)

        if (output.ndi) {
            await NdiSender.createSenderNDI(id, NdiSender.initNameNDI(output.ndiData?.name, output.name), output.ndiData?.groups)
            if (output.ndiData) setDataNDI({ id, ...output.ndiData })
        }
    }

    /*
    private static createPreviewWindow(options) {
        const mainBounds = mainWindow?.getBounds()

        options = { ...outputOptions, ...options }
        options.x = 0
        options.y = 0
        options.width = 320
        options.height = 180
        options.show = true
        if (mainBounds) {
            options.x = mainBounds.x + mainBounds.width - options.width - 20 - 300
            options.y = mainBounds.y + 100
        }

        let window: BrowserWindow | null = new BrowserWindow(options)
        window.setSkipTaskbar(options.skipTaskbar) // hide from taskbar
        if (isMac) window.minimize() // hide on mac
        loadWindowContent(window, true)
        window.showInactive()
        window.moveTop()
        return window
    }*/

    private static createOutputWindow(options: BrowserWindowConstructorOptions, id: string, name: string, extra: any) {
        options = { ...outputOptions, ...options }

        const osr = this.isOsrOutput(extra)
        if (osr) {
            options.show = false
            const useSharedTexture = !!this.getOsrCaptureAddon() && !this.isHardwareAccelerationDisabled()
            const wp: any = { ...outputOptions.webPreferences, offscreen: useSharedTexture ? { useSharedTexture: true } : true }
            options.webPreferences = wp
        }

        if (options.alwaysOnTop === false) {
            options.skipTaskbar = false
            if (!extra.boundsLocked) options.resizable = true
        }

        if (OUTPUT_CONSOLE) options.webPreferences!.devTools = true
        const window: BrowserWindow | null = new BrowserWindow(options)

        if (osr) this.attachOsrCapture(window, id)

        window.setSkipTaskbar(!!options.skipTaskbar)
        if (isMac && !osr) window.minimize()

        window.once("show", () => {
            if (options.alwaysOnTop) setOutputAlwaysOnTop(window, true)
        })

        loadWindowContent(window, "output")
        this.setWindowListeners(window, { id, name })

        if (OUTPUT_CONSOLE) window.webContents.openDevTools({ mode: "detach" })

        return window
    }

    private static isOsrOutput(output: { ndi?: boolean; webrtc?: boolean; rtmp?: boolean; blackmagic?: boolean }): boolean {
        return !!(output.ndi || output.webrtc || output.rtmp || output.blackmagic)
    }

    static readonly OSR_RENDER_FPS = 60

    private static attachOsrCapture(window: BrowserWindow, id: string) {
        try {
            window.webContents.setFrameRate(this.OSR_RENDER_FPS)
        } catch {
            // ignore
        }

        // must match the useSharedTexture condition in createOutputWindow: with HWA off the paints are
        // CPU frames, so attach the CPU handler instead of the shared-texture one
        const addon = this.getOsrCaptureAddon()
        const useSharedTexture = !!addon && !this.isHardwareAccelerationDisabled()
        if (useSharedTexture) this.attachOsrSharedTexture(window, id, addon)
        else this.attachOsrCpu(window, id)

        // Linux begin-frame drive; CaptureHelper.updateRenderRate re-drives it when the rate changes
        if (process.platform === "linux") {
            window.on("closed", () => this.stopOsrPaintDrive(id))
            this.updateOsrPaintDrive(window, id, this.OSR_RENDER_FPS)
        }
    }

    // ---- Linux OSR begin-frame drive ----
    // On Linux, offscreen windows sometimes do not receive compositor vsync/begin-frame events.
    // This timer periodically pokes window.webContents.invalidate() if no natural paint has occurred.
    private static osrPaintDrive = new Map<string, { timer: NodeJS.Timeout; fps: number; interval: number }>()
    private static lastNaturalOsrPaintAt = new Map<string, number>()
    private static lastOsrInvalidateAt = new Map<string, number>()
    private static osrInvalidateInFlight = new Map<string, boolean>()
    private static osrInvalidatesIssued = new Map<string, number>()
    private static readonly DRIVE_TIMEOUT_INTERVALS = 4

    private static noteOsrPaint(id: string) {
        if (process.platform !== "linux") return
        const now = Date.now()
        const drive = this.osrPaintDrive.get(id)
        const invalidatedAt = this.lastOsrInvalidateAt.get(id)
        if (drive && invalidatedAt !== undefined && now - invalidatedAt < drive.interval / 2) {
            this.osrInvalidateInFlight.set(id, false)
            return
        }
        this.lastNaturalOsrPaintAt.set(id, now)
    }

    static readOsrInvalidatesIssued(id: string): number {
        const n = this.osrInvalidatesIssued.get(id) || 0
        if (n) this.osrInvalidatesIssued.set(id, 0)
        return n
    }

    static updateOsrPaintDrive(window: BrowserWindow, id: string, fps: number) {
        if (process.platform !== "linux") return
        const rate = Math.max(1, Math.round(fps))
        const existing = this.osrPaintDrive.get(id)
        if (existing?.fps === rate) return
        if (existing) clearInterval(existing.timer)

        const interval = Math.max(1, Math.round(1000 / rate))
        const timer = setInterval(() => {
            if (window.isDestroyed()) {
                this.stopOsrPaintDrive(id)
                return
            }
            try {
                const wc = window.webContents
                if (!wc.isPainting()) wc.startPainting()
                const lastNatural = this.lastNaturalOsrPaintAt.get(id) || 0
                const now = Date.now()
                if (now - lastNatural < interval * 2) return
                if (this.osrInvalidateInFlight.get(id)) {
                    const invalidatedAt = this.lastOsrInvalidateAt.get(id) || 0
                    if (now - invalidatedAt < interval * this.DRIVE_TIMEOUT_INTERVALS) return
                }
                this.lastOsrInvalidateAt.set(id, now)
                this.osrInvalidateInFlight.set(id, true)
                this.osrInvalidatesIssued.set(id, (this.osrInvalidatesIssued.get(id) || 0) + 1)
                wc.invalidate()
            } catch {
                // window tearing down
            }
        }, interval)
        this.osrPaintDrive.set(id, { timer, fps: rate, interval })
    }

    private static stopOsrPaintDrive(id: string) {
        const drive = this.osrPaintDrive.get(id)
        if (drive) clearInterval(drive.timer)
        this.osrPaintDrive.delete(id)
        this.lastNaturalOsrPaintAt.delete(id)
        this.lastOsrInvalidateAt.delete(id)
        this.osrInvalidateInFlight.delete(id)
        this.osrInvalidatesIssued.delete(id)
    }

    static isHardwareAccelerationDisabled(): boolean {
        return hardwareAccelerationDisabled
    }

    // lazily load the native shared-texture readback addon; null -> CPU offscreen capture fallback
    private static osrCaptureAddon: any = undefined
    private static getOsrCaptureAddon(): any {
        if (this.osrCaptureAddon !== undefined) return this.osrCaptureAddon
        try {
            this.osrCaptureAddon = require("osr-capture")
        } catch {
            console.info("OSR shared-texture addon unavailable, using CPU offscreen capture")
            this.osrCaptureAddon = null
        }
        return this.osrCaptureAddon
    }

    // readbacks in flight per output. Kept at 1: the GPU->CPU readback is bandwidth-bound, so
    // per-output overlap multiplies concurrent copies across outputs and lowers total throughput
    private static readonly OSR_MAX_INFLIGHT_READBACKS = 1

    // Computes per-renderer pipeline depth: ceil(targetFps * minRtt) + 1.
    // Limits how many frames are allowed in-flight to prevent queue bloating while keeping throughput high.
    private static readonly RTT_WINDOW_SAMPLES = 300
    private static readonly ADDON_MAX_POOL = 16 // Max concurrent readback contexts in native addon
    private static globalInFlight = 0
    private static lastClampLogged = 0
    private static lastGateLogged = 0
    private static offMain = new Map<string, OffMainState>()

    private static rendererTargetFps(id: string): number {
        let fps = 0
        for (const m of RenderGroups.members(id)) {
            const mo = OutputHelper.getOutput(m)
            if (mo?.captureOptions) fps = Math.max(fps, CaptureHelper.getMaxActiveFramerate(mo.captureOptions.framerates || {}, mo.captureOptions.options || {}))
        }
        return fps
    }

    private static capFor(id: string): number {
        let others = 0
        for (const [oid, ost] of this.offMain) if (oid !== id) others += ost.depth
        return Math.max(1, this.ADDON_MAX_POOL - others)
    }

    private static depthFor(id: string): number {
        const st = this.offMain.get(id)
        if (!st) return 1
        return Math.max(1, Math.min(this.capFor(id), st.depth))
    }

    private static totalDepth(): number {
        let sum = 0
        for (const st of this.offMain.values()) sum += st.depth
        return sum
    }

    private static uncontendedMins(st: { samples: { rtt: number; unc: boolean; seg?: OffMainSegments }[] }): { minRtt: number; seg: OffMainSegments | null; pipeRtt: number } {
        let minRtt = Infinity
        let consume = Infinity,
            finish = Infinity,
            enqueue = Infinity,
            doneMain = Infinity
        for (const s of st.samples) {
            if (!s.unc) continue
            if (s.rtt < minRtt) minRtt = s.rtt
            if (s.seg) {
                if (s.seg.consume < consume) consume = s.seg.consume
                if (s.seg.finish < finish) finish = s.seg.finish
                if (s.seg.enqueue < enqueue) enqueue = s.seg.enqueue
                if (s.seg.doneMain < doneMain) doneMain = s.seg.doneMain
            }
        }
        if (minRtt === Infinity) return { minRtt: 0, seg: null, pipeRtt: 0 }
        const hasSeg = consume !== Infinity
        const seg = hasSeg ? { consume: Math.round(consume), finish: Math.round(finish), enqueue: Math.round(enqueue), doneMain: Math.round(doneMain) } : null
        const pipeRtt = Math.round(hasSeg ? Math.max(consume + finish + enqueue + doneMain, minRtt) : minRtt)
        return { minRtt: Math.round(minRtt), seg, pipeRtt }
    }

    private static pipeRttFor(id: string): { minRtt: number; seg: OffMainSegments | null; pipeRtt: number } {
        const st = this.offMain.get(id)
        if (!st) return { minRtt: 0, seg: null, pipeRtt: 0 }
        return this.uncontendedMins(st)
    }

    private static noteFrameSize(id: string, px: number) {
        const st = this.offMain.get(id)
        if (!st || st.px === px) return
        st.px = px
        st.samples.length = 0
        st.pendingDepth = 0
        st.depthStreak = 0
    }

    private static recordRtt(id: string, rtt: number, uncontended: boolean, px: number, seg?: OffMainSegments) {
        const st = this.offMain.get(id)
        if (!st || st.px !== px) return
        st.samples.push({ rtt, unc: uncontended, seg })
        if (st.samples.length > this.RTT_WINDOW_SAMPLES) st.samples.shift()
        this.deriveDepthFor(id, st)
    }

    private static deriveDepthFor(id: string, st: OffMainState) {
        const { minRtt } = this.uncontendedMins(st)
        if (!minRtt) return
        let derived = Math.max(1, Math.ceil((this.rendererTargetFps(id) * minRtt) / 1000) + 1)
        const cap = this.capFor(id)
        if (derived > cap) {
            if (this.lastClampLogged !== derived) {
                console.info(`[DEPTH] structural clamp hit: derived=${derived} for ${id} but only ${cap} of addon kMaxPool=${this.ADDON_MAX_POOL} contexts are unclaimed`)
                this.lastClampLogged = derived
            }
            derived = cap
        }
        // Apply with 2-evaluation hysteresis
        if (derived === st.depth) {
            st.pendingDepth = 0
            st.depthStreak = 0
            return
        }
        if (derived === st.pendingDepth) {
            if (++st.depthStreak >= 2) {
                st.pendingDepth = 0
                st.depthStreak = 0
                st.depth = derived
            }
        } else {
            st.pendingDepth = derived
            st.depthStreak = 1
        }
    }

    private static offMainRendererCount = 0
    private static osrTextureCleanup: { [id: string]: () => void } = {}

    static releaseOsrCaptureTextures(id: string) {
        this.osrTextureCleanup[id]?.()
    }

    private static attachOsrSharedTexture(window: BrowserWindow, id: string, addon: any) {
        this.offMainRendererCount++
        this.offMain.set(id, { samples: [], px: 0, depth: 1, pendingDepth: 0, depthStreak: 0 })

        let lastRaw: { buffer: Buffer; size: { width: number; height: number }; format: number } | null = null
        let inFlight = 0
        let lastReadback = 0
        // monotonic paint counter: readbacks can resolve out of order, so only the newest result wins
        let dispatchSeq = 0
        let appliedSeq = -1

        // off-main state: up to the derived depth textures forwarded to the worker at once, tracked by
        // monotonic seq so the next frame's GPU consume overlaps the previous frame's readback
        let offMainInFlight = 0
        let offMainSeq = 0
        const heldTextures = new Map<number, any>()
        // a swallowed release failure permanently shrinks the compositor frame pool, so log it (once)
        let releaseWarned = false
        const releaseTex = (t: any) => {
            if (!t) return
            try {
                t.release()
            } catch (err) {
                if (!releaseWarned) {
                    releaseWarned = true
                    console.error(`[OSR ${id}] shared-texture release failed (frame-pool leak):`, err)
                }
            }
        }
        const releaseHeldSeq = (seq: number) => {
            const t = heldTextures.get(seq)
            if (t) {
                releaseTex(t)
                heldTextures.delete(seq)
            }
        }

        // optional capture stats (FS_CAP_STATS=1), printed once/sec: paints/forwards/completions,
        // drop + coalesce counters, delivery-gap spread, and per-frame hop timings from the worker
        const STATS = !!process.env.FS_CAP_STATS
        let sPaints = 0,
            sDropBudget = 0,
            sDropInterval = 0,
            sForward = 0,
            sDone = 0,
            sReadback = 0,
            sRttSum = 0,
            sRttCount = 0
        // pending frames released by the full-pipe park watchdog (expected under saturation)
        let sParkExpired = 0
        // paints arriving within 5ms of the previous one (the compositor delivering in clumps)
        let sBurstPaints = 0,
            lastPaintTime = 0
        // inter-arrival gaps between completed frames; the spread (not the mean) is what reads as jitter
        const sGaps: number[] = []
        let lastDoneTime = 0
        const sTl: { [seg: string]: number[] } = { fwdRecv: [], recvCons: [], consume: [], phaseGap: [], finish: [], enqueue: [], doneMain: [] }
        let sIdleMs = 0
        let idleSince = STATS ? Date.now() : 0
        // ALWAYS-ON (not stats-gated): the samples feeding the depth estimator, and the authoritative
        // in-flight ledger — a seq is counted in globalInFlight iff it is in this map, so completion/teardown can never
        // double-decrement.
        const forwardAt = new Map<number, { t: number; unc: boolean; px: number }>()
        let statsTimer: any = null
        if (STATS) {
            statsTimer = setInterval(() => {
                const m = RenderGroups.members(id)
                const rtt = sRttCount ? Math.round(sRttSum / sRttCount) : 0
                const sendCap = Math.round(1000 / this.getOsrSendInterval(id))
                // admit = group admission target (max configured rate across members); ndiFramerate = the
                // renderer's own resolved rate
                const admitFps = Math.round(1000 / this.getOsrTargetInterval(id))
                const ndiFps = OutputHelper.getOutput(id)?.captureOptions?.framerates?.ndi ?? "?"
                // delivery-evenness stats from the inter-done gaps collected this window
                let gapMean = 0,
                    gapStd = 0,
                    gapP95 = 0,
                    gapBig = 0
                if (sGaps.length) {
                    gapMean = sGaps.reduce((a, b) => a + b, 0) / sGaps.length
                    gapStd = Math.sqrt(sGaps.reduce((a, b) => a + (b - gapMean) * (b - gapMean), 0) / sGaps.length)
                    const sorted = [...sGaps].sort((a, b) => a - b)
                    gapP95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
                    gapBig = sGaps.filter((g) => g > 25).length
                }
                // per-hop timing means (sum ≈ mean rtt); p95 on consume/finish separates a serial stage
                // from queueing
                let tlStr = ""
                const nTl = sTl.consume.length
                if (nTl) {
                    const mean = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) / a.length)
                    const p95 = (a: number[]) => {
                        const s = [...a].sort((x, y) => x - y)
                        return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]
                    }
                    tlStr = ` tl(n=${nTl} fwdRecv=${mean(sTl.fwdRecv)} recvCons=${mean(sTl.recvCons)} consume=${mean(sTl.consume)}/p95=${p95(sTl.consume)} phaseGap=${mean(sTl.phaseGap)} finish=${mean(sTl.finish)}/p95=${p95(sTl.finish)} enqueue=${mean(sTl.enqueue)} doneMain=${mean(sTl.doneMain)})`
                }
                // pipeIdle: ms this window with zero frames in flight (busy pipe vs admission starvation)
                let idleMs = sIdleMs
                if (idleSince) {
                    const nowT = Date.now()
                    idleMs += nowT - idleSince
                    idleSince = nowT
                }
                const pr = this.pipeRttFor(id)
                const segStr = pr.seg ? `segMins(cons=${pr.seg.consume} fin=${pr.seg.finish} enq=${pr.seg.enqueue} dMain=${pr.seg.doneMain})` : "segMins(none)"
                // begin-frame drive telemetry: invalidates issued vs paints received (invalidates=0 when
                // natural paints flow and the drive is silent)
                const sInvalidates = process.platform === "linux" ? OutputLifecycle.readOsrInvalidatesIssued(id) : 0
                console.info(
                    `[CAP-STATS ${id}] members=[${m.join(",")}] paints=${sPaints} invalidates=${sInvalidates} burst=${sBurstPaints} fwd=${sForward} done=${sDone} readback=${sReadback} dropBudget=${sDropBudget} dropInterval=${sDropInterval} parkExp=${sParkExpired} inflight=${offMainInFlight}/${this.depthFor(id)} globalInflight=${this.globalInFlight} depth=${this.depthFor(id)} depthTotal=${this.totalDepth()} minRtt=${pr.minRtt}ms pipeRtt=${pr.pipeRtt}ms ${segStr} renderers=${this.offMainRendererCount} rtt=${rtt}ms gap(mean=${Math.round(gapMean)} std=${Math.round(gapStd)} p95=${gapP95} >25ms=${gapBig}) pipeIdle=${Math.round(idleMs)}ms${tlStr} admit=${admitFps}fps sendCap=${sendCap}fps ndiFramerate=${ndiFps}`
                )
                sPaints = sDropBudget = sDropInterval = sParkExpired = sForward = sDone = sReadback = sRttSum = sRttCount = sBurstPaints = 0
                sGaps.length = 0
                sIdleMs = 0
                for (const seg of Object.values(sTl)) seg.length = 0
            }, 1000)
        }

        // Coalesces rapid paints into a single pending frame and admits it at the target framerate
        // interval when the pipeline has capacity.
        let pendingFrame: { tex: any; source: any; width: number; height: number } | null = null
        let admitNextDue = 0
        let admitTimer: NodeJS.Timeout | null = null

        const forwardOffMain = (rec: { tex: any; source: any; width: number; height: number }) => {
            const { tex, source, width, height } = rec
            const output = OutputHelper.getOutput(id)
            const framerate = output?.captureOptions?.framerates?.ndi || 30
            const ratio = height ? width / height : 16 / 9
            const transparent = output?.transparent === true
            const fmt = transparent ? 2 : 1
            const members = NdiSender.NDI[id]?.sender ? RenderGroups.members(id).filter((m) => m === id || (OutputHelper.getOutput(m) as any)?.renderGroupRenderer === id) : []
            const memberFramerates: { [m: string]: number } = {}
            for (const m of members) memberFramerates[m] = OutputHelper.getOutput(m)?.captureOptions?.framerates?.ndi || framerate
            const groupInfo = members.length ? CaptureHelper.Transmitter.groupOffMainInfo(members) : null
            const mixed = !!groupInfo && groupInfo.eligible && groupInfo.needsScaled && typeof addon.readbackConsume === "function"
            const scaled = mixed ? CaptureHelper.Transmitter.getScaledTarget({ width, height }) : null
            const seq = ++offMainSeq
            if (NdiSender.captureFrameNDI(id, source, { size: { width, height }, ratio, framerate, memberFramerates, format: fmt, transparent, dstW: scaled?.dstW || 0, dstH: scaled?.dstH || 0, seq, members, depth: OutputLifecycle.depthFor(id) })) {
                forwardAt.set(seq, { t: Date.now(), unc: OutputLifecycle.globalInFlight === 0, px: width * height })
                OutputLifecycle.globalInFlight++
                offMainInFlight++
                heldTextures.set(seq, tex)
                if (STATS) {
                    sForward++
                    if (idleSince) {
                        sIdleMs += Date.now() - idleSince
                        idleSince = 0
                    }
                }
            } else {
                releaseTex(tex)
            }
        }

        const tryAdmit = () => {
            if (!pendingFrame) return
            const now = Date.now()
            if (now < admitNextDue) {
                if (!admitTimer) {
                    admitTimer = setTimeout(() => {
                        admitTimer = null
                        tryAdmit()
                    }, admitNextDue - now)
                }
                return
            }
            const overBudget = offMainInFlight >= OutputLifecycle.depthFor(id)
            const overPool = OutputLifecycle.globalInFlight >= OutputLifecycle.ADDON_MAX_POOL
            if (overPool && !overBudget) {
                const nowG = Date.now()
                if (nowG - OutputLifecycle.lastGateLogged > 1000) {
                    console.info(`[DEPTH] structural gate hit: globalInFlight=${OutputLifecycle.globalInFlight} >= addon kMaxPool=${OutputLifecycle.ADDON_MAX_POOL}`)
                    OutputLifecycle.lastGateLogged = nowG
                }
            }
            if (overBudget || overPool) {
                const parked = pendingFrame
                if (!admitTimer) {
                    admitTimer = setTimeout(() => {
                        admitTimer = null
                        if (!pendingFrame) return
                        const stillFull = offMainInFlight >= OutputLifecycle.depthFor(id) || OutputLifecycle.globalInFlight >= OutputLifecycle.ADDON_MAX_POOL
                        if (pendingFrame === parked && stillFull) {
                            if (STATS) sParkExpired++
                            releaseTex(pendingFrame.tex)
                            pendingFrame = null
                            return
                        }
                        tryAdmit()
                    }, OutputLifecycle.getOsrTargetInterval(id))
                }
                return
            }
            const rec = pendingFrame
            pendingFrame = null
            if (admitTimer) {
                clearTimeout(admitTimer)
                admitTimer = null
            }
            const interval = OutputLifecycle.getOsrTargetInterval(id)
            admitNextDue += interval
            if (admitNextDue < now) admitNextDue = now + interval
            forwardOffMain(rec)
        }

        // the worker signals releaseTexture as soon as the GPU has consumed the shared texture (well before
        // the slow read finishes), so Electron's frame pool isn't starved -> keeps the main process responsive
        NdiSender.releaseTextureCallbacks[id] = releaseHeldSeq
        // captureDone = the whole capture (incl. the slow read) is finished -> a pipeline slot frees up.
        // The forwardAt ledger dedupes: in-flight counters only move for a seq this map still tracks.
        NdiSender.captureDoneCallbacks[id] = (seq: number, tl?: { recv: number; cS: number; cE: number; fS: number; fE: number; enq: number } | null) => {
            releaseHeldSeq(seq)
            const now = Date.now()
            const fwd = forwardAt.get(seq)
            if (fwd) {
                forwardAt.delete(seq)
                offMainInFlight = Math.max(0, offMainInFlight - 1)
                OutputLifecycle.globalInFlight = Math.max(0, OutputLifecycle.globalInFlight - 1)
                // feed the depth estimator (always-on, not stats-gated); segments clamped ≥0 so a skewed
                // frame can't inject a negative service time into the min estimator
                const seg = tl && tl.enq ? { consume: Math.max(0, tl.cE - tl.cS), finish: Math.max(0, tl.fE - tl.fS), enqueue: Math.max(0, tl.enq - tl.fE), doneMain: Math.max(0, now - tl.enq) } : undefined
                OutputLifecycle.recordRtt(id, now - fwd.t, fwd.unc, fwd.px, seg)
                if (STATS) {
                    sRttSum += now - fwd.t
                    sRttCount++
                    if (offMainInFlight === 0 && !idleSince) idleSince = now // pipe drained -> idle starts
                    if (tl && tl.enq && seg) {
                        // clean-path frame: split its whole rtt into the seven hops (sum ≈ rtt by construction)
                        sTl.fwdRecv.push(tl.recv - fwd.t)
                        sTl.recvCons.push(tl.cS - tl.recv)
                        sTl.consume.push(seg.consume)
                        sTl.phaseGap.push(tl.fS - tl.cE)
                        sTl.finish.push(seg.finish)
                        sTl.enqueue.push(seg.enqueue)
                        sTl.doneMain.push(seg.doneMain)
                    }
                }
                // a pipe slot just freed: flush a pending frame that was HELD at its due boundary by a full
                // pipe (work-conserving even admission — see tryAdmit)
                tryAdmit()
            }
            if (STATS) {
                sDone++
                if (lastDoneTime) sGaps.push(now - lastDoneTime)
                lastDoneTime = now
            }
        }

        let cpuFallback = false
        let lastCpuImage: Electron.NativeImage | null = null

        window.webContents.on("paint", (event: any, _dirty: unknown, image: Electron.NativeImage) => {
            OutputLifecycle.noteOsrPaint(id)
            const tex = event?.texture
            const info = tex?.textureInfo
            if (!info) {
                if (image && !image.isEmpty()) {
                    if (!cpuFallback) {
                        cpuFallback = true
                        console.warn(`[OSR ${id}] paint carries no GPU shared texture — falling back to CPU capture`)
                    }
                    lastCpuImage = image
                }
                return
            }
            if (STATS) {
                sPaints++
                const nowP = Date.now()
                if (lastPaintTime && nowP - lastPaintTime < 5) sBurstPaints++
                lastPaintTime = nowP
            }

            const width = info.codedSize.width
            const height = info.codedSize.height
            const source = process.platform === "linux" ? { planes: info.planes, modifier: info.modifier } : info.sharedTextureHandle
            const requestedFormat = CaptureHelper.Transmitter.getReadbackFormat(id, { width, height })

            const members = NdiSender.NDI[id]?.sender ? RenderGroups.members(id).filter((m) => m === id || (OutputHelper.getOutput(m) as any)?.renderGroupRenderer === id) : []
            const groupInfo = members.length ? CaptureHelper.Transmitter.groupOffMainInfo(members) : null
            const hasGpuDownscale = typeof addon.readbackConsume === "function"
            const canOffMain = !!groupInfo && groupInfo.eligible && (!groupInfo.needsScaled || hasGpuDownscale)
            if (canOffMain) {
                OutputLifecycle.noteFrameSize(id, width * height)
                if (pendingFrame) {
                    if (STATS) sDropInterval++
                    releaseTex(pendingFrame.tex)
                }
                pendingFrame = { tex, source, width, height }
                tryAdmit()
                return
            }

            if (inFlight >= this.OSR_MAX_INFLIGHT_READBACKS || Date.now() - lastReadback < this.getOsrSendInterval(id)) {
                releaseTex(tex)
                return
            }
            inFlight++
            lastReadback = Date.now()
            if (STATS) sReadback++
            const seq = ++dispatchSeq
            addon
                .readback(source, width, height, requestedFormat, id)
                .then((buf: Buffer) => {
                    if (seq < appliedSeq) return
                    appliedSeq = seq
                    lastRaw = { buffer: buf, size: { width, height }, format: requestedFormat }
                })
                .catch((err: any) => console.error("OSR shared-texture readback error:", err))
                .finally(() => {
                    releaseTex(tex)
                    inFlight--
                })
        })

        this.startOsrSendTimer(window, id, () => {
            if (lastRaw) CaptureHelper.Transmitter.transmitFrame(id, null, undefined, lastRaw)
            else if (lastCpuImage) CaptureHelper.Transmitter.transmitFrame(id, lastCpuImage)
        })

        let toreDown = false
        const teardown = () => {
            if (toreDown) return
            toreDown = true
            if (statsTimer) {
                clearInterval(statsTimer)
                statsTimer = null
            }
            if (admitTimer) {
                clearTimeout(admitTimer)
                admitTimer = null
            }
            if (pendingFrame) {
                releaseTex(pendingFrame.tex)
                pendingFrame = null
            }
            OutputLifecycle.globalInFlight = Math.max(0, OutputLifecycle.globalInFlight - forwardAt.size)
            forwardAt.clear()
            offMainInFlight = 0
            this.offMain.delete(id)
            this.offMainRendererCount = Math.max(0, this.offMainRendererCount - 1)
            delete NdiSender.captureDoneCallbacks[id]
            delete NdiSender.releaseTextureCallbacks[id]
            heldTextures.forEach((t) => releaseTex(t))
            heldTextures.clear()
            if (OutputLifecycle.osrTextureCleanup[id] === teardown) delete OutputLifecycle.osrTextureCleanup[id]
        }
        OutputLifecycle.osrTextureCleanup[id] = teardown
        window.on("closed", teardown)
    }

    // CPU fallback path: the paint event delivers a NativeImage directly.
    private static attachOsrCpu(window: BrowserWindow, id: string) {
        let lastImage: Electron.NativeImage | null = null
        window.webContents.on("paint", (_e: unknown, _dirty: unknown, image: Electron.NativeImage) => {
            OutputLifecycle.noteOsrPaint(id) // linux begin-frame drive yields to natural paints
            lastImage = image
        })
        this.startOsrSendTimer(window, id, () => {
            if (lastImage) CaptureHelper.Transmitter.transmitFrame(id, lastImage)
        })
    }

    // emit the latest frame at the output's configured framerate, decoupling the send rate from the
    // content-change rate (static content still holds a constant rate on the wire)
    private static startOsrSendTimer(window: BrowserWindow, id: string, emit: () => void) {
        let sendTimer: NodeJS.Timeout
        const tick = () => {
            // transmitFrame no-ops until the output's capture channels are set up, and throttles each consumer
            if (!window.isDestroyed()) emit()
            // re-read the interval each tick so framerate changes (e.g. NDI connect) take effect
            const interval = this.getOsrSendInterval(id)
            sendTimer = setTimeout(tick, interval)
        }
        sendTimer = setTimeout(tick, this.getOsrSendInterval(id))
        window.on("closed", () => clearTimeout(sendTimer))
    }

    private static getOsrSendInterval(id: string): number {
        const captureOptions = OutputHelper.getOutput(id)?.captureOptions
        // no capture configured yet: tick fast; transmitFrame no-ops until channels exist
        if (!captureOptions) return 1000 / 60
        const fps = CaptureHelper.getMaxActiveFramerate(captureOptions.framerates || {}, captureOptions.options || {})
        return Math.max(1, Math.round(1000 / Math.max(1, fps)))
    }

    // admission target interval: 1000 / max configured consumer framerate across the shared-render
    // group. Re-read every admission so framerate changes apply live.
    private static getOsrTargetInterval(id: string): number {
        return 1000 / Math.max(1, this.rendererTargetFps(id) || this.OSR_RENDER_FPS)
    }

    static async removeOutput(id: string, reopen: Output | null = null) {
        this.clearPendingCaptureStart(id)

        // Shared-render bookkeeping: drop this output from its group. If it was the RENDERER and followers
        // remain, the first follower must be promoted to render (given its own window) so the group keeps going.
        const wasShared = RenderGroups.enabled && (!!(OutputHelper.getOutput(id) as any)?.follower || RenderGroups.isRenderer(id))
        const groupInfo = wasShared ? RenderGroups.remove(id) : null

        // A FOLLOWER owns no window — just tear down its senders/capture, never touch the shared window.
        if ((OutputHelper.getOutput(id) as any)?.follower) {
            CaptureHelper.Lifecycle.stopCapture(id)
            NdiSender.stopSenderNDI(id)
            OutputHelper.deleteOutput(id)
            if (reopen) OutputLifecycle.createOutput(reopen)
            return
        }

        CaptureHelper.Lifecycle.stopCapture(id)
        NdiSender.stopSenderNDI(id)
        BlackmagicSender.stop(id)
        // free the addon's reused readback buffers for this output (no-op if the addon/pool isn't present)
        try {
            this.osrCaptureAddon?.releasePool?.(id)
        } catch {
            // ignore
        }

        // renderer removed with followers present -> rebuild survivors (first one becomes the new
        // renderer). A recreated renderer's reopen joins the same ordered batch — racing the rebuild
        // let followers attach to a mid-teardown window and split the group.
        if (groupInfo?.wasRenderer && groupInfo.members.length) {
            this.rebuildGroupMembers(groupInfo.members, reopen)
            reopen = null
        }

        const output = OutputHelper.getOutput(id)
        if (!output) return

        if (output.window.isDestroyed()) {
            OutputHelper.deleteOutput(id)
            if (reopen) OutputLifecycle.createOutput(reopen)
            return
        }

        output.window.once("closed", () => {
            OutputHelper.deleteOutput(id)
            if (reopen) OutputLifecycle.createOutput(reopen)
        })

        try {
            // this has to be called to actually remove the process!
            output.window.removeAllListeners("close")
            output.window.close()
            await wait(80)
        } catch (err) {
            console.error(err)
        }
    }

    // The renderer of a shared group was removed. Tear down the surviving followers (they reference the dying
    // window) and recreate them from their stored configs: RenderGroups already promoted the first survivor to
    // members[0], so createOutput gives it a fresh window (renderer) and the rest re-follow it. Recreation is
    // deferred so the old window finishes closing first.
    private static rebuildGroupMembers(members: string[], reopenRenderer: Output | null = null) {
        // don't resurrect a group mid-teardown (closing all outputs removes the renderer too)
        if (this.closingAllOutputs) return
        const configs = members.map((m) => RenderGroups.getConfig(m)).filter((c): c is Output => !!c)
        if (reopenRenderer) configs.unshift(reopenRenderer)
        for (const m of members) {
            this.clearPendingCaptureStart(m)
            CaptureHelper.Lifecycle.stopCapture(m)
            NdiSender.stopSenderNDI(m)
            OutputHelper.deleteOutput(m)
        }
        // sequential: each member awaits the previous, so followers attach to a live renderer window
        setTimeout(async () => {
            for (const config of configs) await this.createOutput(config)
        }, 150)
    }

    static focusOutput(id: string) {
        OutputHelper.getOutput(id)?.window?.focus()
    }

    static setWindowListeners(window: BrowserWindow, { id, name }: { [key: string]: string }) {
        window.on("ready-to-show", () => {
            // focus back on main window if output window is not on top
            const mainWindow = getMainWindow()
            if (mainWindow) {
                const windowNotCoveringMain = OutputVisibility.amountCovered(window.getBounds(), mainWindow.getBounds()) < 0.5
                if (windowNotCoveringMain || isMac) mainWindow.focus()
            }

            window.setMenu(null)
            window.setTitle(name || "Output")
        })

        // Building the app does not like this for some reason:
        // Argument of type '"move"' is not assignable to parameter of type '"will-resize"'.
        // @ts-ignore
        window.on("move", (e: Electron.Event) => {
            if (!OutputHelper.Bounds.moveEnabled || OutputHelper.Bounds.updatingBounds || OutputHelper.getOutput(id).boundsLocked) return e.preventDefault()

            const bounds = window.getBounds()
            toApp(OUTPUT, { channel: "MOVE", data: { id, bounds } })
        })

        // @ts-ignore
        window.on("resize", (e: Electron.Event) => {
            if (OutputHelper.Bounds.moveEnabled || OutputHelper.Bounds.updatingBounds || OutputHelper.getOutput(id).boundsLocked) return e.preventDefault()

            const bounds = window.getBounds()
            toApp(OUTPUT, { channel: "MOVE", data: { id, bounds } })
        })
    }

    static updateWindowConstraints(id: string) {
        const output = OutputHelper.getOutput(id)
        if (!output || !output.window || output.window.isDestroyed()) return

        const locked = output.boundsLocked === true || output.invisible === true
        const movable = OutputHelper.Bounds.moveEnabled && !locked

        output.window.setResizable(movable)
        output.window.setMovable(movable)

        if (locked) {
            const bounds = output.window.getBounds()
            output.window.setMinimumSize(bounds.width, bounds.height)
            output.window.setMaximumSize(bounds.width, bounds.height)
        } else {
            output.window.setMinimumSize(0, 0)
            output.window.setMaximumSize(99999, 99999)
        }
    }

    private static closingAllOutputs = false
    static async closeAllOutputs() {
        this.closingAllOutputs = true
        try {
            await Promise.all(OutputHelper.getKeys().map(async (id) => await this.removeOutput(id)))
        } finally {
            this.closingAllOutputs = false
        }
    }
}
