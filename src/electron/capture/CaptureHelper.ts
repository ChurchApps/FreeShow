import type { BrowserWindow, NativeImage, Size } from "electron"
import electron from "electron"
import { NdiSender } from "../ndi/NdiSender"
import { OmtSender } from "../omt/OmtSender"
import { ruleViolation } from "../utils/ruleCheck"
import { OutputHelper } from "../output/OutputHelper"
import { RenderGroups } from "../output/helpers/RenderGroups"
import type { CaptureOptions } from "./CaptureOptions"
import { CaptureLifecycle } from "./helpers/CaptureLifecycle"
import { CaptureTransmitter } from "./helpers/CaptureTransmitter"

export class CaptureHelper {
    static Lifecycle = CaptureLifecycle
    static Transmitter = CaptureTransmitter

    private static framerates: { [key: string]: number } = {
        stage: 20, // StageShow
        server: 30, // OutputShow; the socket's ack gate is the real limiter
        webrtc: 30, // WebRTC (canvas stream, up to 30 fps)
        rtmp: 30, // RTMP
        recorder: 30, // Output recording
        unconnected: 1,
        connected: 30 // NDI
    }
    static customFramerates: { [key: string]: { [key: string]: number } } = {}

    // the highest rate the frame-rate setting in Outputs.svelte offers
    static readonly MAX_CONFIGURABLE_FPS = 60

    // The rate this output is SET to, ignoring whether anything is connected to it. The per-channel
    // framerates drop to `unconnected` when a receiver goes away, which is the gate; this is what the
    // output runs at for a consumer that is watching regardless, such as a preview.
    static configuredFramerate(id: string): number {
        const custom = this.customFramerates[id]
        const configured = Number(custom?.ndi || custom?.omt || custom?.blackmagic || 0)
        return configured > 0 ? configured : this.framerates.connected
    }



    // the rate each consumer starts at, so callers never restate one as a literal
    static defaultFramerates(): { [key: string]: number } {
        return {
            ndi: this.framerates.connected,
            omt: this.framerates.connected,
            blackmagic: this.framerates.unconnected,
            server: this.framerates.server,
            stage: this.framerates.stage,
            webrtc: this.framerates.webrtc,
            rtmp: this.framerates.rtmp,
            recorder: this.framerates.recorder
        }
    }

    static getDefaultCapture(window: BrowserWindow, id: string): CaptureOptions {
        const defaultFramerates = this.defaultFramerates()

        return {
            window,
            frameSubscription: null,
            options: { ndi: false, omt: false, blackmagic: false, server: false, stage: false, webrtc: false, rtmp: false, recorder: false },
            framerates: defaultFramerates,
            id
        }
    }

    // START

    static storedFrames: { [key: string]: NativeImage } = {}

    static getMaxActiveFramerate(framerates: { [key: string]: number }, activeOptions: { [key: string]: boolean }): number {
        const activeRates: number[] = []
        if (activeOptions.ndi) activeRates.push(framerates.ndi || 1)
        if (activeOptions.omt) activeRates.push(framerates.omt || 1)
        if (activeOptions.blackmagic) activeRates.push(framerates.blackmagic || 1)
        if (activeOptions.server) activeRates.push(framerates.server || 1)
        if (activeOptions.stage) activeRates.push(framerates.stage || 1)
        if (activeOptions.webrtc) activeRates.push(framerates.webrtc || 1)
        if (activeOptions.rtmp) activeRates.push(framerates.rtmp || 1)
        if (activeOptions.recorder) activeRates.push(framerates.recorder || 30)
        return activeRates.length > 0 ? Math.max(...activeRates) : 1
    }

    static updateFramerate(id: string) {
        const output = OutputHelper.getOutput(id)
        const captureOptions = output?.captureOptions
        if (!captureOptions) return

        if (NdiSender.NDI[id]) {
            let ndiFramerate = this.framerates.unconnected
            if (NdiSender.NDI[id].status === "connected") ndiFramerate = this.customFramerates[id]?.ndi || this.framerates.connected

            if (captureOptions.framerates.ndi !== parseInt(ndiFramerate.toString(), 10)) {
                output.captureOptions!.framerates.ndi = parseInt(ndiFramerate.toString(), 10)
                OutputHelper.setOutput(id, output)
                CaptureTransmitter.startChannel(id, "ndi")
            }
        }

        if (OmtSender.OMT[id]) {
            let omtFramerate = this.framerates.unconnected
            if (OmtSender.OMT[id].status === "connected") omtFramerate = this.customFramerates[id]?.omt || this.framerates.connected

            if (captureOptions.framerates.omt !== parseInt(omtFramerate.toString(), 10)) {
                output.captureOptions!.framerates.omt = parseInt(omtFramerate.toString(), 10)
                OutputHelper.setOutput(id, output)
                CaptureTransmitter.startChannel(id, "omt")
            }
        }

        // GPU budget: rendering several 4K OSR surfaces at 60fps saturates the GPU and balloons every
        // readback (~20ms -> ~100ms) -> the received output only gets a few NEW frames/sec. So render each OSR
        // output at the rate it actually needs: full rate when a receiver is connected, a low rate when not.
        // Reacts within CONNECTION_POLL_INTERVAL_MS (250ms), so a connecting output ramps to 60 quickly.
        // The OSR window's render rate is owned by the group RENDERER. A follower must never set it (its window
        // is the renderer's), and the renderer renders at the MAX rate ANY member needs — so one member with a
        // connected 60fps receiver keeps the shared render at 60 even if others are idle.
        this.updateRenderRate(RenderGroups.rendererOf(id))
    }

    static updateRenderRate(rendererId: string) {
        const output = OutputHelper.getOutput(rendererId)
        const win = OutputHelper.renderWindow(output)
        if (!(output as any)?.osr || (output as any)?.follower || (output as any)?.presenter || !win || win.isDestroyed()) return

        let fps = 0
        for (const m of RenderGroups.members(rendererId)) {
            fps = Math.max(fps, OutputHelper.Lifecycle.presentFps(m), OutputHelper.Lifecycle.previewFps(m))
            const mo = OutputHelper.getOutput(m)
            if (mo?.captureOptions) fps = Math.max(fps, this.getMaxActiveFramerate(mo.captureOptions.framerates || {}, mo.captureOptions.options || {}))
        }
        // render at the rate the fastest member needs; anything faster is discarded at admission
        const target = Math.min(OutputHelper.Lifecycle.OSR_RENDER_FPS, Math.max(1, Math.round(fps || 1)))
        try {
            win.webContents.setFrameRate(target)
        } catch {
            // ignore
        }
        // Linux begin-frame drive (no-op elsewhere): keep its cadence in lockstep with the applied rate
        OutputHelper.Lifecycle.updateOsrPaintDrive(win, rendererId, target)
    }

    static getWindowScreen(window: BrowserWindow) {
        return electron.screen.getDisplayMatching({
            x: window.getBounds().x,
            y: window.getBounds().y,
            width: window.getBounds().width,
            height: window.getBounds().height
        })
    }

    // Fallback only: an output nothing is capturing has no worker frame a thumbnail could come from.
    static async captureBase64Frame(window: BrowserWindow) {
        ruleViolation("main-frame", "controller thumbnail capturePage")
        return (await window.capturePage()).toDataURL({ scaleFactor: 0.5 })
    }

    static resizeImage(image: NativeImage, initialSize: Size, newSize: Size) {
        if (initialSize.width / initialSize.height >= newSize.width / newSize.height) image = image.resize({ width: newSize.width })
        else image = image.resize({ height: newSize.height })

        return image
    }
}
