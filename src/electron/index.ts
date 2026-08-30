// ----- FreeShow -----
// This is the electron entry point

import type { Rectangle } from "electron"
import { BrowserWindow, Menu, app, ipcMain, powerSaveBlocker, protocol, screen } from "electron"
import { AUDIO, BLACKMAGIC, CLOUD, EXPORT, MAIN, NDI, OUTPUT, STARTUP } from "../types/Channels"
import { Main } from "../types/IPC/Main"
import { ToMain } from "../types/IPC/ToMain"
import type { Dictionary } from "../types/Settings"
import { receiveAudio } from "./audio/receiveAudio"
import { receiveBM } from "./blackmagic/bmdTalk"
import { cloudConnect } from "./cloud/cloud"
import { startExport } from "./data/export"
import { cleanupProtectedCache, registerProtectedProtocol } from "./data/protected"
import { config, setupStores } from "./data/store"
import { receiveMain, sendMain, sendToMain } from "./IPC/main"
import { autoErrorReport } from "./IPC/responsesMain"
import { receiveNDI } from "./ndi/talk"
import { OutputHelper } from "./output/OutputHelper"
import { setRtmpNoticeListener, setRtmpStatusListener } from "./streaming/RtmpStreamer"
import { callClose, exitApp, saveAndClose } from "./utils/close"
import { applyGraphicsDeviceSelection, scheduleGpuHealthCheck } from "./utils/gpu"
import { isDraggableAreaVisible, isWithinDisplayBounds, mainWindowInitialize, openDevTools, parseCommandLineArgs } from "./utils/init"
import { template } from "./utils/menuTemplate"
import { spellcheck } from "./utils/spellcheck"
import { loadingOptions, mainOptions } from "./utils/windowOptions"

// ----- STARTUP -----

// Enlarge the libuv thread pool early (before any worker inherits the env / before first async work). Both
// osr-capture readbacks and grandiose NDI sends run as async work on this pool; the default of 4 threads
// serializes multiple concurrent 4K outputs. Set as an OS env var so worker_threads inherit it. (multi-4K)
if (!process.env.UV_THREADPOOL_SIZE) process.env.UV_THREADPOOL_SIZE = "32"

// check if app's in production or not
export const isProd: boolean = process.env.NODE_ENV === "production" || !/[\\/]electron/.exec(process.execPath)

// remove "Disabled webSecurity" console warning as it is only disabled in development
if (!isProd) process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true"

// development settings
export const OUTPUT_CONSOLE = false
const RECORD_STARTUP_TIME = false

// get os platform
export const isWindows: boolean = process.platform === "win32"
export const isMac: boolean = process.platform === "darwin"
export const isLinux: boolean = process.platform === "linux"

// ---- Linux OSR paint-throttle fix (render-overhaul task #19; see the LINUX NOTE in OutputLifecycle) ----
// Measured on the WSL diagnostic run (abd372f9): the OSR windows render (CPU busy,
// setFrameRate applied) but Chromium's offscreen compositor emits ZERO `paint` events — no begin-frame /
// vsync source reaches an offscreen window on Linux (worst on a virtual GPU like WSLg; ~1fps was seen on
// bare metal). These switches remove the compositor's vsync/frame-rate/occlusion throttles so OSR frames
// are actually produced. LINUX-GATED: Windows/mac paint correctly today and must not be unthrottled
// process-wide. Must run before app "ready". Safe with disableHardwareAcceleration (they gate compositor
// SCHEDULING, not the GPU/CPU compositing mode — that choice stays with the HWA config below).
// REGRESSION LESSON (real NVIDIA bare metal): `run-all-compositor-stages-before-draw` used to be in this
// block. It is a deterministic-pixel-TESTING flag that forces every compositor stage to run synchronously
// before each draw, PROCESS-WIDE — it tanked the whole app (~4fps, including the plain <video> preview,
// which never touches OSR) on a real GPU while appearing harmless on WSL's software compositor. Never
// re-add it; the switches below plus the begin-frame drive in OutputLifecycle are sufficient for OSR.
// Chromium treats a repeated `--enable-features` switch as a REPLACEMENT, not a union — a second
// appendSwitch("enable-features", ...) silently clobbers whatever an earlier toggle set. Every block that
// enables features MUST go through this helper, which merges (comma-joined, deduped) with any value already
// on the command line.
function appendEnableFeatures(features: string) {
    const existing = app.commandLine.getSwitchValue("enable-features")
    const merged = [...new Set([...existing.split(","), ...features.split(",")].filter(Boolean))].join(",")
    app.commandLine.appendSwitch("enable-features", merged)
}

