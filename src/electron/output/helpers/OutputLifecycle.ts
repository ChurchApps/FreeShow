import { BrowserWindow, screen, type BrowserWindowConstructorOptions } from "electron"
import { OUTPUT_CONSOLE, getMainWindow, isMac, loadWindowContent, toApp } from "../.."
import { config } from "../../data/store"
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

        const addon = this.getOsrCaptureAddon()
        if (addon) this.attachOsrSharedTexture(window, id, addon)
        else this.attachOsrCpu(window, id)
    }

    // Whether the user disabled hardware acceleration (Settings > Other). When true, app.disableHardwareAcceleration()
    // was called at startup, so there is no GPU compositor output to capture as a shared texture and no GPU
    // convert/downscale is possible — all capture/convert/downscale must run on the CPU.
    static isHardwareAccelerationDisabled(): boolean {
        try {
            return config.get("disableHardwareAcceleration") === true
        } catch {
            return false
        }
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

    // How many off-main captures may be in flight to the worker per output (pipelines the GPU consume of the
    // next frame over the slow readback of the previous). Default 2; env-tunable via FS_INFLIGHT.
    private static readonly OFF_MAIN_MAX_INFLIGHT = Math.max(1, parseInt(process.env.FS_INFLIGHT || "2", 10) || 2)

    // GPU shared-texture path (#16): read each paint texture back off the main thread and hand the RAW buffer
    // to the transmit pipeline (no createFromBitmap here — buffer-consumers take it directly, #20). On Windows
    // the addon can also GPU-convert straight to NDI/SDI's UYVY/UYVA during readback (getReadbackFormat).
    // Readbacks are throttled to the send rate and pipelined (up to OSR_MAX_INFLIGHT_READBACKS); every texture
    // is released so the compositor frame pool drains.
    private static attachOsrSharedTexture(window: BrowserWindow, id: string, addon: any) {
        let lastRaw: { buffer: Buffer; size: { width: number; height: number }; format: number } | null = null
        let inFlight = 0
        let lastReadback = 0
        // monotonic paint counter: readbacks can resolve out of order, so only the newest result wins
        let dispatchSeq = 0
        let appliedSeq = -1

        // OFF-MAIN state: up to effectiveInFlight() textures forwarded to the worker at once (PIPELINED), each
        // tracked by a monotonic seq so the GPU consume of the next frame overlaps the slow PCIe read of the
        // previous one. The worker uses a per-seq slotted osr-capture key so concurrent readbacks don't collide
        // on one pending/pool entry. Each texture is released on releaseTexture (GPU consumed) or captureDone.
        let offMainInFlight = 0
        let offMainSeq = 0
        let lastOffMain = 0
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
        // the worker signals releaseTexture as soon as the GPU has consumed the shared texture (well before
        // the slow read finishes), so Electron's frame pool isn't starved -> keeps the main process responsive
        NdiSender.releaseTextureCallbacks[id] = releaseHeldSeq
        // captureDone = the whole capture (incl. the slow read) is finished -> a pipeline slot frees up
        NdiSender.captureDoneCallbacks[id] = (seq: number) => {
            releaseHeldSeq(seq)
            offMainInFlight = Math.max(0, offMainInFlight - 1)
        }

        window.webContents.on("paint", (event: any) => {
            const tex = event?.texture
            const info = tex?.textureInfo
            if (!info) return

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
                // too many in flight / too soon since the last forward: drop this paint (release the texture)
                if (offMainInFlight >= this.OFF_MAIN_MAX_INFLIGHT || Date.now() - lastOffMain < this.getOsrSendInterval(id)) {
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
                if (NdiSender.captureFrameNDI(id, source, { size: { width, height }, ratio, framerate, format: fmt, transparent, dstW: scaled?.dstW || 0, dstH: scaled?.dstH || 0, seq, members })) {
                    offMainInFlight++
                    lastOffMain = Date.now()
                    heldTextures.set(seq, tex)
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
            const seq = ++dispatchSeq
            // pass the output id as the pool key so the addon reuses this output's buffers (avoids a per-frame
            // ~16MB alloc/copy on the main thread); the worker fills the pooled buffer off-thread
            addon
                .readback(source, width, height, requestedFormat, id)
                .then((buf: Buffer) => {
                    // drop a stale frame that resolved after a newer one already landed
                    if (seq < appliedSeq) return
                    appliedSeq = seq
                    // derive the ACTUAL format from the returned size (robust if the addon predates GPU
                    // convert and returned BGRA): bgra = w*4*h, uyva = w*3*h, uyvy = w*2*h
                    const px = width * height
                    let format = 0
                    if (buf.length === px * 2) format = 1
                    else if (buf.length === px * 3) format = 2
                    lastRaw = { buffer: buf, size: { width, height }, format }
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

        window.on("closed", () => {
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
        })
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
