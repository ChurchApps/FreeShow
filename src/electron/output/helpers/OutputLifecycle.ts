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

// the four SERIAL SERVICE segments of one off-main frame's round-trip (ms), split from the worker's tl
// timestamps: consume = libuv queue + GPU convert + wait, finish = libuv queue + copy-out, enqueue = pacer
// memcpy + fan-out on the worker JS thread, doneMain = worker→main captureDone message. The ≈0 hops
// (fwdRecv/recvCons/phaseGap) are excluded — measured ≈0, they carry no service time (§10 collapse block).
type OffMainSegments = { consume: number; finish: number; enqueue: number; doneMain: number }

type OffMainState = {
    samples: { rtt: number; unc: boolean; seg?: OffMainSegments }[]
    px: number
    depth: number // Little's-law derivation: ceil(targetFps × minRtt) + 1 (2-eval integer hysteresis)
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

            const currentBounds = output.window.getBounds()
            if (JSON.stringify(currentBounds) !== JSON.stringify(output.intendedBounds)) {
                OutputHelper.Bounds.updateBounds({ id, bounds: output.intendedBounds })
            }
        })
    }

    static async createOutput(output: Output) {
        const id: string = output.id || ""
        if (!id) return

        if (OutputHelper.getOutput(id)) {
            CaptureHelper.Lifecycle.stopCapture(id)
            this.removeOutput(id, output)
            return
        }

        this.clearPendingCaptureStart(id)

        // Shared-render (FS_SHARE_RENDER): if this output renders pixel-identical to an already-created output
        // in its group, don't create a second window (which would decode+composite the same content again).
        // It becomes a FOLLOWER — no window — and is fed by the group's renderer capture. Only share-eligible
        // (NDI, no blackmagic/webrtc/rtmp) capture outputs participate; everything else renders independently.
        const shareEligible = RenderGroups.enabled && this.canShareRender(output)
        const group = shareEligible ? RenderGroups.add(id, output) : { isRenderer: true, rendererId: id }
        if (!group.isRenderer) {
            const rendererWin = OutputHelper.getOutput(group.rendererId)?.window
            if (rendererWin && !rendererWin.isDestroyed()) {
                await this.createFollowerOutput(id, output, group.rendererId, rendererWin)
                return
            }
            // renderer window missing (removed/not ready): fall through and render independently this time
        }

        // disable move/resize listeners during initialization
        OutputHelper.Bounds.disableWindowMoveListener()

        // invisible/capture outputs render DPI-corrected so capturePage() matches the configured resolution
        const renderBounds = OutputHelper.Bounds.getRenderBounds(output, output.bounds)
        const outputWindow = this.createOutputWindow({ ...renderBounds, alwaysOnTop: output.alwaysOnTop !== false, backgroundColor: output.transparent ? "#00000000" : "#000000" }, id, output.name, output)
        // const previewWindow = this.createPreviewWindow({ ...output.bounds, backgroundColor: "#000000" })

        OutputHelper.setOutput(id, { window: outputWindow, osr: this.isOsrOutput(output), invisible: output.invisible, boundsLocked: output.boundsLocked, screen: output.screen, intendedBounds: output.bounds, transparent: output.transparent, webrtcData: output.webrtcData, rtmpData: output.rtmpData })
        // OutputHelper.setOutput(id, { window: outputWindow, previewWindow: previewWindow })
        OutputHelper.Bounds.updateBounds({ id: output.id!, bounds: output.bounds })
        this.updateWindowConstraints(id)

        // OutputHelper.Bounds.updatePreviewBounds()

        this.pendingCaptureStart[id] = setTimeout(() => {
            delete this.pendingCaptureStart[id]

            if (!CaptureHelper.Lifecycle || !OutputHelper.getOutput(id)) return // window closed before timeout finished
            CaptureHelper.Lifecycle.startCapture(id, { ndi: output.ndi || false, blackmagic: !!output.blackmagic, webrtc: !!output.webrtcData?.streaming, rtmp: !!output.rtmpData?.streaming })
        }, 1200)

        // NDI
        if (output.ndi) {
            await NdiSender.createSenderNDI(id, NdiSender.initNameNDI(output.ndiData?.name, output.name), output.ndiData?.groups)
            if (output.ndiData) setDataNDI({ id, ...output.ndiData })
        }

        // Blackmagic
        if (output.blackmagic) initializeSender(output, outputWindow, id)
    }

    // Only NDI capture outputs (optionally also feeding server/stage) share a render. blackmagic/webrtc/rtmp
    // need dedicated per-output capture, and displayed (non-OSR) outputs need their own window, so none follow.
    private static canShareRender(output: Output): boolean {
        return !!output.ndi && !output.blackmagic && !output.webrtcData?.streaming && !output.rtmpData?.streaming && this.isOsrOutput(output)
    }

    // A follower shares the group renderer's window + single capture (no second 4K decode). It registers its
    // OWN NDI sender and capture channels so the renderer's fan-out (one readback -> every member's sender)
    // reaches it, and the frontend's CAPTURE toggles drive its server/stage channels exactly like a normal
    // output because it references a live window. It NEVER owns/creates/closes that window.
    private static async createFollowerOutput(id: string, output: Output, rendererId: string, rendererWindow: BrowserWindow) {
        OutputHelper.setOutput(id, { window: rendererWindow, follower: true, renderGroupRenderer: rendererId, osr: true, invisible: output.invisible, boundsLocked: output.boundsLocked, screen: output.screen, intendedBounds: output.bounds, transparent: output.transparent })

        this.pendingCaptureStart[id] = setTimeout(() => {
            delete this.pendingCaptureStart[id]
            if (!CaptureHelper.Lifecycle || !OutputHelper.getOutput(id)) return
            // followers capture only ndi (+ server/stage via frontend toggles); the renderer feeds them, and
            // output.osr=true skips the capturePage poll so the shared window is never double-captured.
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

        // render-overhaul: network/device outputs render offscreen (OSR) and are captured via paint
        // events instead of the main-thread capturePage poll.
        const osr = this.isOsrOutput(extra)
        if (osr) {
            options.show = false
            // #16: use GPU shared-texture mode when the native readback addon is available (keeps the GPU->CPU
            // readback off the main thread); otherwise fall back to CPU offscreen (macOS/Linux/unbuilt).
            // MUST honor the "disable hardware acceleration" config: with HWA off, Chromium's compositor
            // produces CPU frames (no GPU shared texture to read), so the entire GPU path — shared-texture
            // capture AND the addon's GPU convert/downscale — is bypassed in favour of CPU offscreen.
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

        // only win & linux
        // window.removeMenu() // hide menubar
        // window.setAutoHideMenuBar(true) // hide menubar

        window.setSkipTaskbar(!!options.skipTaskbar) // hide from taskbar
        if (isMac) window.minimize() // hide on mac

        window.once("show", () => {
            if (options.alwaysOnTop) setOutputAlwaysOnTop(window, true)
        })
        // window.setVisibleOnAllWorkspaces(true)

        loadWindowContent(window, "output")
        this.setWindowListeners(window, { id, name })

        // open devtools
        if (OUTPUT_CONSOLE) window.webContents.openDevTools({ mode: "detach" })

        return window
    }

    // render-overhaul: network/device outputs (NDI/WebRTC/RTMP/Blackmagic) are capture-only — never shown
    // on a monitor — so render them offscreen (OSR) and capture via paint events instead of the
    // main-thread capturePage poll. These are persistent config flags (set when the output type is
    // configured), stable across the streaming on/off toggle, so the window's OSR mode never has to change.
    private static isOsrOutput(output: { ndi?: boolean; webrtc?: boolean; rtmp?: boolean; blackmagic?: boolean }): boolean {
        return !!(output.ndi || output.webrtc || output.rtmp || output.blackmagic)
    }

    // render-overhaul: OSR outputs render offscreen; `paint` provides the latest rendered frame (GPU
    // readback happens off the main thread) while a timer emits that frame at the output's configured
    // framerate. This decouples the SEND rate from the content-change rate, so the output holds a
    // constant frame rate and honors the per-consumer FPS setting (matches the old capturePage cadence),
    // instead of dropping to the paint rate (e.g. a 30fps video capping a 60fps NDI output).
    // OSR render rate. Rendering several 4K surfaces at 60fps floods the main process with paint events and
    // browser-side render work far faster than the readback pipeline can consume them, which starves the JS
    // event loop (the send loop drops to a few ticks/sec). Cap it so render ~ matches the achievable capture
    // rate; the worker still emits at the output's full framerate (duplicating frames), so receivers see the
    // configured rate. TODO: make this adaptive to the measured readback rate.
    private static readonly OSR_RENDER_FPS = 60

    private static attachOsrCapture(window: BrowserWindow, id: string) {
        try {
            window.webContents.setFrameRate(this.OSR_RENDER_FPS)
        } catch {
            // ignore
        }

        // MUST match the useSharedTexture condition used when the window was created (see createOutputWindow):
        // with HWA disabled the window renders CPU offscreen frames (no GPU shared texture), so the shared-
        // texture handler would get textureless paints and drop every frame. Attach the CPU handler instead.
        const addon = this.getOsrCaptureAddon()
        const useSharedTexture = !!addon && !this.isHardwareAccelerationDisabled()
        if (useSharedTexture) this.attachOsrSharedTexture(window, id, addon)
        else this.attachOsrCpu(window, id)
    }

    // Whether the user disabled hardware acceleration (Settings > Other). When true, app.disableHardwareAcceleration()
    // was called at startup, so there is no GPU compositor output to capture as a shared texture and no GPU
    // convert/downscale is possible — all capture/convert/downscale must run on the CPU.
    static isHardwareAccelerationDisabled(): boolean {
        // Startup snapshot of the ACTUAL runtime state, not the live config: app.disableHardwareAcceleration()
        // was decided once at launch, so the compositor mode can't change until restart. Re-reading config here
        // would let a not-yet-applied toggle pick the wrong capture handler and kill the output.
        return hardwareAccelerationDisabled
    }

    // #16: lazily load the native shared-texture readback addon (Windows/D3D11). null when unavailable
    // (non-Windows or not built) -> OSR falls back to CPU offscreen capture.
    private static osrCaptureAddon: any = undefined
    private static getOsrCaptureAddon(): any {
        if (this.osrCaptureAddon !== undefined) return this.osrCaptureAddon
        // null when the addon can't load (platform without a built backend / not installed) -> CPU offscreen.
        try {
            this.osrCaptureAddon = require("osr-capture")
        } catch {
            console.info("OSR shared-texture addon unavailable, using CPU offscreen capture")
            this.osrCaptureAddon = null
        }
        return this.osrCaptureAddon
    }

    // #16: how many readbacks may be in flight per output at once. Kept at 1: the GPU->CPU readback is
    // bandwidth-bound, so allowing 2+ concurrent copies PER OUTPUT multiplies the total across outputs (2
    // outputs x 2 = 4 concurrent 4K copies) and contends for GPU/PCIe bandwidth, which measurably LOWERED
    // throughput with concurrent 4K outputs rather than hiding latency. (A single GLOBAL cap across all
    // outputs could pipeline safely — see HANDOFF_RENDER_OVERHAUL.md — but per-output overlap is a net loss.)
    private static readonly OSR_MAX_INFLIGHT_READBACKS = 1

// ---- Off-main in-flight depth: DERIVED per renderer via Little's law (READBACK_REWORK_PLAN §11 CV#2) ----
    // Replaces the fixed READBACK_BUDGET=6 / FS_INFLIGHT (banned constants/knobs).
    // CORRECTED after the first multi-output hardware run (§10): depth is PER-RENDERER, not one global
    // pool.   depth_r = ceil( targetFps_r × minRtt_r ) + 1.  A renderer forwards iff ITS OWN in-flight
    // < depth_r, plus the global STRUCTURAL kMaxPool gate. This plain minRtt derivation is the SHIPPING
    // depth — every alternative was measured and reverted (see the revert notes below).
    // NOTE — the "operating-rtt" pipeRtt derivation (Σ of per-segment service mins, §10/§11 CORRECTED ×3)
    // was TRIED and REVERTED on hardware evidence (§10 pipeRtt-measurement block): on a single output it is
    // a provable NO-OP (the per-segment mins are ~1/3 of the segment MEANS — cons 5 + fin 3 + enq 3 +
    // dMain 3 ≈ 14ms < minRtt ≈ 28ms, so the max(Σ, minRtt) floor always returned minRtt); in the one
    // regime where it DID change depth (two shared 4K60s: minRtt 40-43ms under load → depth 4) it made
    // throughput WORSE (sentReal ~27→~20 each, finish p95 to 92ms, mostly repeats on the wire) — deeper
    // pipelining on a BANDWIDTH-SATURATED pipe adds concurrent copy-out contention (BAR/PCIe + memory vs
    // the SpeedHQ compresses), the exact depth↑→rtt↑ spiral minRtt-only derivation exists to avoid. So the
    // depth input is the UNCONTENDED whole-frame minRtt, and the pipeRtt/segMins computation is retained
    // ONLY as [CAP-STATS] telemetry (the segment mins were diagnostically useful) — it feeds NOTHING.
    // Why per-renderer, from the measurement:
    // - The send stage is PER-SENDER serial: granting one renderer another's unused slots deepens ITS sender's
    //   completion convoys (the single-output depth-6 coalesce regression). Depth's two jobs — cap the
    //   per-sender convoy and keep the shared pipe fed across paint clumps — are both per-renderer properties.
    // - One shared work-conserving pool is UNFAIR at paint-clump granularity: whichever renderer's clump fires
    //   first takes every slot; the other's clump is dropped at admission (not queued) and it idles a full
    //   clump period (measured: gap p95 271ms, done 16+16 on a pipe that serves ~43/s). Per-renderer windows
    //   remove the shared slot structurally; the addon's FIFO chunk queue interleaves the pipe fairly.
    // - The global Σ targetFps×minRtt formula DEFLATES under load: minRtt is UNCONTENDED service time, which
    //   genuinely falls as the copy calibrator climbs (active_n 4→6 with 2 outputs → faster chunk-parallel
    //   copies) — so adding an output did not grow the pool (measured: depth stayed 3 for two 4K60s).
    // - targetFps_r = the renderer's configured paint rate (user intent, what updateRenderRate feeds
    //   setFrameRate); minRtt_r = min rtt over UNCONTENDED samples (admitted at
    //   globalInFlight === 0 → near-pure service time) in the last RTT_WINDOW_SAMPLES. NO fallback to
    //   min-over-all: contended minima include queuing that depth itself creates (depth↑→queue↑→min↑→depth↑
    //   ratchet in the saturated multi regime) — with no uncontended evidence in the window the depth HOLDS.
    //   Drains to 0 recur at clump boundaries and whenever content pauses (static slides stop paints), so
    //   the estimator refreshes in practice.
    // - Samples are tagged with the frame's pixel count and the window RESETS on a size change: service time
    //   is a function of frame size, so mixing regimes corrupts the min (also flushes any small warmup frames
    //   from before the window reached its real bounds, and handles live resolution changes).
    // - +1 = UNIVERSAL integer headroom at the ceil boundary; 2-consecutive-evaluation integer hysteresis
    //   [UNIVERSAL]; RTT_WINDOW_SAMPLES is a min-estimator stability count [UNIVERSAL] whose wall duration
    //   self-scales with the forward rate.
    // NOTE — the SELF-CALIBRATING DEPTH CONTROLLER (±1 probe knee-seeker above a minRtt floor, §10) was
    // ALSO tried here and REVERTED on hardware evidence: (i) single output — the probing itself perturbed
    // delivery (base oscillated 3↔4 with no convergence and no throughput gain: done at base 4 == base 3),
    // costing jitter to re-confirm what the depth A/Bs already proved; (ii) two shared outputs — the
    // depth↑→rtt↑→depth↑ spiral leaked in THROUGH THE FLOOR: a deeper pipe slows even the uncontended
    // samples (minRtt 34-36→50-52ms), deriveFloorFor lifted the floor 4→5, the controller climbed to 6,
    // and finish/wireGap regressed badly (finish 30-39→51-71ms, wireGap p95 98-100→104-149). The unique-rate
    // objective did NOT capture that degradation, so the "self-limiting" premise failed in practice. rtt was
    // never a controller input — but it IS the floor's input, which is spiral path enough. Do not re-add a
    // calibration layer on this axis; the scheduling/pacer/admission axis is CLOSED by measurement (§11).
    // The multi-output THROUGHPUT ceiling is the contended pipe (compress-CPU/bandwidth), not depth: this
    // admission fix provides fairness/evenness and keeps the pipe from queuing on itself — not 60×N.
    private static readonly RTT_WINDOW_SAMPLES = 300
    // STRUCTURAL: mirror of the addon's kMaxPool (osr-capture readback_win.cc) — its hard cap on concurrent
    // D3D readback contexts. Deriving past it would make AcquireContext block libuv threads (rtt inflation
    // misread as congestion), so clamp here and LOG the hit (a clamped box is context-limited, never silent).
    private static readonly ADDON_MAX_POOL = 16
    private static globalInFlight = 0
    private static lastClampLogged = 0
    private static lastGateLogged = 0
    // per-renderer state; depth bootstraps at 1 (first forwards are uncontended by construction, so minRtt
    // seeds itself within a few frames and the depth derives up). Each rtt sample carries the optional
    // serial-segment split (worker tl payload; TELEMETRY ONLY — see the pipeRtt revert note).
    private static offMain = new Map<string, OffMainState>()

    // the renderer's configured paint rate: max active framerate across its shared-render group members
    // (mirrors CaptureHelper.updateRenderRate — the rate setFrameRate was given, i.e. configured intent)
    private static rendererTargetFps(id: string): number {
        let fps = 0
        for (const m of RenderGroups.members(id)) {
            const mo = OutputHelper.getOutput(m)
            if (mo?.captureOptions) fps = Math.max(fps, CaptureHelper.getMaxActiveFramerate(mo.captureOptions.framerates || {}, mo.captureOptions.options || {}))
        }
        return fps
    }

    // kMaxPool headroom left for this renderer (the others' derived depths claim their contexts), ≥1
    // progress floor. The globalInFlight gate at admission remains the HARD structural guarantee — this
    // keeps the steady-state Σ inside the pool so the gate is a backstop, not the operating mechanism.
    private static capFor(id: string): number {
        let others = 0
        for (const [oid, ost] of this.offMain) if (oid !== id) others += ost.depth
        return Math.max(1, this.ADDON_MAX_POOL - others)
    }

    // The ADMISSION depth: the plain minRtt-derived value, clamped to the structural kMaxPool headroom
    // (cap wins — a hard resource bound). Consumed by BOTH the overBudget gate and captureFrameNDI
    // (worker paceCap = depth+1).
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

    // Uncontended-window minima over a renderer's sample window, all in one pass:
    // - minRtt: min TOTAL rtt over uncontended samples — THE depth-derivation input.
    // - seg / pipeRtt: per-segment mins + their minRtt-floored sum — [CAP-STATS] TELEMETRY ONLY since the
    //   pipeRtt-depth revert (§10): measured single-output segMins sum ~14ms < minRtt ~28ms (floored no-op)
    //   and the two-output depth-4 it produced was harmful. Kept because the per-segment service mins were
    //   diagnostically useful; they must never feed the depth again without new evidence of a helping regime.
    // All zeros when there is no uncontended evidence at all (→ depth HOLDS, never derived from contention).
    private static uncontendedMins(st: { samples: { rtt: number; unc: boolean; seg?: OffMainSegments }[] }): { minRtt: number; seg: OffMainSegments | null; pipeRtt: number } {
        let minRtt = Infinity
        let consume = Infinity, finish = Infinity, enqueue = Infinity, doneMain = Infinity
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

    // telemetry accessor for the [CAP-STATS] line; zeros/null until uncontended evidence exists
    private static pipeRttFor(id: string): { minRtt: number; seg: OffMainSegments | null; pipeRtt: number } {
        const st = this.offMain.get(id)
        if (!st) return { minRtt: 0, seg: null, pipeRtt: 0 }
        return this.uncontendedMins(st)
    }

    // the frame's pixel count defines the service-time regime; on change, restart the estimator (old-regime
    // samples are invalid — small warmup frames, live resolution changes). Depth HOLDS until re-derived.
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
        if (!st || st.px !== px) return // completion from a previous size regime — discard
        st.samples.push({ rtt, unc: uncontended, seg })
        if (st.samples.length > this.RTT_WINDOW_SAMPLES) st.samples.shift()
        this.deriveDepthFor(id, st)
    }

    private static deriveDepthFor(id: string, st: OffMainState) {
        // UNCONTENDED-minRtt derivation (§11 CV#2; the pipeRtt "operating-rtt" variant and the calibrating
        // knee-seeker layer were both REVERTED on hardware evidence — see the class comment): minRtt is
        // uncontended service time, so the depth cannot feed its own queuing back in (spiral-free by
        // construction).
        const { minRtt } = this.uncontendedMins(st)
        if (!minRtt) return // no uncontended evidence in the window → HOLD (never derive from contended samples)
        let derived = Math.max(1, Math.ceil((this.rendererTargetFps(id) * minRtt) / 1000) + 1)
        // STRUCTURAL clamp: Σ granted depth across renderers ≤ the addon's context pool, with a ≥1 floor per
        // renderer (progress guarantee). Hits are logged — a clamped box is context-limited, never silent.
        const cap = this.capFor(id)
        if (derived > cap) {
            if (this.lastClampLogged !== derived) {
                console.info(`[DEPTH] structural clamp hit: derived=${derived} for ${id} but only ${cap} of addon kMaxPool=${this.ADDON_MAX_POOL} contexts are unclaimed (context-limited, not congestion)`)
                this.lastClampLogged = derived
            }
            derived = cap
        }
        // integer hysteresis [UNIVERSAL]: apply only when the same derived value holds for 2 consecutive
        // evaluations (an integer-step rule, not a tuned margin) — the 300-sample min moves slowly anyway
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
    // Per-output teardown for the OSR shared-texture pipeline: releases any in-flight held textures and drops
    // the per-output callbacks/budget. Registered in attachOsrSharedTexture, invoked on window close AND
    // explicitly by stopCapture (see releaseOsrCaptureTextures) since capture teardown strips the window's
    // own close handler and stops the NDI worker.
    private static osrTextureCleanup: { [id: string]: () => void } = {}

    // Explicitly release OSR shared textures held for an output. Safe to call for any id (no-op if the output
    // isn't an off-main OSR renderer). Called by CaptureLifecycle.stopCapture before it strips the window's
    // listeners, so in-flight textures can't be GC'd unreleased and drain Electron's OSR frame pool.
    static releaseOsrCaptureTextures(id: string) {
        this.osrTextureCleanup[id]?.()
    }

    // GPU shared-texture path (#16): read each paint texture back off the main thread and hand the RAW buffer
    // to the transmit pipeline (no createFromBitmap here — buffer-consumers take it directly, #20). On Windows
    // the addon can also GPU-convert straight to NDI/SDI's UYVY/UYVA during readback (getReadbackFormat).
    // Readbacks are throttled to the send rate and pipelined (up to OSR_MAX_INFLIGHT_READBACKS); every texture
    // is released so the compositor frame pool drains.
    private static attachOsrSharedTexture(window: BrowserWindow, id: string, addon: any) {
        // this renderer window runs its own off-main readback pipeline with its OWN admission window:
        // depth_r = ceil(targetFps_r × minRtt_r)+1 (empty sample window until its first completions seed minRtt)
        this.offMainRendererCount++
        this.offMain.set(id, { samples: [], px: 0, depth: 1, pendingDepth: 0, depthStreak: 0 })

        let lastRaw: { buffer: Buffer; size: { width: number; height: number }; format: number } | null = null
        let inFlight = 0
        let lastReadback = 0
        // monotonic paint counter: readbacks can resolve out of order, so only the newest result wins
        let dispatchSeq = 0
        let appliedSeq = -1

        // OFF-MAIN state: up to the DERIVED global depth textures forwarded to the worker at once (PIPELINED),
        // each tracked by a monotonic seq so the GPU consume of the next frame overlaps the slow PCIe read of the
        // previous one. The worker allocates a readback slot per in-flight capture on demand, so concurrent
        // readbacks never collide. Each texture is released on releaseTexture (GPU consumed) or captureDone.
        let offMainInFlight = 0
        let offMainSeq = 0
        const heldTextures = new Map<number, any>()
        const releaseHeldSeq = (seq: number) => {
            const t = heldTextures.get(seq)
            if (t) {
                try {
                    t.release()
                } catch {
                    // ignore
                }
                heldTextures.delete(seq)
            }
        }

        // --- optional capture stats (FS_CAP_STATS=1): per-renderer throughput, printed once/sec, to diagnose
        // shared-render fan-out and pipelining behaviour against the receiver fps. Off by default; remove before
        // shipping. `fwd` = readbacks forwarded to the worker, `done` = captures the worker finished (≈ the
        // per-renderer send rate all its members see), `rtt` = avg forward→done round-trip (rises when the
        // fan-out serialises sends), `dropBudget`/`dropInterval` = paints dropped by the in-flight cap vs the
        // send-interval throttle. Members>1 means shared-render is fanning one capture to several NDI senders.
        const STATS = !!process.env.FS_CAP_STATS
        let sPaints = 0, sDropBudget = 0, sDropInterval = 0, sForward = 0, sDone = 0, sReadback = 0, sRttSum = 0, sRttCount = 0
        // burst detection: how many paints arrived within 5ms of the previous paint (i.e. NOT evenly spaced at
        // the target interval). High = the OSR compositor delivers paints in clumps, so an interval throttle
        // discards clump members even though the overall paint rate looks like 60.
        let sBurstPaints = 0, lastPaintTime = 0
        // delivery-evenness: inter-arrival gaps between consecutive completed unique frames (captureDone). Mean
        // is just 1000/done; the SPREAD (stddev/p95/gaps>25ms) is what reads as jitter — a convoyed pipeline
        // delivers frames in clumps so gaps swing from ~5ms to ~100ms+ even at a healthy mean fps.
        const sGaps: number[] = []
        let lastDoneTime = 0
        // [TIMELINE] live per-frame hop attribution (FS_CAP_STATS): the worker posts hop timestamps back with
        // captureDone (same-process clock), differenced here against the forward time. Purpose: the harness
        // measured the ISOLATED readback at ~7ms/frame while the live rtt is ~53ms — these segments LOCATE the
        // missing serial cost by measurement instead of attribution. Segments: fwdRecv (main→worker message),
        // recvCons (worker JS before the consume dispatch), consume (libuv queue + GPU convert + wait),
        // phaseGap (worker JS hop between the two phases), finish (libuv queue + copy-out), enqueue (pacer
        // memcpy + fan-out on the worker JS thread), doneMain (worker→main captureDone message). pipeIdle =
        // ms this window with ZERO frames in flight: a serial pipeline stage shows a busy pipe at flat done,
        // admission starvation from paint clumps shows as idle — the two competing explanations separate here.
        const sTl: { [seg: string]: number[] } = { fwdRecv: [], recvCons: [], consume: [], phaseGap: [], finish: [], enqueue: [], doneMain: [] }
        let sIdleMs = 0
        let idleSince = STATS ? Date.now() : 0
        // ALWAYS-ON (not stats-gated): per-forward timestamp + uncontended tag + size-regime tag — the
        // samples feeding the depth estimator (recordRtt). Also the authoritative in-flight ledger: a seq
        // is counted in globalInFlight iff it is in this map, so completion/teardown can never
        // double-decrement.
        const forwardAt = new Map<number, { t: number; unc: boolean; px: number }>()
        let statsTimer: any = null
        if (STATS) {
            statsTimer = setInterval(() => {
                const m = RenderGroups.members(id)
                const rtt = sRttCount ? Math.round(sRttSum / sRttCount) : 0
                const sendCap = Math.round(1000 / this.getOsrSendInterval(id))
                const ndiFps = OutputHelper.getOutput(id)?.captureOptions?.framerates?.ndi ?? "?"
                // delivery-evenness stats from the inter-done gaps collected this window
                let gapMean = 0, gapStd = 0, gapP95 = 0, gapBig = 0
                if (sGaps.length) {
                    gapMean = sGaps.reduce((a, b) => a + b, 0) / sGaps.length
                    gapStd = Math.sqrt(sGaps.reduce((a, b) => a + (b - gapMean) * (b - gapMean), 0) / sGaps.length)
                    const sorted = [...sGaps].sort((a, b) => a - b)
                    gapP95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
                    gapBig = sGaps.filter((g) => g > 25).length
                }
                // [TIMELINE] per-hop attribution over this window's clean-path frames: each segment is the
                // window MEAN, so the segment means sum to ≈ the mean rtt — the ~missing serial cost shows up
                // as whichever segment carries it. p95 on the two dispatch segments (consume/finish) separates
                // "every frame pays it" (serial stage) from "some frames wait" (queueing on a busy pool/loop).
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
                // pipeIdle: ms this window with ZERO frames in flight for this renderer. A serial pipeline
                // stage keeps the pipe BUSY at flat done (idle ~0); paint-clump admission starvation shows as
                // idle time — the two competing explanations for done≈40 separate on this number.
                let idleMs = sIdleMs
                if (idleSince) {
                    const nowT = Date.now()
                    idleMs += nowT - idleSince
                    idleSince = nowT
                }
                // pipeRtt + its four uncontended segment mins: TELEMETRY ONLY since the pipeRtt-depth revert
                // (the depth input is minRtt); printed because the service-segment mins stay diagnostic
                const pr = this.pipeRttFor(id)
                const segStr = pr.seg ? `segMins(cons=${pr.seg.consume} fin=${pr.seg.finish} enq=${pr.seg.enqueue} dMain=${pr.seg.doneMain})` : "segMins(none)"
                console.info(`[CAP-STATS ${id}] members=[${m.join(",")}] paints=${sPaints} burst=${sBurstPaints} fwd=${sForward} done=${sDone} readback=${sReadback} dropBudget=${sDropBudget} dropInterval=${sDropInterval} inflight=${offMainInFlight}/${this.depthFor(id)} globalInflight=${this.globalInFlight} depth=${this.depthFor(id)} depthTotal=${this.totalDepth()} minRtt=${pr.minRtt}ms pipeRtt=${pr.pipeRtt}ms ${segStr} renderers=${this.offMainRendererCount} rtt=${rtt}ms gap(mean=${Math.round(gapMean)} std=${Math.round(gapStd)} p95=${gapP95} >25ms=${gapBig}) pipeIdle=${Math.round(idleMs)}ms${tlStr} sendCap=${sendCap}fps ndiFramerate=${ndiFps}`)
                sPaints = sDropBudget = sDropInterval = sForward = sDone = sReadback = sRttSum = sRttCount = sBurstPaints = 0
                sGaps.length = 0
                sIdleMs = 0
                for (const seg of Object.values(sTl)) seg.length = 0
            }, 1000)
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
                // feed the derived-depth controller: rtt sample + uncontended tag + size regime + the serial
                // segment split (ALWAYS-ON, not stats-gated — the depth derivation consumes these mins).
                // Segments are clamped ≥0 (same-process Date.now() clocks, but never let a skewed frame
                // inject a negative service time into the min estimator).
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
            }
            if (STATS) {
                sDone++
                if (lastDoneTime) sGaps.push(now - lastDoneTime)
                lastDoneTime = now
            }
        }

        window.webContents.on("paint", (event: any) => {
            const tex = event?.texture
            const info = tex?.textureInfo
            if (!info) return
            if (STATS) {
                sPaints++
                const nowP = Date.now()
                if (lastPaintTime && nowP - lastPaintTime < 5) sBurstPaints++
                lastPaintTime = nowP
            }

            const width = info.codedSize.width
            const height = info.codedSize.height
            // Windows/macOS pass the shared-texture handle; Linux passes the dmabuf planes + modifier
            const source = process.platform === "linux" ? { planes: info.planes, modifier: info.modifier } : info.sharedTextureHandle
            // ask the addon to convert straight to NDI/SDI's UYVY/UYVA when a single such consumer is active
            const requestedFormat = CaptureHelper.Transmitter.getReadbackFormat(id, { width, height })

            // OFF-MAIN capture: an output with an NDI sender whose only OTHER consumers are server/stage can run
            // its ENTIRE per-frame pipeline in the worker — readback + BGRA->UYVY convert (NDI) + downscale
            // (server/stage) — so the main process never touches 4K pixels. Forward just the 8-byte handle; the
            // worker sends NDI and ships small downscaled buffers back for server/stage. One texture in flight,
            // released on captureDone. NDI-only outputs take the GPU-converted UYVY/UYVA (format 1/2) directly;
            // mixed outputs read back BGRA (format 0) so the worker can both convert and downscale from it.
            // Off-main routing for the whole render GROUP (shared-render): the renderer captures ONCE and the
            // readback fans out to every member's NDI sender (+ server/stage). `members` is [id] when sharing is
            // off, so this reduces to the single-output path. Eligible iff every member's only non-NDI consumers
            // are server/stage; needsScaled iff any member has a server/stage consumer (then the readback must
            // also produce the GPU-downscaled BGRA — requires the Windows two-phase readback).
            const members = NdiSender.NDI[id]?.sender ? RenderGroups.members(id) : []
            const groupInfo = members.length ? CaptureHelper.Transmitter.groupOffMainInfo(members) : null
            const hasGpuDownscale = typeof addon.readbackConsume === "function"
            const mixedOffMain = !!groupInfo && groupInfo.eligible && groupInfo.needsScaled && hasGpuDownscale
            const canOffMain = !!groupInfo && groupInfo.eligible && (!groupInfo.needsScaled || hasGpuDownscale)
            if (canOffMain) {
                // Forward EVERY paint, bounded ONLY by this renderer's DERIVED in-flight depth — never by a
                // rate throttle. The OSR render rate already caps paint production to the configured framerate
                // (updateRenderRate -> setFrameRate), so the compositor only hands us frames the output actually
                // wants; it just delivers them in clumps (main-thread scheduling), and those clumped frames are
                // UNIQUE. Any per-slot pacing discards them and caps unique fps well below what the GPU can
                // deliver. The depth exists to stop the pipeline queuing on itself (excess depth manufactures
                // rtt + per-SENDER completion convoys on the serial copy pipe), not to cap fps. Admission is
                // PER-RENDERER (each output owns its window — no shared slot a paint clump can monopolize; the
                // measured multi regression, gap p95 271ms, was FCFS clump capture of one global pool) plus the
                // STRUCTURAL kMaxPool gate on the total.
                OutputLifecycle.noteFrameSize(id, width * height)
                const overBudget = offMainInFlight >= OutputLifecycle.depthFor(id)
                const overPool = OutputLifecycle.globalInFlight >= OutputLifecycle.ADDON_MAX_POOL
                if (overPool && !overBudget) {
                    const nowG = Date.now()
                    if (nowG - OutputLifecycle.lastGateLogged > 1000) {
                        console.info(`[DEPTH] structural gate hit: globalInFlight=${OutputLifecycle.globalInFlight} >= addon kMaxPool=${OutputLifecycle.ADDON_MAX_POOL} (context-limited, not congestion)`)
                        OutputLifecycle.lastGateLogged = nowG
                    }
                }
                if (overBudget || overPool) {
                    if (STATS) sDropBudget++
                    try {
                        tex.release()
                    } catch {
                        // ignore
                    }
                    return
                }
                const output = OutputHelper.getOutput(id)
                const framerate = output?.captureOptions?.framerates?.ndi || 30
                const ratio = height ? width / height : 16 / 9
                const transparent = output?.transparent === true
                // NDI always gets GPU-converted UYVY/UYVA. For a mixed output also ask the addon to GPU-downscale
                // a small BGRA (server/stage) in the same readback pass -> the worker posts it back for those.
                const fmt = transparent ? 2 : 1
                const scaled = mixedOffMain ? CaptureHelper.Transmitter.getScaledTarget({ width, height }) : null
                const seq = ++offMainSeq
                // depth = this renderer's derived depth_r — the worker's send pacer sizes its queue at depth+1
                if (NdiSender.captureFrameNDI(id, source, { size: { width, height }, ratio, framerate, format: fmt, transparent, dstW: scaled?.dstW || 0, dstH: scaled?.dstH || 0, seq, members, depth: OutputLifecycle.depthFor(id) })) {
                    // tag BEFORE incrementing: uncontended = nothing in flight anywhere when this frame was
                    // admitted -> its rtt is (near-)pure service time, the minRtt estimator's ONLY valid samples
                    forwardAt.set(seq, { t: Date.now(), unc: OutputLifecycle.globalInFlight === 0, px: width * height })
                    OutputLifecycle.globalInFlight++
                    offMainInFlight++
                    heldTextures.set(seq, tex)
                    if (STATS) {
                        sForward++
                        // pipe busy again: close the idle window (idle = drained→this admission)
                        if (idleSince) {
                            sIdleMs += Date.now() - idleSince
                            idleSince = 0
                        }
                    }
                } else {
                    try {
                        tex.release()
                    } catch {
                        // ignore
                    }
                }
                return
            }

            if (inFlight >= this.OSR_MAX_INFLIGHT_READBACKS || Date.now() - lastReadback < this.getOsrSendInterval(id)) {
                try {
                    tex.release()
                } catch {
                    // ignore
                }
                return
            }
            inFlight++
            lastReadback = Date.now()
            if (STATS) sReadback++
            const seq = ++dispatchSeq
            // pass the output id as the pool key so the addon reuses this output's buffers (avoids a per-frame
            // ~16MB alloc/copy on the main thread); the worker fills the pooled buffer off-thread
            addon
                .readback(source, width, height, requestedFormat, id)
                .then((buf: Buffer) => {
                    // drop a stale frame that resolved after a newer one already landed
                    if (seq < appliedSeq) return
                    appliedSeq = seq
                    // trust the requested format: the addon honours it (GPU convert on Windows, CPU on mac/linux).
                    // Length can't distinguish RGBA (3) from BGRA (0) — both are w*4*h — so don't derive from size.
                    lastRaw = { buffer: buf, size: { width, height }, format: requestedFormat }
                })
                .catch((err: any) => console.error("OSR shared-texture readback error:", err))
                .finally(() => {
                    try {
                        tex.release()
                    } catch {
                        // ignore
                    }
                    inFlight--
                })
        })

        this.startOsrSendTimer(window, id, () => {
            if (lastRaw) CaptureHelper.Transmitter.transmitFrame(id, null, undefined, lastRaw)
        })

        // Release every held shared texture and drop this output's callbacks + readback-budget slot. Runs on
        // window close AND when stopCapture calls releaseOsrCaptureTextures — because stopCapture strips this
        // window's listeners and stops the NDI worker, so without an explicit call any in-flight off-main
        // texture would be GC'd unreleased and drain Electron's OSR frame pool (stalls capture / GPU reset).
        // Idempotent so the two triggers can't double-release or double-decrement the renderer count.
        let toreDown = false
        const teardown = () => {
            if (toreDown) return
            toreDown = true
            if (statsTimer) {
                clearInterval(statsTimer)
                statsTimer = null
            }
            // return this renderer's outstanding in-flight slots to the global counter (late captureDones for
            // these seqs are ignored — the callbacks are deleted below), and drop its estimator state (other
            // renderers' clamp headroom recomputes on their next derivation)
            OutputLifecycle.globalInFlight = Math.max(0, OutputLifecycle.globalInFlight - forwardAt.size)
            forwardAt.clear()
            offMainInFlight = 0
            this.offMain.delete(id)
            this.offMainRendererCount = Math.max(0, this.offMainRendererCount - 1)
            delete NdiSender.captureDoneCallbacks[id]
            delete NdiSender.releaseTextureCallbacks[id]
            heldTextures.forEach((t) => {
                try {
                    t.release()
                } catch {
                    // ignore
                }
            })
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
            lastImage = image
        })
        this.startOsrSendTimer(window, id, () => {
            if (lastImage) CaptureHelper.Transmitter.transmitFrame(id, lastImage)
        })
    }

    // emit the latest frame at the output's configured framerate: decouples the send rate from the
    // content-change rate so the per-consumer FPS is honored and static content still holds a constant rate.
    // The send round-trip (post -> worker video() -> videoDone) is mostly main<->worker messaging latency and
    // can exceed the frame interval; NdiSender allows a small number of sends in flight (MAX_INFLIGHT_SENDS)
    // so this timer can post every interval without stalling on the previous send's (laggy) completion.
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

        // renderer removed with followers still present -> rebuild the survivors (the first becomes the new
        // renderer with its own window; the rest re-follow it) so the shared group keeps running
        if (groupInfo?.wasRenderer && groupInfo.members.length) this.rebuildGroupMembers(groupInfo.members)

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
    private static rebuildGroupMembers(members: string[]) {
        // don't resurrect a group mid-teardown (closing all outputs removes the renderer too)
        if (this.closingAllOutputs) return
        const configs = members.map((m) => RenderGroups.getConfig(m)).filter((c): c is Output => !!c)
        for (const m of members) {
            this.clearPendingCaptureStart(m)
            CaptureHelper.Lifecycle.stopCapture(m)
            NdiSender.stopSenderNDI(m)
            OutputHelper.deleteOutput(m)
        }
        setTimeout(() => {
            for (const config of configs) void this.createOutput(config)
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