if (process.platform === "linux") {
    app.commandLine.appendSwitch("disable-gpu-vsync") // don't wait on a vsync signal OSR windows never get (visible windows may tear; acceptable for a live-output app)
    app.commandLine.appendSwitch("disable-frame-rate-limit") // no synthetic frame-rate cap when unsynced (paints still paced by setFrameRate + the capture admission gate)
    app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion") // never treat the hidden OSR windows as occluded (occlusion pauses rendering entirely; the feature is Windows-native but disabling is a harmless no-op elsewhere)
    // process-wide backing for the per-window backgroundThrottling:false (windowOptions.ts): keep renderers
    // + timers of never-shown OSR windows at full rate
    app.commandLine.appendSwitch("disable-renderer-backgrounding")
    app.commandLine.appendSwitch("disable-background-timer-throttling")
    app.commandLine.appendSwitch("disable-backgrounding-occluded-windows")

    // ---- REGRESSION LESSONS (Linux GPU investigation, rounds 1-8 — measured on real hardware; do NOT re-try) ----
    // These switches/approaches were all tested against the bare-metal-laptop symptom (OSR ~1-4 paints/s /
    // software compositing) and are CONFIRMED dead ends. Condensed here so they are never re-tried:
    //   • `run-all-compositor-stages-before-draw` — deterministic-pixel-TESTING flag; ran the whole
    //     compositor synchronously PROCESS-WIDE, tanked the entire app to ~4fps on real NVIDIA (harmless-
    //     looking only on WSL's software compositor).
    //   • `--use-gl=angle` + `--use-angle=<anything>` (incl. gl-egl / opengl combos) — on Electron 37 the
    //     combo parses to `gl=none` and KILLS the GPU process ("Requested GL implementation not found");
    //     `--use-angle=gl-egl` alone was additionally a confirmed NDI regression under X11. No ANGLE forcing.
    //   • `--ignore-gpu-blocklist` (± `--enable-gpu-rasterization`) — measured no effect on the symptom.
    //   • DRI_PRIME / __GLX_VENDOR_LIBRARY_NAME env pinning (the FORCE_INTEL_GL recipe) — Chromium filters
    //     its sandboxed children's env; unreliable, superseded by `--render-node-override` (the mechanism
    //     stock Chromium itself uses — see applyGraphicsDeviceSelection below).
    //   • Showing the OSR window off-desktop (visible-offscreen experiment) — unnecessary once the real
    //     cause (software video decode starving the app) was fixed; the begin-frame drive in OutputLifecycle
    //     covers the genuine no-begin-frame case and self-silences on healthy compositors.
    // The ACTUAL Linux fix (proven on hardware): VA-API hardware video decode (default-ON below) + the
    // system VA driver package (e.g. intel-media-va-driver-non-free; the health check names it when absent).

    // VA-API hardware video decode/encode — DEFAULT ON whenever hardware acceleration isn't disabled.
    // Chromium ships desktop-Linux VA-API decode OFF by default (stock Chrome 151 flips it on; Electron 37 =
    // Chromium 138 does not) — <video> decode then runs on the CPU, and software 4K60 H.264 alone costs
    // ~3.1 cores, starving preview/OSR/NDI downstream (the round-8 root cause). Feature names VERIFIED
    // against the shipped Electron 37 Linux binary (round 8, `strings`): AcceleratedVideoDecodeLinuxGL,
    // AcceleratedVideoDecodeLinuxZeroCopyGL, AcceleratedVideoEncoder and VaapiIgnoreDriverChecks all exist;
    // `AcceleratedVideoDecoder` does NOT (dead name).
    //   AcceleratedVideoDecodeLinuxGL — the default-OFF gate for GL-backed VA-API decode. THE key feature.
    //   AcceleratedVideoEncoder — VA-API encode; harmless and symmetric.
    //   VaapiIgnoreDriverChecks — skips the VA driver allow-list so a blacklisted/unknown driver still gets
    //     a chance (cheap insurance on live-ISO stacks).
    // Kill-switch for debugging: FS_LINUX_VAAPI=0 disables; FS_LINUX_VAAPI=zero additionally opts into the
    // zero-copy GL import (A/B). Respects disableHardwareAcceleration (no GPU process to host the decoder).
    const linuxVaapi = process.env.FS_LINUX_VAAPI
    if (linuxVaapi !== "0" && config.get("disableHardwareAcceleration") !== true) {
        let vaapiFeatures = "AcceleratedVideoDecodeLinuxGL,AcceleratedVideoEncoder,VaapiIgnoreDriverChecks"
        if (linuxVaapi === "zero") vaapiFeatures += ",AcceleratedVideoDecodeLinuxZeroCopyGL"
        appendEnableFeatures(vaapiFeatures)
        console.info(`[LINUX] VA-API hardware video decode enabled by default (--enable-features=${app.commandLine.getSwitchValue("enable-features")}; set FS_LINUX_VAAPI=0 to disable)`)
    } else if (linuxVaapi === "0") {
        console.info("[LINUX] FS_LINUX_VAAPI=0: VA-API hardware video decode DISABLED (debug kill-switch)")
    }

    // OPT-IN Chromium media/VA-API verbose logging (round 8): when VA-API decode silently falls back to
    // software, Chromium's vmodule logs name the EXACT decline reason (e.g. WSL round 8:
    // `vaapi_wrapper.cc GetHandle(): ...failed to find a suitable render node` →
    // `video_decoder_pipeline.cc Initialize(): Video configuration is not supported`). This toggle routes
    // Chromium logging to stderr and turns those modules verbose so a laptop run prints the reason in
    // plain text. DEFAULT OFF; gated behind FS_LINUX_MEDIA_LOG=1. Diagnostic only — no rendering effect.
    if (process.env.FS_LINUX_MEDIA_LOG === "1") {
        app.commandLine.appendSwitch("enable-logging", "stderr")
        app.commandLine.appendSwitch("vmodule", "*vaapi*=2,*video_decoder*=2")
        console.info("[LINUX] FS_LINUX_MEDIA_LOG=1: Chromium media logging to stderr (--enable-logging=stderr --vmodule=*vaapi*=2,*video_decoder*=2)")
    }
}

