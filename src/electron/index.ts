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

// enlarge the libuv thread pool before any worker inherits the env: capture readbacks and NDI sends
// run as async work on this pool, and the default of 4 threads serializes concurrent 4K outputs
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

// Chromium treats a repeated --enable-features switch as a replacement, not a union, so every block
// that enables features must go through this helper (merges with any value already on the command line)
function appendEnableFeatures(features: string) {
    const existing = app.commandLine.getSwitchValue("enable-features")
    const merged = [...new Set([...existing.split(","), ...features.split(",")].filter(Boolean))].join(",")
    app.commandLine.appendSwitch("enable-features", merged)
}

if (process.platform === "linux") {
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

// graphics device selection (Settings > Other): must run before "ready" (command-line switches
// precede GPU process launch); a change requires a restart, like the hardware-acceleration toggle
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

// hardware acceleration: startup snapshot of the actual runtime decision. Capture/convert paths must
// gate on this, not the live config value — a not-yet-applied toggle would otherwise mismatch the real
// compositor mode and pick the wrong capture handler.
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
    // getGPUFeatureStatus() at app-ready is premature (GPU process still initializing, reports
    // disabled_software defaults) — only the delayed re-logs reflect the real state
    logGpuStatus("t=0")
    setTimeout(() => logGpuStatus("t=10s"), 10_000)
    setTimeout(() => logGpuStatus("t=25s"), 25_000)
    // compares the steady-state GPU regime against the user's intent, notifies on degradation
    scheduleGpuHealthCheck()
    await startApp()
    requestHeaders()
})

// diagnostic: dump Chromium's GPU feature status (same fields as chrome://gpu) plus GL
// vendor/renderer strings — shows whether compositing/decode run on hardware or a software fallback.
// Always on for Linux, elsewhere gated behind FS_CAP_STATS; observational only.
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
