import type { BrowserWindow, Display, NativeImage, Size } from "electron"
import electron from "electron"
import { NdiSender } from "../ndi/NdiSender"
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
        server: 10, // 30 // OutputShow
        webrtc: 30, // WebRTC (canvas stream, up to 30 fps)
        rtmp: 30, // RTMP
        unconnected: 1,
        connected: 30 // NDI
    }
    static customFramerates: { [key: string]: { [key: string]: number } } = {}

    static getDefaultCapture(window: BrowserWindow, id: string): CaptureOptions {
        const screen: Display = this.getWindowScreen(window)

        const defaultFramerates = {
            ndi: this.framerates.connected,
            blackmagic: this.framerates.unconnected,
            server: this.framerates.server,
            stage: this.framerates.stage,
            webrtc: this.framerates.webrtc,
            rtmp: this.framerates.rtmp
        }

        return {
            window,
            frameSubscription: null,
            displayFrequency: screen.displayFrequency || 60,
            options: { ndi: false, blackmagic: false, server: false, stage: false, webrtc: false, rtmp: false },
            framerates: defaultFramerates,
            id
        }
    }

    // START

    static storedFrames: { [key: string]: NativeImage } = {}

    static getMaxActiveFramerate(framerates: { [key: string]: number }, activeOptions: { [key: string]: boolean }): number {
        const activeRates: number[] = []
        if (activeOptions.ndi) activeRates.push(framerates.ndi || 1)
        if (activeOptions.blackmagic) activeRates.push(framerates.blackmagic || 1)
        if (activeOptions.server) activeRates.push(framerates.server || 1)
        if (activeOptions.stage) activeRates.push(framerates.stage || 1)
        if (activeOptions.webrtc) activeRates.push(framerates.webrtc || 1)
        if (activeOptions.rtmp) activeRates.push(framerates.rtmp || 1)
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
        const win = (output as any)?.window as BrowserWindow | undefined
        if (!(output as any)?.osr || (output as any)?.follower || !win || win.isDestroyed()) return

        let fps = 0
        for (const m of RenderGroups.members(rendererId)) {
            const mo = OutputHelper.getOutput(m)
            if (mo?.captureOptions) fps = Math.max(fps, this.getMaxActiveFramerate(mo.captureOptions.framerates || {}, mo.captureOptions.options || {}))
        }
        // REGRESSION FIX (READBACK_REWORK_PLAN §10): setFrameRate is NOT a decimator. Driving the OSR
        // compositor BELOW its native cadence (e.g. a 30fps NDI target with 60fps content) makes Chromium
        // deliver the throttled paints in CLUMPS (measured: 200-500ms pipe-idle, then 10-18-paint bursts;
        // one of two contending surfaces degraded to ~half its set rate) — which starved the capture
        // admission pipe and stuttered BOTH the in-app preview and the NDI output. So any renderer with a
        // real-time consumer renders at the NATIVE rate — exactly like the release, whose (non-OSR) windows
        // render at display cadence and are SAMPLED at the target rate by the capturePage timer — and each
        // consumer's configured framerate is enforced by even admission-time decimation
        // (OutputLifecycle.attachOsrSharedTexture tryAdmit / the send-interval throttle) + the worker's send
        // pacer. The sub-native setting survives ONLY as the idle floor (no connected receiver —
        // framerates.unconnected), where nobody sees the frames, evenness is moot, and the GPU saving is the
        // point of the throttle.
        const idle = fps <= this.framerates.unconnected
        const target = idle ? Math.max(1, Math.round(fps || 1)) : OutputHelper.Lifecycle.OSR_RENDER_FPS
        try {
            win.webContents.setFrameRate(target)
        } catch {
            // ignore
        }
        // Linux begin-frame drive (no-op elsewhere): keep the invalidate cadence in lockstep with the rate
        // just applied — configured intent (native rate with a live consumer, derived idle floor otherwise).
        // See the LINUX NOTE above OutputLifecycle.attachOsrCapture.
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

    static async captureBase64Frame(window: BrowserWindow) {
        return (await window.capturePage()).toDataURL({ scaleFactor: 0.5 })
    }

    static resizeImage(image: NativeImage, initialSize: Size, newSize: Size) {
        if (initialSize.width / initialSize.height >= newSize.width / newSize.height) image = image.resize({ width: newSize.width })
        else image = image.resize({ height: newSize.height })

        return image
    }
}