// ---- Graphics device selection (Settings > Other > "Graphics device"; default "Auto") ----
// Applied BEFORE app "ready" (command-line switches must precede GPU process launch); a change in Settings
// requires a restart, exactly like the hardware-acceleration toggle. Respects disableHardwareAcceleration
// (no GPU process to pin). See utils/gpu.ts for enumeration + the per-platform mechanism notes.
applyGraphicsDeviceSelection()

let autoProfile = ""
export function setAutoProfile(profile: string) {
    if (profile) autoProfile = profile
}

// parse command line arguments
parseCommandLineArgs()

// check if store works
config.set("loaded", true)
if (!config.get("loaded")) console.error("Could not get stored data!")

// info
console.info("Starting FreeShow...")
if (!isProd) console.info("Building app! (This may take 5-40 seconds)")

// set application menu
setGlobalMenu()

// error reporting
autoErrorReport()

// hardware acceleration
// Snapshot of the ACTUAL runtime decision (app.disableHardwareAcceleration() only applies for this
// process and a config change requires a restart). Capture/convert paths MUST gate on this snapshot, not
// the live config value — otherwise toggling the setting without restarting mismatches the real compositor
// mode (e.g. setting turned off but still really disabled -> shared-texture handler on a CPU compositor ->
// dead output). See OutputLifecycle.isHardwareAccelerationDisabled.
export const hardwareAccelerationDisabled = config.get("disableHardwareAcceleration") === true
if (hardwareAccelerationDisabled) {
    // Video did flicker sometime with HWA, especially on ARM Mac.
    // CPU usage is often lower with HWA enabled.
    // https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering
    app.disableHardwareAcceleration()
    console.info("Hardware Acceleration Disabled")
}

