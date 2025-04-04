// ----- FreeShow -----
// This is the electron entry point

import { BrowserWindow, Menu, Rectangle, app, ipcMain, screen } from "electron"
import { AUDIO, CLOUD, EXPORT, MAIN, NDI, OUTPUT, RECORDER, STARTUP } from "../types/Channels"
import { Main } from "../types/IPC/Main"
import type { Dictionary } from "../types/Settings"
import { receiveAudio } from "./audio/receiveAudio"
import { cloudConnect } from "./cloud/cloud"
import { startExport } from "./data/export"
import { config, updateDataPath } from "./data/store"
import { receiveMain, sendMain } from "./IPC/main"
import { saveRecording } from "./IPC/responsesMain"
import { receiveNDI } from "./ndi/talk"
import { OutputHelper } from "./output/OutputHelper"
import { callClose, exitApp } from "./utils/close"
import { mainWindowInitialize, openDevTools, waitForBundle } from "./utils/init"
import { template } from "./utils/menuTemplate"
import { loadingOptions, mainOptions } from "./utils/windowOptions"
import { spellcheck } from "./utils/spellcheck"

// ----- STARTUP -----

// check if app's in production or not
export const isProd: boolean = process.env.NODE_ENV === "production" || !/[\\/]electron/.exec(process.execPath)

// remove "Disabled webSecurity" console warning as it is only disabled in development
if (!isProd) process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true"

// development settings
export const OUTPUT_CONSOLE: boolean = false
const RECORD_STARTUP_TIME: boolean = false

// get os platform
export const isWindows: boolean = process.platform === "win32"
export const isMac: boolean = process.platform === "darwin"
export const isLinux: boolean = process.platform === "linux"

// check if store works
config.set("loaded", true)
if (!config.get("loaded")) console.error("Could not get stored data!")

// info
console.log("Starting FreeShow...")
if (!isProd) console.log("Building app! (This may take 20-90 seconds)")

// set application menu
setGlobalMenu()

// disable hardware acceleration by default
if (config.get("disableHardwareAcceleration") !== false) {
    // Video flickers, especially on ARM mac otherwise. Performance is actually better without (most of the time).
    // this should remove flickers on videos, but we have had reports of increased CPU usage in a lot of cases.
    // https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering
    app.disableHardwareAcceleration()
} else {
    console.log("Starting with Hardware Acceleration")
}

// start when ready
if (RECORD_STARTUP_TIME) console.time("Full startup")
app.on("ready", startApp)

function startApp() {
    if (RECORD_STARTUP_TIME) console.time("Initial")
    setTimeout(createLoading)
    updateDataPath({ load: true })
    if (RECORD_STARTUP_TIME) console.timeEnd("Initial")

    createMain()
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
const MIN_WINDOW_SIZE = 200
const DEFAULT_WINDOW_SIZE = { width: 800, height: 600 }
function createMain() {
    if (RECORD_STARTUP_TIME) console.time("Main window")
    let bounds: Rectangle = config.get("bounds")
    let screenBounds: Rectangle = screen.getPrimaryDisplay().bounds

    let options: Electron.BrowserWindowConstructorOptions = {
        width: getWindowBounds("width"),
        height: getWindowBounds("height"),
        frame: !isProd || !isWindows,
        autoHideMenuBar: isProd && isWindows,
    }

    // should be centered to screen if x & y is not set (or bottom left on mac)
    if (bounds.x) options.x = bounds.x
    if (bounds.y) options.y = bounds.y

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

let isLoaded: boolean = false
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
    let mainOutput = type === null

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
        window.webContents.send(STARTUP, { channel: "TYPE", data: type })
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

    mainWindow.webContents.on("context-menu", (_, p) => spellcheck(p))
}

export function maximizeMain() {
    let isMaximized: boolean = !!mainWindow?.isMaximized()
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
    contents.on("will-attach-webview", (_event, webPreferences, _params) => {
        // remove unused preload scripts
        delete webPreferences.preload
    })
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
