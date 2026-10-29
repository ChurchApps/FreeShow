import { BrowserWindow, screen, type BrowserWindowConstructorOptions, type Rectangle } from "electron"
import { OUTPUT_CONSOLE, getMainWindow, hardwareAccelerationDisabled, isMac, loadWindowContent, toApp } from "../.."
import { OUTPUT, STARTUP } from "../../../types/Channels"
import type { Output } from "../../../types/Output"
import { BlackmagicBridge as BlackmagicSender } from "../../blackmagic/BlackmagicBridge"
import { initializeSender } from "../../blackmagic/bmdTalk"
import { CaptureHelper } from "../../capture/CaptureHelper"
import { PreviewStream } from "../../capture/PreviewStream"
import { SenderCapture } from "../../capture/SenderCapture"
import { StreamReceiverHost } from "../../capture/StreamReceiverHost"
import { NdiSender } from "../../ndi/NdiSender"
import { setDataNDI } from "../../ndi/talk"
import { OmtSender } from "../../omt/OmtSender"
import { setDataOMT } from "../../omt/talk"
import { RtmpBridge } from "../../streaming/RtmpBridge"
import { WebRtcHost } from "../../streaming/WebRtcHost"
import { gpuCompositingAvailable, gpuStateSettled } from "../../utils/gpu"
import { wait } from "../../utils/helpers"
import { ruleViolation } from "../../utils/ruleCheck"
import { outputOptions } from "../../utils/windowOptions"
import { OutputHelper } from "../OutputHelper"
import { MediaLayers } from "./MediaLayers"
import { setOutputAlwaysOnTop, useOutputPanel } from "./OutputAlwaysOnTop"
import { OutputPresenter } from "./OutputPresenter"
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
        RenderGroups.onMembership = (changes) => this.applyMembership(changes)
        this.watchPreviewSubscribers()

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

            const targetBounds = OutputVisibility.resolveOutputBounds({ ...output, bounds: output.intendedBounds, id })
            const currentBounds = output.window.getBounds()
            if (JSON.stringify(currentBounds) !== JSON.stringify(targetBounds)) {
                OutputHelper.Bounds.updateBounds({ id, bounds: targetBounds })
            }
        })
    }

    static async createOutput(output: Output) {
        await gpuStateSettled // the offscreen capture mode depends on the real GPU state
        const id: string = output.id || ""
        if (!id) return

        if (OutputHelper.getOutput(id)) {
            CaptureHelper.Lifecycle.stopCapture(id)
            this.removeOutput(id, output)
            return
        }

        this.clearPendingCaptureStart(id)

        // registered before its page is made so the class render size includes it
        const shareable = this.shareable(output)
        if (shareable) RenderGroups.register(id, output)

        // disable move/resize listeners during initialization
        OutputHelper.Bounds.disableWindowMoveListener()

        // invisible/capture outputs render DPI-corrected so capturePage() matches the configured resolution
        let resolvedBounds = output.invisible ? output.bounds : OutputVisibility.resolveOutputBounds(output)
        // shareable pages render at the class's largest size; sendSize stays this output's own
        const sendSize = { width: output.bounds.width, height: output.bounds.height }
        const groupSize = shareable && this.isOsrOutput(output) ? RenderGroups.renderSize(id) : null
        if (groupSize && (groupSize.width !== resolvedBounds.width || groupSize.height !== resolvedBounds.height)) resolvedBounds = { ...resolvedBounds, ...groupSize }
        const renderBounds = OutputHelper.Bounds.getRenderBounds(output, resolvedBounds)
        const outputWindow = this.createOutputWindow({ ...renderBounds, alwaysOnTop: output.alwaysOnTop !== false, backgroundColor: output.transparent ? "#00000000" : "#000000" }, id, output.name, output)
        // const previewWindow = this.createPreviewWindow({ ...output.bounds, backgroundColor: "#000000" })

        OutputHelper.setOutput(id, { window: outputWindow, osr: this.isOsrOutput(output), invisible: output.invisible, boundsLocked: output.boundsLocked, screen: output.screen, intendedBounds: resolvedBounds, sendSize, transparent: output.transparent, webrtcData: output.webrtcData, rtmpData: output.rtmpData })
        // OutputHelper.setOutput(id, { window: outputWindow, previewWindow: previewWindow })
        OutputHelper.Bounds.updateBounds({ id: output.id!, bounds: resolvedBounds })
        this.updateWindowConstraints(id)
        if (shareable) {
            if (this.isOsrOutput(output)) RenderGroups.setRenderable(id, true)
            this.fitClass(id)
            this.updateDisplayedSharing(id)
        }

        // OutputHelper.Bounds.updatePreviewBounds()

        this.pendingCaptureStart[id] = setTimeout(() => {
            delete this.pendingCaptureStart[id]

            const currentOutput = OutputHelper.getOutput(id)
            if (!CaptureHelper.Lifecycle || !currentOutput || currentOutput.window !== outputWindow) return // window closed or replaced before timeout finished
            CaptureHelper.Lifecycle.startCapture(id, { ndi: output.ndi || false, omt: output.omt || false, blackmagic: !!output.blackmagic, webrtc: !!currentOutput.webrtcData?.streaming, rtmp: !!currentOutput.rtmpData?.streaming })
        }, 1200)

        // NDI
        if (output.ndi) {
            await NdiSender.createSenderNDI(id, NdiSender.initNameNDI(output.ndiData?.name, output.name), output.ndiData?.groups)
            if (output.ndiData) setDataNDI({ id, ...output.ndiData })
        }

        // OMT
        if (output.omt) {
            await OmtSender.createSenderOMT(id, OmtSender.initNameOMT(output.omtData?.name, output.name), output.omtData?.quality)
            if (output.omtData) setDataOMT({ id, ...output.omtData })
        }

        // Blackmagic
        if (output.blackmagic) initializeSender(output, outputWindow, id)
    }

    // Blackmagic needs a dedicated capture; displayed outputs need their own window
    private static canShareRender(output: Output): boolean {
        return (!!output.ndi || !!output.omt || !!output.webrtc || !!output.rtmp) && !output.blackmagic && this.isOsrOutput(output)
    }

    // shared frames come from the capture worker, so only on the shared-texture path
    private static shareable(output: Output): boolean {
        if (!RenderGroups.enabled || !this.useSharedTextureCapture() || output.blackmagic) return false
        return this.isOsrOutput(output) ? this.canShareRender(output) : true
    }

    /** a displayed output sharing with an offscreen classmate through its capture surface */
    static sharesThroughSurface(id: string): boolean {
        const output = OutputHelper.getOutput(id)
        if (!output || output.invisible || !RenderGroups.isRegistered(id)) return false
        return RenderGroups.classMembers(id).some((m) => m !== id && OutputHelper.getOutput(m)?.invisible)
    }

    // displayed outputs get a capture surface once their class has an offscreen member
    private static updateDisplayedSharing(id: string) {
        const members = RenderGroups.classMembers(id)
        const hasOffscreen = members.some((m) => OutputHelper.getOutput(m)?.invisible)
        if (!hasOffscreen) return
        for (const m of members) {
            const o = OutputHelper.getOutput(m)
            if (!o || o.invisible || o.captureWindow) continue
            this.createCaptureSurface(m)
        }
    }

    // the send size follows this output; the render size follows its class
    static boundsChanged(data: { id: string; bounds: Rectangle }) {
        OutputHelper.Bounds.updateBounds(data)
        const output = OutputHelper.getOutput(data.id)
        const config = RenderGroups.getConfig(data.id)
        if (!output || !config || !data.bounds?.width || !data.bounds?.height) return
        if (output.invisible) output.sendSize = { width: data.bounds.width, height: data.bounds.height }
        RenderGroups.updateConfig(data.id, { ...config, bounds: data.bounds })
        this.fitClass(data.id)
    }

    // only the render page counts; a window drawing captured frames animates nothing itself
    static pageBusy(sender: Electron.WebContents, data: { id: string; busy: boolean; dom?: string; seq?: number }) {
        const output = data?.id ? OutputHelper.getOutput(data.id) : null
        if (!output || OutputHelper.renderWindow(output)?.webContents !== sender) return
        RenderGroups.setPageState(data.id, !!data.busy, data.dom || "", data.seq || 0)
        // ensure the settled post-animation frame is painted on offscreen renderers even if the
        // compositor dropped or coalesced the final animation frame
        if (!data.busy && output.osr && RenderGroups.isRenderer(data.id)) {
            this.requestRepaint(data.id)
        }
    }

    // a follower's own page idles (kept current, never read); a renderer's page returns to full rate
    private static applyMembership(changes: { id: string; from: string; to: string }[]) {
        const touched = new Set<string>()
        for (const c of changes) {
            touched.add(c.from)
            touched.add(c.to)
            touched.add(c.id)
        }
        for (const id of touched) {
            if (!OutputHelper.getOutput(id)) continue
            CaptureHelper.updateRenderRate(id)
            if (RenderGroups.isRenderer(id)) this.requestRepaint(id)
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
            const useSharedTexture = this.useSharedTextureCapture()
            const wp: any = { ...outputOptions.webPreferences, offscreen: useSharedTexture ? { useSharedTexture: true } : true }
            options.webPreferences = wp
            this.avoidLinuxDisplaySizeShrink(options)
        }

        if (options.alwaysOnTop === false) {
            options.skipTaskbar = false
            if (!extra.boundsLocked) options.resizable = true
        }

        if (useOutputPanel(options.alwaysOnTop, osr)) options.type = "panel"

        if (OUTPUT_CONSOLE) options.webPreferences!.devTools = true
        const window: BrowserWindow | null = new BrowserWindow(options)

        if (osr) {
            this.attachOsrCapture(window, id)
            this.enableMediaLayers(window)
        }

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

    // Chromium X11 shrinks a window matching a display's size by 1px, an odd width NDI/OMT refuses;
    // offscreen windows are not WM-managed, so nudge the size off the match
    private static avoidLinuxDisplaySizeShrink(options: BrowserWindowConstructorOptions) {
        if (process.platform !== "linux" || !options.width || !options.height) return
        const matchesDisplay = screen.getAllDisplays().some((d) => {
            const sf = d.scaleFactor || 1
            return Math.round(d.size.width * sf) === options.width && Math.round(d.size.height * sf) === options.height
        })
        // by 2: packed formats pair pixels, so an odd width fails the readback
        if (matchesDisplay) {
            options.width += 2
            options.height += 2
        }
    }

    // every page of a class renders at the class's largest size; members keep their own sendSize
    static fitClass(id: string) {
        const size = RenderGroups.renderSize(id)
        if (!size) return
        for (const m of RenderGroups.classMembers(id)) {
            const o = OutputHelper.getOutput(m)
            if (!o) continue
            if (o.invisible && o.osr) {
                const current = o.intendedBounds
                if (!current || (current.width === size.width && current.height === size.height)) continue
                OutputHelper.Bounds.updateBounds({ id: m, bounds: { ...current, width: size.width, height: size.height } })
            } else if (o.captureWindow && !o.captureWindow.isDestroyed()) {
                const rb = OutputHelper.Bounds.getRenderBounds({ invisible: true }, { x: 0, y: 0, ...size })
                o.captureWindow.setBounds({ x: 0, y: 0, width: rb.width, height: rb.height })
            }
        }
    }

    // itself and its followers, or none when it follows another page
    static groupMembers(id: string): string[] {
        return RenderGroups.isFollower(id) ? [] : RenderGroups.members(id)
    }

    // a displayed output is captured through a hidden surface instead (createCaptureSurface)
    private static isOsrOutput(output: { invisible?: boolean }): boolean {
        return output.invisible === true
    }

    // offscreen mode is fixed at creation: capture surfaces are rebuilt here, offscreen output windows by the app
    private static rebuildAfterDemotion() {
        let needsAppRestart = false
        for (const id of OutputHelper.getKeys()) {
            const output = OutputHelper.getOutput(id)
            if (!output) continue
            if (output.captureWindow) {
                // restart rather than swap: the CPU path may have no surface and captures the output's own window
                const toggles = { ...(output.captureOptions?.options || {}) }
                this.destroyCaptureSurface(id)
                CaptureHelper.Lifecycle.stopCapture(id)
                CaptureHelper.Lifecycle.startCapture(id, toggles)
                const mode = OutputHelper.getOutput(id)?.captureWindow ? "a new capture surface" : "its own window"
                console.info(`[OSR ${id}] capture restarted on the CPU path, from ${mode}`)
            } else if (output.osr) {
                needsAppRestart = true
            }
        }
        if (needsAppRestart) toApp(OUTPUT, { channel: "RESTART", data: {} })
    }

    // presented frames come from the capture worker, which runs only on the shared-texture path
    private static presenterCanDraw(): boolean {
        return this.useSharedTextureCapture()
    }

    static createCaptureSurface(id: string): BrowserWindow | null {
        const output = OutputHelper.getOutput(id)
        if (!output || (output.osr && !output.captureWindow)) return null
        // without a shared texture a surface gains nothing, and without GPU drivers it paints no video
        if (!this.useSharedTextureCapture()) return null

        const existing = output.captureWindow
        if (existing && !existing.isDestroyed()) return existing

        const classSize = RenderGroups.isRegistered(id) ? RenderGroups.renderSize(id) : null
        // at the origin: a hidden window's pixel size follows the display it sits on
        const size = classSize || output.intendedBounds
        const bounds = size ? { x: 0, y: 0, width: size.width, height: size.height } : null
        if (!bounds) return null

        // DPI-corrected so the hidden window yields the configured pixels
        const renderBounds = OutputHelper.Bounds.getRenderBounds({ invisible: true }, bounds)
        const options: BrowserWindowConstructorOptions = { ...outputOptions, ...renderBounds, show: false, skipTaskbar: true, alwaysOnTop: false, backgroundColor: output.transparent ? "#00000000" : "#000000" }
        const useSharedTexture = this.useSharedTextureCapture()
        options.webPreferences = { ...outputOptions.webPreferences, offscreen: useSharedTexture ? { useSharedTexture: true } : true } as any
        this.avoidLinuxDisplaySizeShrink(options)

        const window = new BrowserWindow(options)
        window.setSkipTaskbar(true)
        this.attachOsrCapture(window, id)
        this.enableMediaLayers(window)
        loadWindowContent(window, "output")

        output.captureWindow = window
        output.osr = true
        // the on-screen window now draws the capture instead of rendering
        if (this.presenterCanDraw()) OutputPresenter.start(id, output.window)
        if (RenderGroups.isRegistered(id)) RenderGroups.setRenderable(id, true)
        CaptureHelper.updateRenderRate(id)
        return window
    }

    static destroyCaptureSurface(id: string) {
        const output = OutputHelper.getOutput(id)
        const window = output?.captureWindow
        if (!output || !window) return

        output.captureWindow = undefined
        output.osr = false
        if (RenderGroups.isRegistered(id)) RenderGroups.setRenderable(id, false)
        OutputPresenter.stop(id)
        this.stopOsrPaintDrive(id)
        try {
            this.osrCaptureAddon?.releasePool?.(id)
        } catch {
            // ignore
        }
        if (window.isDestroyed()) return
        try {
            window.removeAllListeners("close")
            window.destroy()
        } catch (err) {
            console.error(err)
        }
    }

    // when the worker last forwarded a frame for this output; main stays idle while it is recent
    private static offMainAt = new Map<string, number>()
    // in frame intervals of the output
    private static readonly OFF_MAIN_ACTIVE_FRAMES = 4

    static noteOffMain(id: string) {
        this.offMainAt.set(id, Date.now())
    }

    // invalidate() does not make an offscreen page paint; the page redraws a 1px canvas (RepaintTick.svelte)
    static requestRepaint(id: string) {
        OutputHelper.Send.sendToWindow(RenderGroups.rendererOf(id), { channel: "REPAINT" })
    }

    static isOffMainActive(id: string): boolean {
        const at = this.offMainAt.get(id)
        if (!at) return false
        return Date.now() - at < this.getOsrTargetInterval(id) * this.OFF_MAIN_ACTIVE_FRAMES
    }

    // max of display refresh rates and the max configurable fps; updateRenderRate picks the actual rate
    private static renderCeiling = 0
    static get OSR_RENDER_FPS(): number {
        if (this.renderCeiling) return this.renderCeiling
        let best = CaptureHelper.MAX_CONFIGURABLE_FPS
        try {
            for (const d of screen.getAllDisplays()) best = Math.max(best, d.displayFrequency || 0)
        } catch {
            // headless: no display information
        }
        this.renderCeiling = Math.max(1, Math.round(best))
        return this.renderCeiling
    }

    private static attachOsrCapture(window: BrowserWindow, id: string) {
        try {
            window.webContents.setFrameRate(this.OSR_RENDER_FPS)
        } catch {
            // ignore
        }

        // must match the window's offscreen mode from createOutputWindow: CPU-mode paints are bitmaps,
        // so attach the CPU handler instead of the shared-texture one
        const addon = this.getOsrCaptureAddon()
        if (this.useSharedTextureCapture()) this.attachOsrSharedTexture(window, id, addon)
        else this.attachOsrCpu(window, id)

        // begin-frame drive; CaptureHelper.updateRenderRate re-drives it when the rate changes
        if (this.needsPaintDrive()) {
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
    private static osrInvalidatesTotal = new Map<string, number>()
    private static readonly DRIVE_TIMEOUT_INTERVALS = 4

    private static noteOsrPaint(id: string) {
        if (!this.needsPaintDrive()) return
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

    // the compositor drives shared-texture paints but not CPU ones; Linux has no reliable offscreen vsync
    private static needsPaintDrive() {
        return process.platform === "linux" || !this.useSharedTextureCapture()
    }

    static updateOsrPaintDrive(window: BrowserWindow, id: string, fps: number) {
        if (!this.needsPaintDrive()) return
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
                this.osrInvalidatesTotal.set(id, (this.osrInvalidatesTotal.get(id) || 0) + 1)
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
        this.osrInvalidatesTotal.delete(id)
    }

    static isHardwareAccelerationDisabled(): boolean {
        return hardwareAccelerationDisabled
    }

    // set once when shared-texture paints carry no texture (software GL can report gpu_compositing enabled)
    private static sharedTextureDemoted = false

    // Shared-texture capture requires readback addon and active GPU compositing
    private static captureModeLogged = false
    private static useSharedTextureCapture(): boolean {
        const addon = !!this.getOsrCaptureAddon()
        const gpu = gpuCompositingAvailable() && !this.sharedTextureDemoted
        const shared = addon && gpu
        if (!this.captureModeLogged) {
            this.captureModeLogged = true
            console.info(`[OSR] capture mode: ${shared ? "gpu shared-texture" : "cpu bitmap"} (readback addon=${addon ? "yes" : "no"}, gpu compositing=${gpu ? "hardware" : hardwareAccelerationDisabled ? "disabled in settings" : "software/unavailable"})`)
        }
        return shared
    }

    // needs shared-texture capture and an addon that accepts another window's texture as a layer
    static mediaLayersAvailable(): boolean {
        return process.env.FS_MEDIA_LAYER !== "0" && this.useSharedTextureCapture() && !!this.getOsrCaptureAddon()?.mediaLayerSupported
    }

    /** a hidden window rendering one media source at exactly width x height pixels, for MediaLayers */
    static createMediaWindow(width: number, height: number): BrowserWindow | null {
        if (!this.mediaLayersAvailable()) return null
        const renderBounds = OutputHelper.Bounds.getRenderBounds({ invisible: true }, { x: 0, y: 0, width, height })
        const options: BrowserWindowConstructorOptions = { ...outputOptions, ...renderBounds, show: false, skipTaskbar: true, alwaysOnTop: false, backgroundColor: "#000000" }
        options.webPreferences = { ...outputOptions.webPreferences, offscreen: { useSharedTexture: true } } as any
        this.avoidLinuxDisplaySizeShrink(options)
        const window = new BrowserWindow(options)
        window.setSkipTaskbar(true)
        window.webContents.setFrameRate(this.OSR_RENDER_FPS)
        // creation size is clamped to the display; setBounds afterwards is not
        const bounds = { x: 0, y: 0, width: renderBounds.width, height: renderBounds.height }
        window.setBounds(bounds)
        for (const delay of [10, 80]) setTimeout(() => !window.isDestroyed() && window.setBounds(bounds), delay)
        loadWindowContent(window, "media")
        return window
    }

    // tells the page whether it may hand its background video to a media layer
    private static enableMediaLayers(window: BrowserWindow) {
        window.webContents.ipc.on(STARTUP, (_event, msg) => {
            if (msg?.channel !== "READY" || window.isDestroyed()) return
            window.webContents.send(OUTPUT, { channel: "MEDIA_LAYER_ENABLED", data: this.mediaLayersAvailable() })
            if (process.env.FS_CAP_STATS) console.info(`[MEDIA] page ready, media layers ${this.mediaLayersAvailable() ? "enabled" : "unavailable"}`)
        })
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
    // the addon's readback pool size
    private static addonMaxPool = 0
    private static get ADDON_MAX_POOL(): number {
        if (this.addonMaxPool) return this.addonMaxPool
        const reported = Number(this.getOsrCaptureAddon()?.maxConcurrentReadbacks)
        // older addons don't report it; their pool is 16
        this.addonMaxPool = reported > 0 ? Math.floor(reported) : 16
        return this.addonMaxPool
    }
    private static globalInFlight = 0
    private static lastClampLogged = 0
    private static lastGateLogged = 0
    private static offMain = new Map<string, OffMainState>()

    // a presenting window needs frames at its display's refresh rate
    static presentFps(id: string): number {
        if (!OutputPresenter.isPresenting(id)) return 0
        const bounds = OutputHelper.getOutput(id)?.intendedBounds
        try {
            const display = bounds ? screen.getDisplayMatching(bounds) : screen.getPrimaryDisplay()
            if (display?.displayFrequency) return Math.round(display.displayFrequency)
        } catch {
            // no display information
        }
        return this.OSR_RENDER_FPS
    }

    // a previewed output renders at its configured rate even with no receiver connected
    static watchPreviewSubscribers() {
        PreviewStream.onSubscribersChanged = (outputId) => {
            CaptureHelper.updateRenderRate(RenderGroups.rendererOf(outputId))
            // a still page sends no frame until it paints
            if (PreviewStream.hasSubscribers(outputId)) OutputLifecycle.requestRepaint(outputId)
        }
    }

    static previewFps(id: string): number {
        return PreviewStream.hasSubscribers(id) ? CaptureHelper.configuredFramerate(id) : 0
    }

    private static rendererTargetFps(id: string): number {
        let fps = 0
        for (const m of RenderGroups.members(id)) {
            fps = Math.max(fps, this.presentFps(m), this.previewFps(m))
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
        let consume = Infinity
        let finish = Infinity
        let enqueue = Infinity
        let doneMain = Infinity
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

    // live input composited by the worker (osr-capture video layer) instead of drawn by the page
    // composited source per output; releasing: the page is taking the drawing back
    private static videoLayerWanted = new Map<string, string>()
    private static videoLayerReleasing = new Set<string>()
    private static videoLayerRunning = new Set<string>()
    private static videoLayerHooked = false

    // FS_VIDEO_LAYER=0 keeps live input drawn by the page
    static videoLayerDisabled = process.env.FS_VIDEO_LAYER === "0"

    private static pipelines = 0

    static requestVideoLayer(id: string, wanted: boolean, source: string, release = false) {
        if (this.videoLayerDisabled) return
        this.hookVideoLayer()
        const renderer = RenderGroups.rendererOf(id) || id
        const current = this.videoLayerWanted.get(renderer)
        // new source: restart the composite so no frame of the old one shows
        if (!wanted || (current !== undefined && current !== source)) {
            if (current === undefined) return
            this.videoLayerWanted.delete(renderer)
            this.videoLayerReleasing.delete(renderer)
            StreamReceiverHost.send("videoLayer", { outputId: renderer, active: false })
            this.setVideoLayerRunning(renderer, false)
            if (!wanted) return
        }
        if (current === source && release === this.videoLayerReleasing.has(renderer)) return
        this.videoLayerWanted.set(renderer, source)
        if (release) this.videoLayerReleasing.add(renderer)
        else this.videoLayerReleasing.delete(renderer)
        this.sendVideoLayer(renderer)
    }

    private static sendVideoLayer(id: string) {
        const source = this.videoLayerWanted.get(id)
        if (source === undefined) return
        // exclusive: the page is not sent frames while composited, unless releasing
        const exclusive = this.videoLayerRunning.has(id) && !this.videoLayerReleasing.has(id)
        StreamReceiverHost.send("videoLayer", { outputId: id, active: true, source, exclusive })
    }

    private static hookVideoLayer() {
        if (this.videoLayerHooked) return
        this.videoLayerHooked = true
        SenderCapture.videoLayerHandler = (msg) => {
            if (msg.type === "videoFrame") {
                // the page draws nothing, so a tick marks it dirty; one per frame paces capture to the source
                if (this.videoLayerRunning.has(msg.id)) OutputHelper.Send.sendToWindow(msg.id, { channel: "STREAM_TICK", data: { id: msg.id } })
            } else if (msg.type === "videoLayerActive") {
                this.setVideoLayerRunning(msg.id, msg.active !== false)
            }
        }
    }

    private static setVideoLayerRunning(id: string, running: boolean) {
        if (running === this.videoLayerRunning.has(id)) return
        if (running) this.videoLayerRunning.add(id)
        else this.videoLayerRunning.delete(id)
        this.sendVideoLayer(id)
        this.updateRenderBackground(id)
        // every member of the render group draws from this one page
        for (const m of RenderGroups.members(id)) OutputHelper.Send.sendToWindow(m, { channel: "STREAM_LAYER", data: { id: m, active: running } })
    }

    // transparent backdrop wherever the worker composites video under the page
    static updateRenderBackground(id: string) {
        const output = OutputHelper.getOutput(id)
        const win = OutputHelper.renderWindow(output)
        if (!win) return
        const videoUnder = this.videoLayerRunning.has(id) || MediaLayers.showsMedia(id) || !!(output as any)?.transparent
        win.setBackgroundColor(videoUnder ? "#00000000" : "#000000")
    }

    private static sharedPaintImpls = new Map<string, (event: any, image: Electron.NativeImage) => void>()
    private static onSharedTexturePaint(id: string, event: any, image: Electron.NativeImage) {
        this.sharedPaintImpls.get(id)?.(event, image)
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

    // dead when forced paints arrive in a sample window and none carries a texture; early frames often do
    private static readonly DEAD_CAPTURE_FRAMES = 90

    private static watchForDeadCapture(id: string, state: () => { textured: number; textureless: number }) {
        if (this.sharedTextureDemoted) return
        const deadline = this.getOsrTargetInterval(id) * this.DEAD_CAPTURE_FRAMES
        let lastTextured = 0
        let lastTextureless = 0
        let lastInvalidates = 0
        const timer = setInterval(() => {
            if (this.sharedTextureDemoted || !OutputHelper.getOutput(id)) {
                clearInterval(timer)
                return
            }
            const { textured, textureless } = state()
            const invalidates = this.osrInvalidatesTotal.get(id) || 0
            const texturedNow = textured - lastTextured
            const texturelessNow = textureless - lastTextureless
            const invalidatesNow = invalidates - lastInvalidates
            lastTextured = textured
            lastTextureless = textureless
            lastInvalidates = invalidates

            if (texturedNow > 0) return // it is delivering
            if (invalidatesNow === 0 || texturelessNow === 0) return // nothing was asked, or nothing painted

            clearInterval(timer)
            this.sharedTextureDemoted = true
            this.captureModeLogged = false
            console.warn(`[OSR] ${texturelessNow} paints for ${invalidatesNow} requested, none carrying a shared texture: rebuilding outputs on the CPU path`)
            this.rebuildAfterDemotion()
        }, deadline)
        timer.unref?.()
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
        // seq order only holds within one pipeline
        const pipe = ++OutputLifecycle.pipelines
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
        let sPaints = 0
        let sDropBudget = 0
        let sDropInterval = 0
        let sForward = 0
        let sDone = 0
        let sReadback = 0
        let sRttSum = 0
        let sRttCount = 0
        // pending frames released by the full-pipe park watchdog (expected under saturation)
        let sParkExpired = 0
        // paints arriving within 5ms of the previous one (the compositor delivering in clumps)
        let sBurstPaints = 0
        let lastPaintTime = 0
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
                let gapMean = 0
                let gapStd = 0
                let gapP95 = 0
                let gapBig = 0
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
        let parkedDropped = false
        let admitNextDue = 0
        let admitTimer: NodeJS.Timeout | null = null
        let mainRetryTimer: NodeJS.Timeout | null = null

        const forwardOffMain = (rec: { tex: any; source: any; width: number; height: number }) => {
            const { tex, source, width, height } = rec
            const output = OutputHelper.getOutput(id)
            // fastest active consumer rate, not just NDI's
            const capOpts = output?.captureOptions
            const framerate = capOpts ? CaptureHelper.getMaxActiveFramerate(capOpts.framerates || {}, capOpts.options || {}) : 1
            const ratio = height ? width / height : 16 / 9
            const transparent = output?.transparent === true
            // one readback for every member, whatever protocol each sends on
            const members = OutputLifecycle.groupMembers(id)
            // this output started showing another page after the frame was admitted
            if (!members.length) {
                releaseTex(tex)
                return
            }
            // each member is paced by the rate of the protocol it sends on
            const memberFramerates: { [m: string]: number } = {}
            for (const m of members) {
                const rates = OutputHelper.getOutput(m)?.captureOptions?.framerates
                memberFramerates[m] = (OmtSender.OMT[m]?.sender ? rates?.omt : rates?.ndi) || framerate
            }
            const groupInfo = CaptureHelper.Transmitter.groupOffMainInfo(members)
            const mixed = !!groupInfo && groupInfo.eligible && groupInfo.needsScaled && typeof addon.readbackConsume === "function"
            const scaled = mixed ? CaptureHelper.Transmitter.getScaledTarget({ width, height }, members) : null
            // full-size members in the main format use the main readback; others get their own target
            const memberSize = (m: string) => {
                const o = OutputHelper.getOutput(m)
                const s = o?.sendSize || o?.intendedBounds
                return s?.width && s?.height ? { width: s.width, height: s.height } : { width, height }
            }
            const memberFormat = (m: string) => (OutputHelper.getOutput(m)?.transparent === true ? 2 : 1)
            const fmt = memberFormat(id)
            const targets: { width: number; height: number; format: number }[] = []
            const memberTarget: { [m: string]: number } = {}
            const memberFormats: { [m: string]: number } = {}
            const memberSizes: { [m: string]: { width: number; height: number } } = {}
            for (const m of members) {
                const sz = memberSize(m)
                const f = memberFormat(m)
                memberFormats[m] = f
                memberSizes[m] = sz
                if (sz.width === width && sz.height === height && f === fmt) {
                    memberTarget[m] = -1
                    continue
                }
                let idx = targets.findIndex((t) => t.width === sz.width && t.height === sz.height && t.format === f)
                if (idx < 0) idx = targets.push({ width: sz.width, height: sz.height, format: f }) - 1
                memberTarget[m] = idx
            }
            // members streaming RTMP: the worker feeds ffmpeg a BGRA frame at exactly the broadcast size
            const rtmpMembers: { [m: string]: { width: number; height: number } } = {}
            for (const m of members) {
                const cfg = RtmpBridge.runningConfig(m)
                if (!cfg) continue
                rtmpMembers[m] = { width: cfg.width, height: cfg.height }
                if (!targets.some((t) => t.width === cfg.width && t.height === cfg.height && t.format === 4)) targets.push({ width: cfg.width, height: cfg.height, format: 4 })
            }
            // members on a Blackmagic device: a frame at the card's mode, UYVY when the card takes it raw
            const bmdMembers: { [m: string]: { width: number; height: number; format: number; framerate: number } } = {}
            for (const m of members) {
                if (!BlackmagicSender.isReady(m)) continue
                const bfr = OutputHelper.getOutput(m)?.captureOptions?.framerates?.blackmagic
                if (!bfr) continue
                const sz = BlackmagicSender.getTargetDimensions(m)
                // card's pixel format from the GPU when supported; else BGRA, converted on the CPU
                const f = addon.cardFormats ? BlackmagicSender.cardFormat(m) : 0
                bmdMembers[m] = { width: sz.width, height: sz.height, format: f, framerate: bfr }
                if (!(sz.width === width && sz.height === height && f === fmt) && !targets.some((t) => t.width === sz.width && t.height === sz.height && t.format === f)) targets.push({ width: sz.width, height: sz.height, format: f })
            }
            // members streaming WebRTC: the host window draws a BGRA frame at the output's size
            const webrtcMembers: { [m: string]: { width: number; height: number } } = {}
            if (WebRtcHost.isRunning()) {
                for (const m of members) {
                    if (!OutputHelper.getOutput(m)?.webrtcData?.streaming) continue
                    const sz = memberSizes[m] || { width, height }
                    webrtcMembers[m] = sz
                    if (!targets.some((t) => t.width === sz.width && t.height === sz.height && t.format === 0)) targets.push({ width: sz.width, height: sz.height, format: 0 })
                }
            }
            // members whose on-screen window draws this capture instead of rendering the content again
            const presentMembers: { [m: string]: { width: number; height: number } } = {}
            for (const m of members) {
                if (!OutputPresenter.isPresenting(m)) continue
                const sz = memberSizes[m] || { width, height }
                presentMembers[m] = sz
                if (!targets.some((t) => t.width === sz.width && t.height === sz.height && t.format === 0)) targets.push({ width: sz.width, height: sz.height, format: 0 })
            }
            // FS_CONVERT_CHECK: also read back BGRA so the worker can check GPU format kernels against its CPU conversion
            const convertCheck = !!process.env.FS_CONVERT_CHECK
            if (convertCheck) {
                // every packed format, to exercise all kernels
                for (const f of [0, 1, 2, 4, ...(addon.cardFormats ? [5, 6, 7, 8] : [])]) {
                    if (!targets.some((t) => t.width === width && t.height === height && t.format === f)) targets.push({ width, height, format: f })
                }
            }
            // stage clients get a GPU target at their size, in the encoder's channel order
            const stageReq = CaptureHelper.Transmitter.stageStreamRequest()
            let stageStream: { width: number; height: number; quality: number; intervalMs: number } | null = null
            if (stageReq && width && height) {
                const sw = Math.min(stageReq.width, width)
                const sh = Math.max(1, Math.round((height * sw) / width))
                if (!targets.some((t) => t.width === sw && t.height === sh && t.format === 3)) targets.push({ width: sw, height: sh, format: 3 })
                stageStream = { width: sw, height: sh, quality: stageReq.quality, intervalMs: stageReq.intervalMs }
            }
            // OutputShow clients take raw RGBA, which the GPU produces directly
            const serverReq = CaptureHelper.Transmitter.serverStreamRequest(id)
            let serverStream: { width: number; height: number; intervalMs: number } | null = null
            if (serverReq && width && height) {
                const vw = Math.min(serverReq.width, width)
                const vh = Math.max(1, Math.round((height * vw) / width))
                if (!targets.some((t) => t.width === vw && t.height === vh && t.format === 3)) targets.push({ width: vw, height: vh, format: 3 })
                serverStream = { width: vw, height: vh, intervalMs: serverReq.intervalMs }
            }
            const thumbReq = CaptureHelper.Transmitter.thumbRequest(id)
            let thumbStream: { width: number; height: number; quality: number } | null = null
            if (thumbReq && width && height) {
                const tw = Math.min(thumbReq.width, width)
                const th = Math.max(1, Math.round((height * tw) / width))
                if (!targets.some((t) => t.width === tw && t.height === th && t.format === 3)) targets.push({ width: tw, height: th, format: 3 })
                thumbStream = { width: tw, height: th, quality: thumbReq.quality }
            }
            const cpuTargets = targets.length > 0 && !addon.targetsSupported
            const seq = ++offMainSeq
            const captureOpts = { pipe, size: { width, height }, ratio, framerate: memberFramerates[id] || framerate, memberFramerates, format: cpuTargets ? 0 : fmt, mainFormat: fmt, convertCheck, transparent, dstW: scaled?.dstW || 0, dstH: scaled?.dstH || 0, seq, members, depth: OutputLifecycle.depthFor(id), targets, memberTarget, memberFormats, memberSizes, cpuTargets, stageStream, serverStream, thumbStream, rtmpMembers, bmdMembers, webrtcMembers, presentMembers }
            const anySender = members.some((m) => !!NdiSender.NDI[m]?.sender || !!OmtSender.OMT[m]?.sender)
            if (SenderCapture.captureFrame(id, source, captureOpts, anySender)) {
                forwardAt.set(seq, { t: Date.now(), unc: OutputLifecycle.globalInFlight === 0, px: width * height })
                OutputLifecycle.globalInFlight++
                offMainInFlight++
                heldTextures.set(seq, tex)
                for (const m of members) OutputLifecycle.noteOffMain(m)
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
                            parkedDropped = true
                            return
                        }
                        tryAdmit()
                    }, OutputLifecycle.getOsrTargetInterval(id))
                }
                return
            }
            const rec = pendingFrame
            pendingFrame = null
            parkedDropped = false
            if (admitTimer) {
                clearTimeout(admitTimer)
                admitTimer = null
            }
            if (mainRetryTimer) {
                clearTimeout(mainRetryTimer)
                mainRetryTimer = null
            }
            const interval = OutputLifecycle.getOsrTargetInterval(id)
            admitNextDue += interval
            if (admitNextDue < now) admitNextDue = now + interval
            forwardOffMain(rec)
        }

        // the worker signals releaseTexture as soon as the GPU has consumed the shared texture (well before
        // the slow read finishes), so Electron's frame pool isn't starved -> keeps the main process responsive
        SenderCapture.releaseTextureCallbacks[id] = releaseHeldSeq
        // captureDone = the whole capture (incl. the slow read) is finished -> a pipeline slot frees up.
        // The forwardAt ledger dedupes: in-flight counters only move for a seq this map still tracks.
        SenderCapture.captureDoneCallbacks[id] = (seq, tl) => {
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
                if (pendingFrame) {
                    tryAdmit()
                } else if (parkedDropped) {
                    parkedDropped = false
                    OutputLifecycle.requestRepaint(id)
                }
            }
            if (STATS) {
                sDone++
                if (lastDoneTime) sGaps.push(now - lastDoneTime)
                lastDoneTime = now
            }
        }

        let cpuFallback = false
        let lastCpuImage: Electron.NativeImage | null = null

        NdiSender.startMainDiag()
        window.webContents.on("paint", (event: any, _dirty: unknown, image: Electron.NativeImage) => {
            const tPaint = STATS ? performance.now() : 0
            try {
                OutputLifecycle.onSharedTexturePaint(id, event, image)
            } finally {
                if (tPaint) {
                    const dt = performance.now() - tPaint
                    NdiSender.mainDiag.paintMs += dt
                    NdiSender.mainDiag.paintN++
                    if (dt > NdiSender.mainDiag.paintMax) NdiSender.mainDiag.paintMax = dt
                }
            }
        })
        let texturedPaints = 0
        let texturelessPaints = 0
        const onPaintImpl = (event: any, image: Electron.NativeImage) => {
            OutputLifecycle.noteOsrPaint(id)
            const tex = event?.texture
            const info = tex?.textureInfo
            if (!info) {
                texturelessPaints++
                if (image && !image.isEmpty()) {
                    if (!cpuFallback) {
                        cpuFallback = true
                        console.warn(`[OSR ${id}] paint carries no GPU shared texture — falling back to CPU capture`)
                        ruleViolation("fallback", "paint without a shared texture")
                    }
                    lastCpuImage = image
                }
                return
            }
            // texture is back: drop the CPU frame and re-arm the warning
            if (cpuFallback) {
                cpuFallback = false
                lastCpuImage = null
                console.info(`[OSR ${id}] GPU shared texture restored`)
            }
            if (STATS) {
                sPaints++
                const nowP = Date.now()
                if (lastPaintTime && nowP - lastPaintTime < 5) sBurstPaints++
                lastPaintTime = nowP
            }

            texturedPaints++
            const width = info.codedSize.width
            const height = info.codedSize.height
            const handle = this.getTextureHandle(info)
            const requestedFormat = CaptureHelper.Transmitter.getReadbackFormat(id, { width, height })

            // an output showing another page keeps its own page current but never reads it
            if (RenderGroups.isFollower(id)) {
                releaseTex(tex)
                if (pendingFrame) {
                    releaseTex(pendingFrame.tex)
                    pendingFrame = null
                }
                parkedDropped = false
                return
            }

            const members = OutputLifecycle.groupMembers(id)
            const offMainIds = members.filter((m) => !!NdiSender.NDI[m]?.sender || !!OmtSender.OMT[m]?.sender || !!RtmpBridge.runningConfig(m) || BlackmagicSender.isReady(m) || (WebRtcHost.isRunning() && !!OutputHelper.getOutput(m)?.webrtcData?.streaming))
            // no sender, but a downscaled consumer (web server, stage, preview) still goes off main
            const groupInfo = CaptureHelper.Transmitter.groupOffMainInfo(offMainIds.length ? offMainIds : members)
            // a presenting member is a consumer too: its window has nothing to show without this frame
            const anyPresenting = members.some((m) => OutputPresenter.isPresenting(m))
            const canOffMain = groupInfo.eligible && (offMainIds.length > 0 || groupInfo.needsScaled || anyPresenting)
            if (canOffMain) {
                // the worker owns delivery now; anything main still holds would be re-sent stale beside it
                lastRaw = null
                lastCpuImage = null
                OutputLifecycle.noteFrameSize(id, width * height)
                if (pendingFrame) {
                    if (STATS) sDropInterval++
                    releaseTex(pendingFrame.tex)
                }
                parkedDropped = false
                pendingFrame = { tex, source: handle, width, height }
                tryAdmit()
                return
            }

            if (inFlight >= this.OSR_MAX_INFLIGHT_READBACKS || Date.now() - lastReadback < this.getOsrSendInterval(id)) {
                releaseTex(tex)
                if (!mainRetryTimer) {
                    const delay = Math.max(1, this.getOsrSendInterval(id) - (Date.now() - lastReadback))
                    mainRetryTimer = setTimeout(() => {
                        mainRetryTimer = null
                        OutputLifecycle.requestRepaint(id)
                    }, delay)
                }
                return
            }
            if (mainRetryTimer) {
                clearTimeout(mainRetryTimer)
                mainRetryTimer = null
            }
            inFlight++
            lastReadback = Date.now()
            if (STATS) sReadback++
            const seq = ++dispatchSeq
            // the readback lands in the main process on this path
            ruleViolation("main-frame", "readback into main")
            addon
                .readback(handle, width, height, requestedFormat, id)
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
        }
        OutputLifecycle.sharedPaintImpls.set(id, onPaintImpl)
        OutputLifecycle.watchForDeadCapture(id, () => ({ textured: texturedPaints, textureless: texturelessPaints }))

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
            if (mainRetryTimer) {
                clearTimeout(mainRetryTimer)
                mainRetryTimer = null
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
            delete SenderCapture.captureDoneCallbacks[id]
            OutputLifecycle.sharedPaintImpls.delete(id)
            delete SenderCapture.releaseTextureCallbacks[id]
            heldTextures.forEach((t) => releaseTex(t))
            heldTextures.clear()
            if (OutputLifecycle.osrTextureCleanup[id] === teardown) delete OutputLifecycle.osrTextureCleanup[id]
        }
        OutputLifecycle.osrTextureCleanup[id] = teardown
        window.on("closed", teardown)
    }

    static getTextureHandle(info: any) {
        if (!info?.handle) return null

        switch (process.platform) {
            case "win32":
                // Windows: NT Handle (D3D11/D3D12) with fallback to dxgiHandle
                return info.handle.ntHandle ?? info.handle.dxgiHandle ?? info.handle.handle

            case "darwin":
                // macOS: IOSurface handle ID / Mach port
                return info.handle.ioSurface

            case "linux":
                // Linux: DMA-BUF file descriptor (modern DRM/GBM) or NativePixmap (X11)
                return info.handle.dmaBuf ?? info.handle.nativePixmap

            default:
                return null
        }
    }

    // CPU fallback path: the paint event delivers a NativeImage directly.
    private static attachOsrCpu(window: BrowserWindow, id: string) {
        let lastImage: Electron.NativeImage | null = null
        let paints = 0
        let empty = 0
        let emitted = 0
        window.webContents.on("paint", (_e: unknown, _dirty: unknown, image: Electron.NativeImage) => {
            OutputLifecycle.noteOsrPaint(id) // linux begin-frame drive yields to natural paints
            paints++
            if (!image || image.isEmpty()) {
                empty++
                return
            }
            lastImage = image
        })
        this.startOsrSendTimer(window, id, () => {
            if (!lastImage) return
            emitted++
            CaptureHelper.Transmitter.transmitFrame(id, lastImage)
        })
        if (!process.env.FS_CAP_STATS) return
        const statsTimer = setInterval(() => {
            console.info(`[CPU-STATS ${id}] paints=${paints} empty=${empty} emitted=${emitted} invalidates=${OutputLifecycle.readOsrInvalidatesIssued(id)} haveFrame=${lastImage ? "yes" : "NO"}`)
            paints = empty = emitted = 0
        }, 1000)
        window.on("closed", () => clearInterval(statsTimer))
    }

    // emit the latest frame at the output's configured framerate, decoupling the send rate from the
    // content-change rate (static content still holds a constant rate on the wire)
    private static startOsrSendTimer(window: BrowserWindow, id: string, emit: () => void) {
        let sendTimer: NodeJS.Timeout
        const tick = () => {
            // nothing to send while the worker owns delivery
            // transmitFrame no-ops until the output's capture channels are set up, and throttles each consumer
            if (!window.isDestroyed() && !OutputLifecycle.isOffMainActive(id)) emit()
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

        // followers move at once; the remaining class shrinks to its new largest size
        const classmates = RenderGroups.isRegistered(id) ? RenderGroups.classMembers(id).filter((m) => m !== id) : []
        RenderGroups.remove(id)
        if (classmates.length && !this.closingAllOutputs) this.fitClass(classmates[0])

        OutputPresenter.stop(id)
        MediaLayers.removeOutput(id)
        CaptureHelper.Lifecycle.stopCapture(id)
        NdiSender.stopSenderNDI(id)
        OmtSender.stopSenderOMT(id)
        BlackmagicSender.stop(id)

        // free the addon's reused readback buffers for this output (no-op if the addon/pool isn't present)
        try {
            this.osrCaptureAddon?.releasePool?.(id)
        } catch {
            // ignore
        }
        this.releaseOsrCaptureTextures(id)

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