protocol.registerSchemesAsPrivileged([
    {
        scheme: "freeshow-protected",
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true
        }
    }
])

// start when ready
if (RECORD_STARTUP_TIME) console.time("Full startup")
app.on("ready", async () => {
    // PROVEN (WSL): at app-ready the GPU process has NOT finished init — getGPUFeatureStatus() returns
    // premature disabled_software defaults. The t=0 line is kept only as a marker of that early state;
    // the delayed re-logs show the true steady-state (WSL flips to enabled well before 10s).
    logGpuStatus("t=0")
    setTimeout(() => logGpuStatus("t=10s"), 10_000)
    setTimeout(() => logGpuStatus("t=25s"), 25_000)
    // runtime GPU health check (utils/gpu.ts): compares the ACTUAL steady-state GPU regime against the
    // user's intent and raises a verbose in-app notification on degradation. Scheduled well past the
    // premature at-ready window (see the note above) — the same reason the t=10s/25s re-logs exist.
    scheduleGpuHealthCheck()
    await startApp()
    requestHeaders()
})

// One-shot diagnostic: dump Chromium's GPU feature status (same fields as chrome://gpu) plus the basic
// GL vendor/renderer/driver strings. Tells us whether gpu_compositing / gpu_rasterization / webgl are on
// real HARDWARE or a SOFTWARE fallback, and whether GL_RENDERER is llvmpipe/software vs a real NVIDIA
// renderer — the crux of the Linux OSR paint-throttle investigation. Always-on on Linux, elsewhere gated
// behind FS_CAP_STATS. Purely observational: reads status, changes no runtime behavior.
// Called at ready ("t=0") and re-called at 10s/25s: the at-ready reading is PREMATURE (GPU process still
// initializing — reports disabled_software defaults); only the delayed lines reflect the real regime.
function logGpuStatus(tag: string) {
    if (!isLinux && !process.env.FS_CAP_STATS) return
    try {
        const s = app.getGPUFeatureStatus() as unknown as Record<string, string>
        console.info(`[GPU-STATUS ${tag}] gpu_compositing=${s.gpu_compositing} gpu_rasterization=${s.rasterization ?? s.gpu_rasterization} webgl=${s.webgl} webgl2=${s.webgl2} video_decode=${s.video_decode}`)
    } catch (err) {
        console.warn(`[GPU-STATUS ${tag}] getGPUFeatureStatus failed:`, err)
    }
    app.getGPUInfo("basic")
        .then((info: any) => {
            const d = info?.gpuDevice?.find((g: any) => g.active) ?? info?.gpuDevice?.[0] ?? {}
            console.info(`[GPU-STATUS ${tag}] vendor=${info?.auxAttributes?.glVendor ?? d.vendorId} renderer=${info?.auxAttributes?.glRenderer ?? "?"} driver=${info?.auxAttributes?.glVersion ?? d.driverVersion ?? "?"}`)
        })
        .catch((err: Error) => console.warn(`[GPU-STATUS ${tag}] getGPUInfo failed:`, err))
}

export let powerSaveBlockerId: number | null = null
async function startApp() {
    if (RECORD_STARTUP_TIME) console.time("Initial")

    // WIDEVINE
    // Wait for Widevine CDM components to be ready (required for castlabs electron)
    // try {
    //     const { components } = require("electron")
    //     await components.whenReady()
    //     console.info("Widevine CDM components ready")
    // } catch (err) {
    //     console.warn("Failed to initialize Widevine CDM components:", err)
    // }

    setTimeout(createLoading)

    setRtmpStatusListener((outputId, destinations) => sendToMain(ToMain.RTMP_STATUS, { outputId, destinations }))
    setRtmpNoticeListener((message) => sendToMain(ToMain.ALERT, message))

    await setupStores()

    registerProtectedProtocol()
    cleanupProtectedCache().catch((err) => console.error("Protected cache cleanup failed:", err))

    // Start servers initialization early (asynchronously)
    Promise.resolve()
        .then(() => {
            require("./servers")
        })
        .catch(console.error)

    if (RECORD_STARTUP_TIME) console.timeEnd("Initial")

    createMain()

    // prevent display sleeping
    powerSaveBlockerId = powerSaveBlocker.start("prevent-display-sleep")
}

