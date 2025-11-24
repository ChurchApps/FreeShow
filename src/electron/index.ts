// ----- FreeShow -----
// This is the electron entry point

import type { Rectangle } from "electron"
import { BrowserWindow, Menu, app, ipcMain, powerSaveBlocker, protocol, screen } from "electron"
import { AUDIO, CLOUD, EXPORT, MAIN, NDI, OUTPUT, RECORDER, STARTUP } from "../types/Channels"
import { Main } from "../types/IPC/Main"
import type { Dictionary } from "../types/Settings"
import { receiveAudio } from "./audio/receiveAudio"
import { cloudConnect } from "./cloud/cloud"
import { startExport } from "./data/export"
import { config, setupStores } from "./data/store"
import { receiveMain, sendMain } from "./IPC/main"
import { autoErrorReport, saveRecording } from "./IPC/responsesMain"
import { receiveNDI } from "./ndi/talk"
import { OutputHelper } from "./output/OutputHelper"
import { callClose, exitApp, saveAndClose } from "./utils/close"
import { isWithinDisplayBounds, mainWindowInitialize, openDevTools, parseCommandLineArgs, waitForBundle } from "./utils/init"
import { template } from "./utils/menuTemplate"
import { spellcheck } from "./utils/spellcheck"
import { loadingOptions, mainOptions } from "./utils/windowOptions"
import { registerProtectedProtocol } from "./data/protected"

// ----- STARTUP -----

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
if (!isProd) console.info("Building app! (This may take 20-90 seconds)")

// set application menu
setGlobalMenu()

// error reporting
autoErrorReport()

// hardware acceleration
const disableHWA = config.get("disableHardwareAcceleration")
if (disableHWA === true) {
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
app.on("ready", startApp)

export let powerSaveBlockerId: number | null = null
function startApp() {
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

    setupStores()

    registerProtectedProtocol()

    // Start servers initialization early (asynchronously)
    Promise.resolve()
        .then(() => {
            require("./servers")
        })
        .catch(console.error)

    if (RECORD_STARTUP_TIME) console.timeEnd("Initial")

    createMain()

    // prevent display sleeping
    powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep')
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
    const bounds: Rectangle = config.get("bounds")
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

    // check if window position is within a visible area
    if (bounds.x && bounds.y && !isWithinDisplayBounds({ x: bounds.x, y: bounds.y })) {
        options.x = (screenBounds.width - options.width!) / 2
        options.y = (screenBounds.height - options.height!) / 2
    }

    // create window
    mainWindow = new BrowserWindow({ ...mainOptions, ...options })

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
        if (mainOutput) {
            await waitForBundle()
            openDevTools(window)
        }
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

    mainWindow.on("resize", () => config.set("bounds", mainWindow?.getBounds()))
    mainWindow.on("move", () => config.set("bounds", mainWindow?.getBounds()))

    mainWindow.on("close", callClose)
    mainWindow.once("closed", exitApp)

    mainWindow.webContents.on("context-menu", (_, a) => spellcheck(a))
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
    app.quit()
})

// close app completely on mac
app.on("will-quit", () => {
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

// ----- LISTENERS -----

ipcMain.once("LOADED", mainWindowLoaded)
ipcMain.on(MAIN, receiveMain)
ipcMain.on(OUTPUT, OutputHelper.receiveOutput)
ipcMain.on(EXPORT, startExport)
ipcMain.on(CLOUD, cloudConnect)
ipcMain.on(RECORDER, saveRecording)
ipcMain.on(NDI, receiveNDI)
ipcMain.on(AUDIO, receiveAudio)

// send messages to main frontend (should not be used anymore - use sendMain() instead)
export const toApp = (channel: string, ...args: any[]): void => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send(channel, ...args)
}
