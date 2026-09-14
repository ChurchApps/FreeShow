// Chromium command-line switches applied before app "ready"
import { app } from "electron"
import { config } from "../data/store"

function appendEnableFeatures(features: string) {
    const existing = app.commandLine.getSwitchValue("enable-features")
    const merged = [...new Set([...existing.split(","), ...features.split(",")].filter(Boolean))].join(",")
    app.commandLine.appendSwitch("enable-features", merged)
}

export function applyCommandLineSwitches() {
    // Prevent Chromium from suspending muted background media in offscreen capture windows
    app.commandLine.appendSwitch("disable-background-media-suspend")

    if (process.platform === "linux") applyLinuxSwitches()
}

function applyLinuxSwitches() {
    // Offscreen windows on Linux need throttling disabled so paint events keep arriving
    app.commandLine.appendSwitch("disable-gpu-vsync")
    app.commandLine.appendSwitch("disable-frame-rate-limit")
    app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion")
    app.commandLine.appendSwitch("disable-renderer-backgrounding")
    app.commandLine.appendSwitch("disable-background-timer-throttling")
    app.commandLine.appendSwitch("disable-backgrounding-occluded-windows")

    // VA-API hardware video decode/encode
    const linuxVaapi = process.env.FS_LINUX_VAAPI
    if (linuxVaapi !== "0" && config.get("disableHardwareAcceleration") !== true) {
        let vaapiFeatures = "AcceleratedVideoDecodeLinuxGL,AcceleratedVideoEncoder,VaapiIgnoreDriverChecks"
        if (linuxVaapi === "zero") vaapiFeatures += ",AcceleratedVideoDecodeLinuxZeroCopyGL"
        appendEnableFeatures(vaapiFeatures)
        console.info(`[LINUX] VA-API hardware video decode enabled by default (--enable-features=${app.commandLine.getSwitchValue("enable-features")})`)
    } else if (linuxVaapi === "0") {
        console.info("[LINUX] FS_LINUX_VAAPI=0: VA-API hardware video decode DISABLED")
    }

    if (process.env.FS_LINUX_MEDIA_LOG === "1") {
        app.commandLine.appendSwitch("enable-logging", "stderr")
        app.commandLine.appendSwitch("vmodule", "*vaapi*=2,*video_decoder*=2")
    }
}