function requestHeaders() {
    // Fix YouTube Error 153 - set referrer policy for all requests
    // https://stackoverflow.com/questions/79802987/youtube-error-153-video-player-configuration-error-when-embedding-youtube-video
    const session = require("electron").session.defaultSession
    session.webRequest.onBeforeSendHeaders((details: any, callback: any) => {
        if (details.url.includes("youtube.com") || details.url.includes("youtube-nocookie.com")) {
            details.requestHeaders.Referer = "https://freeshow.app/"
        }
        callback({ requestHeaders: details.requestHeaders })
    })
}

// ----- LOADING WINDOW -----

let loadingWindow: BrowserWindow | null = null
function createLoading() {
    loadingWindow = new BrowserWindow(loadingOptions)
    loadingWindow.loadFile("public/loading.html")
    loadingWindow.once("closed", () => (loadingWindow = null))
}

// ----- MAIN WINDOW -----

export let mainWindow: BrowserWindow | null = null
const MIN_WINDOW_SIZE = 400
const DEFAULT_WINDOW_SIZE = { width: 800, height: 600 }
function createMain() {
    if (RECORD_STARTUP_TIME) console.time("Main window")
    const bounds: Rectangle = windowBounds.get()
    const screenBounds: Rectangle = screen.getPrimaryDisplay().bounds

    const options: Electron.BrowserWindowConstructorOptions = {
        width: getWindowBounds("width"),
        height: getWindowBounds("height"),
        frame: !isProd || !isWindows,
        autoHideMenuBar: isProd && isWindows
    }

    // should be centered to screen if x & y is not set (or bottom left on mac)
    if (bounds.x) options.x = bounds.x
    if (bounds.y) options.y = bounds.y

    // check if window position is within a visible area and draggable top area is accessible
    if (bounds.x && bounds.y && (!isWithinDisplayBounds({ x: bounds.x, y: bounds.y }) || !isDraggableAreaVisible(bounds, options.width!))) {
        options.x = (screenBounds.width - options.width!) / 2
        options.y = (screenBounds.height - options.height!) / 2
    }

    // create window
    mainWindow = new BrowserWindow({ ...mainOptions, ...options })

    // ensure correct dimensions regardless of DPI scaling (without this, the window changed size each startup when scale was not 100%)
    mainWindow.setSize(options.width!, options.height!)

    // macos min size
    mainWindow.setMinimumSize(MIN_WINDOW_SIZE, MIN_WINDOW_SIZE)

    if (RECORD_STARTUP_TIME) console.time("Main window content")
    loadWindowContent(mainWindow)
    setMainListeners()

    if (RECORD_STARTUP_TIME) console.timeEnd("Main window")

    function getWindowBounds(type: "width" | "height") {
        const size = !bounds[type] || bounds[type] === DEFAULT_WINDOW_SIZE[type] ? screenBounds[type] || DEFAULT_WINDOW_SIZE[type] : bounds[type]
        // set minimum window size on startup (in case it's tiny)
        return Math.max(MIN_WINDOW_SIZE, size)
    }
}

let isLoaded = false
function mainWindowLoaded() {
    if (RECORD_STARTUP_TIME) console.timeEnd("Main window content")
    isLoaded = true

    mainWindowInitialize()
    if (config.get("maximized")) maximizeMain()

    mainWindow?.show()
    loadingWindow?.close()

    if (RECORD_STARTUP_TIME) console.timeEnd("Full startup")
}

