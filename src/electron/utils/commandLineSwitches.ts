// Chromium command-line switches. Must be applied before app "ready" (switches precede the GPU
// process launch), so this runs from the top of the electron entry point.

import { app } from "electron"
import { config } from "../data/store"

// Chromium treats a repeated --enable-features switch as a replacement, not a union, so every block
// that enables features must go through this helper (merges with any value already on the command line)
function appendEnableFeatures(features: string) {
    const existing = app.commandLine.getSwitchValue("enable-features")
    const merged = [...new Set([...existing.split(","), ...features.split(",")].filter(Boolean))].join(",")
    app.commandLine.appendSwitch("enable-features", merged)
}

export function applyCommandLineSwitches() {
    // Chromium may suspend MUTED media in hidden pages — the offscreen capture windows are exactly that
    // (hidden documents playing muted video), so disable the suspend preventively on all platforms
    // (same switch OBS uses for its offscreen browser sources).
    app.commandLine.appendSwitch("disable-background-media-suspend")

    if (process.platform === "linux") applyLinuxSwitches()
}

function applyLinuxSwitches() {
    // Offscreen windows on Linux can lack a begin-frame/vsync source entirely (the compositor never
    // ticks and paint events stop), so remove the vsync/frame-rate/occlusion/backgrounding throttles.
    // Linux-only: Windows/mac paint correctly and must not be unthrottled process-wide.
    // Do NOT add `run-all-compositor-stages-before-draw` (a testing flag that runs the compositor
    // synchronously process-wide — tanks the whole app on real GPUs) or any --use-gl/--use-angle
    // forcing (parses to gl=none on Electron 37 and kills the GPU process).
    app.commandLine.appendSwitch("disable-gpu-vsync")
    app.commandLine.appendSwitch("disable-frame-rate-limit")
    app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion")
    app.commandLine.appendSwitch("disable-renderer-backgrounding")
    app.commandLine.appendSwitch("disable-background-timer-throttling")
    app.commandLine.appendSwitch("disable-backgrounding-occluded-windows")

    // VA-API hardware video decode/encode, default ON when hardware acceleration is enabled.
    // Chromium ships desktop-Linux VA-API decode off by default, which forces <video> onto software
    // decode (4K60 H.264 alone costs ~3 CPU cores and starves preview/capture/NDI downstream).
    // VaapiIgnoreDriverChecks skips the VA driver allow-list so unknown drivers still get a chance.
    // FS_LINUX_VAAPI=0 disables (debug); =zero additionally enables the zero-copy GL import.
    const linuxVaapi = process.env.FS_LINUX_VAAPI
    if (linuxVaapi !== "0" && config.get("disableHardwareAcceleration") !== true) {
        let vaapiFeatures = "AcceleratedVideoDecodeLinuxGL,AcceleratedVideoEncoder,VaapiIgnoreDriverChecks"
        if (linuxVaapi === "zero") vaapiFeatures += ",AcceleratedVideoDecodeLinuxZeroCopyGL"
        appendEnableFeatures(vaapiFeatures)
        console.info(`[LINUX] VA-API hardware video decode enabled by default (--enable-features=${app.commandLine.getSwitchValue("enable-features")}; set FS_LINUX_VAAPI=0 to disable)`)
    } else if (linuxVaapi === "0") {
        console.info("[LINUX] FS_LINUX_VAAPI=0: VA-API hardware video decode DISABLED (debug kill-switch)")
    }

    // opt-in diagnostic: when VA-API decode silently falls back to software, Chromium's vmodule logs
    // name the exact decline reason — this routes them to stderr
    if (process.env.FS_LINUX_MEDIA_LOG === "1") {
        app.commandLine.appendSwitch("enable-logging", "stderr")
        app.commandLine.appendSwitch("vmodule", "*vaapi*=2,*video_decoder*=2")
        console.info("[LINUX] FS_LINUX_MEDIA_LOG=1: Chromium media logging to stderr (--enable-logging=stderr --vmodule=*vaapi*=2,*video_decoder*=2)")
    }
}