export async function loadWindowContent(window: BrowserWindow, type: null | "output" = null) {
    const mainOutput = type === null

    if (isProd) window.loadFile("public/index.html").catch(loadingFailed)
    else {
        // load development environment
        if (mainOutput) openDevTools(window)
        window.loadURL("http://localhost:3000").catch(loadingFailed)
    }

    window.webContents.on("did-finish-load", () => {
        window.webContents.send(STARTUP, { channel: "TYPE", data: type, autoProfile })
    })

    function loadingFailed(err: Error) {
        console.error("Failed to load window:", JSON.stringify(err))
        if (isLoaded && mainOutput) app.quit()
    }
}

export function getMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return null
    return mainWindow
}

export function resetMainWindow() {
    mainWindow = null
}

function setMainListeners() {
    if (!mainWindow) return

    mainWindow.on("maximize", () => config.set("maximized", true))
    mainWindow.on("unmaximize", () => config.set("maximized", false))

    mainWindow.on("resize", windowBounds.save)
    mainWindow.on("move", windowBounds.save)

    mainWindow.on("close", callClose)
    mainWindow.once("closed", exitApp)

    mainWindow.webContents.on("context-menu", (_, a) => spellcheck(a))
}

const windowBounds = {
    get(): Rectangle {
        try {
            const bounds = config.get("bounds")
            if (bounds?.width && bounds?.height) return bounds
        } catch (err) {
            console.warn("Failed to load saved bounds:", err)
        }
        return { x: 0, y: 0, width: 0, height: 0 }
    },
    save() {
        if (mainWindow?.isDestroyed()) return
        try {
            config.set("bounds", mainWindow!.getBounds())
        } catch (err) {
            console.warn("Failed to save window bounds:", err)
        }
    }
}

export function maximizeMain() {
    const isMaximized = !!mainWindow?.isMaximized()
    sendMain(Main.MAXIMIZED, !isMaximized)

    if (isMaximized) return mainWindow?.unmaximize()
    mainWindow?.maximize()
}

// set/update global application menu
export function setGlobalMenu(strings: Dictionary = {}) {
    if (isProd && isWindows) {
        // set to null as it is not used on Windows
        Menu.setApplicationMenu(null)
        return
    }

    const menu: Menu = Menu.buildFromTemplate(template(strings))
    Menu.setApplicationMenu(menu)
}

// ----- GLOBAL LISTENERS -----

// quit app when all windows have been closed
app.on("window-all-closed", () => {
    cleanupBeforeQuit()
    app.quit()
})

// close app completely on mac
app.on("will-quit", () => {
    cleanupBeforeQuit()
    if (isMac) app.exit()
})

app.on("web-contents-created", (_e, contents) => {
    contents.on("will-attach-webview", (_event, webPreferences) => {
        // remove unused preload scripts
        delete webPreferences.preload
    })
})

// handle graceful shutdown on SIGINT (e.g. Ctrl+C)
process.on("SIGINT", () => {
    console.info("Received SIGINT, closing app...")
    saveAndClose()
})

// handle graceful shutdown on SIGTERM (e.g. systemd)
process.on("SIGTERM", () => {
    console.info("Received SIGTERM, closing app...")
    saveAndClose()
})

function cleanupBeforeQuit() {
    ipcMain.removeAllListeners()

    // Remove window listeners and destroy windows if not already destroyed
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.removeAllListeners()
        mainWindow.destroy()
    }

    // Stop powerSaveBlocker if active
    if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
        powerSaveBlocker.stop(powerSaveBlockerId)
        powerSaveBlockerId = null
    }
}

// ----- LISTENERS -----

ipcMain.once("LOADED", mainWindowLoaded)
ipcMain.on(MAIN, receiveMain)
ipcMain.on(OUTPUT, OutputHelper.receiveOutput)
ipcMain.on(EXPORT, startExport)
ipcMain.on(CLOUD, cloudConnect)
ipcMain.on(NDI, receiveNDI)
ipcMain.on(BLACKMAGIC, receiveBM)
ipcMain.on(AUDIO, receiveAudio)

// send messages to main frontend (should not be used anymore - use sendMain() instead)
export const toApp = (channel: string, ...args: any[]): void => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send(channel, ...args)
}
