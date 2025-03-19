// ----- FreeShow -----
// This is the electron entry point

import { BrowserWindow, Menu, Rectangle, app, ipcMain, screen } from "electron"
import path from "path"
import { AUDIO, CLOUD, EXPORT, MAIN, NDI, OUTPUT, RECORDER, STARTUP } from "../types/Channels"
import { ToMain } from "../types/IPC/ToMain"
import type { Dictionary } from "../types/Settings"
import { receiveAudio } from "./audio/receiveAudio"
import { cloudConnect } from "./cloud/cloud"
import { startExport } from "./data/export"
import { config, updateDataPath } from "./data/store"
import { receiveMain, sendMain } from "./IPC/main"
import { catchErrors, saveRecording } from "./IPC/responsesMain"
import { NdiReceiver } from "./ndi/NdiReceiver"
import { receiveNDI } from "./ndi/talk"
import { OutputHelper } from "./output/OutputHelper"
import { closeServers } from "./servers"
import { stopApiListener } from "./utils/api"
import { doesPathExist } from "./utils/files"
import { template } from "./utils/menuTemplate"
import { stopMidi } from "./utils/midi"
import { loadingOptions, mainOptions } from "./utils/windowOptions"

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

function initialize() {
    // midi
    // createVirtualMidi()

    // express
    require("./servers")

    // set app title to app name
    if (isWindows) app.setAppUserModelId(app.name)

    if (!isProd) return

    catchErrors()
}

// get LOADED message from frontend
let isLoaded: boolean = false
ipcMain.once("LOADED", mainWindowLoaded)
function mainWindowLoaded() {
    if (RECORD_STARTUP_TIME) console.timeEnd("Main window content")
    isLoaded = true

    initialize()

    if (config.get("maximized")) maximizeMain()
    mainWindow?.show()
    loadingWindow?.close()

    if (RECORD_STARTUP_TIME) console.timeEnd("Full startup")
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
export let dialogClose: boolean = false // is unsaved
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

    // this is to debug any weird positioning
    // console.log("Main Window Bounds:", mainWindow.getBounds())

    loadWindowContent(mainWindow)
    setMainListeners()

    if (RECORD_STARTUP_TIME) console.timeEnd("Main window")

    function getWindowBounds(type: "width" | "height") {
        const size = !bounds[type] || bounds[type] === DEFAULT_WINDOW_SIZE[type] ? screenBounds[type] || DEFAULT_WINDOW_SIZE[type] : bounds[type]
        // set minimum window size on startup (in case it's tiny)
        return Math.max(MIN_WINDOW_SIZE, size)
    }
}

export function getMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return null
    return mainWindow
}

function openDevTools(window: BrowserWindow) {
    console.log('Opening DevTools... ("[ERROR:CONSOLE] Request Autofill" can be ignored)')
    window.webContents.openDevTools()
    // ERROR:CONSOLE(1)] "Request Autofill.enable failed. - can be ignored:
    // https://github.com/electron/electron/issues/41614
}

export async function loadWindowContent(window: BrowserWindow, type: null | "output" = null) {
    let mainOutput = type === null
    if (mainOutput && RECORD_STARTUP_TIME) console.time("Main window content")

    if (isProd) window.loadFile("public/index.html").catch(error)
    else {
        // load development environment
        if (mainOutput) {
            await waitForBundle()
            openDevTools(window)
        }
        window.loadURL("http://localhost:3000").catch(error)
    }

    window.webContents.on("did-finish-load", () => {
        window.webContents.send(STARTUP, { channel: "TYPE", data: type })
    })

    function error(err: any) {
        console.error("Failed to load window:", JSON.stringify(err))
        if (isLoaded && mainOutput) app.quit()
    }
}

// wait until the main Rollup bundle exists before loading
function waitForBundle() {
    const BUNDLE_PATH = path.resolve(__dirname, "..", "..", "public/build/bundle.js")
    const CHECK_INTERVAL = 2 // every 2 seconds
    const MAX_SECONDS = 120
    let tries = 0

    return new Promise((resolve) => {
        const interval = setInterval(() => {
            if (doesPathExist(BUNDLE_PATH)) {
                console.log("Main bundle created! Loading interface...")
                clearInterval(interval)
                resolve(true)
            }

            tries += CHECK_INTERVAL / MAX_SECONDS
            if (tries >= 1) {
                clearInterval(interval)
                app.quit()
                throw new Error("Could not load app content. Please check console for any errors!")
            }
        }, CHECK_INTERVAL * 1000)
    })
}

function setMainListeners() {
    if (!mainWindow) return

    /*
    mainWindow.on("minimize", () => {
        OutputHelper.Visibility.hideAllPreviews()
    })
    mainWindow.on("restore", () => {
        setTimeout(() => {
            OutputHelper.Visibility.showAllPreviews()
        }, 100)
    })*/

    mainWindow.on("maximize", () => {
        //OutputHelper.Bounds.updatePreviewBounds()
        config.set("maximized", true)
    })
    mainWindow.on("unmaximize", () => {
        //OutputHelper.Bounds.updatePreviewBounds()
        config.set("maximized", false)
    })

    mainWindow.on("resize", () => {
        //OutputHelper.Bounds.updatePreviewBounds()
        config.set("bounds", mainWindow?.getBounds())
    })
    mainWindow.on("move", () => {
        //OutputHelper.Bounds.updatePreviewBounds()
        config.set("bounds", mainWindow?.getBounds())
    })

    mainWindow.on("close", callClose)
    mainWindow.once("closed", exitApp)
}

function callClose(e: Electron.Event) {
    if (dialogClose) return
    e.preventDefault()

    sendMain(ToMain.CLOSE2, true)
}

export async function exitApp() {
    console.log("Closing app!")

    dialogClose = false

    await OutputHelper.Lifecycle.closeAllOutputs()
    NdiReceiver.stopReceiversNDI()

    closeServers()
    stopApiListener()

    stopMidi()

    // relaunch does not work very well as it launched new processes
    // if (!isProd) {
    //     console.log("Dev mode active - Relaunching...")
    //     app.relaunch()
    // } else {
    // this has to be called to actually remove the process!
    // https://stackoverflow.com/a/43520274
    mainWindow?.removeAllListeners("close")
    ipcMain.removeAllListeners()
    // }

    mainWindow = null

    try {
        app.quit()

        // shouldn't need to use exit!
        setTimeout(() => {
            app.exit()
        }, 500)
    } catch (err) {
        console.error("Failed closing app:", err)
    }
}

export function closeMain() {
    dialogClose = true
    mainWindow?.close()
}

export function maximizeMain() {
    let isMaximized: boolean = !!mainWindow?.isMaximized()
    sendMain(ToMain.MAXIMIZED2, !isMaximized)

    if (isMaximized) return mainWindow?.unmaximize()
    mainWindow?.maximize()
}

// ----- GLOBAL LISTENERS -----

// WIP: Mac ctrl+Q
// let quit = false
// app.on("before-quit", () => (quit = true))
// macOS: do not quit the application directly after the user close the last window, instead wait for Command + Q (or equivalent).
// https://stackoverflow.com/a/45156004
// https://stackoverflow.com/a/58823019

// quit app when all windows have been closed
// this is never called on mac, because of the "will-quit" listener
app.on("window-all-closed", () => {
    app.quit()
})

// close app completely on mac
app.on("will-quit", () => {
    if (isMac) app.exit()
})

app.on("web-contents-created", (_e, contents) => {
    contents.on("will-attach-webview", (_event, webPreferences, _params) => {
        // remove preload scripts if unused or verify their location is legitimate
        delete webPreferences.preload
    })

    // disallow in app web redirects
    // contents.on("will-navigate", (e, navigationUrl) => {
    //     // allow Hot Module Replacement in dev mode
    //     const parsedURL = new URL(navigationUrl)
    //     if (!isProd && parsedURL.host === "localhost:3000") return

    //     // >>> allow navigating on website items! <<<
    //     e.preventDefault()
    //     console.warn("Stopped attempt to open: " + navigationUrl)
    // })
})

// ----- LISTENERS -----

ipcMain.on(MAIN, receiveMain)
ipcMain.on(OUTPUT, OutputHelper.receiveOutput)
ipcMain.on(EXPORT, startExport)
ipcMain.on(CLOUD, cloudConnect)
ipcMain.on(RECORDER, saveRecording)
ipcMain.on(NDI, receiveNDI)
ipcMain.on(AUDIO, receiveAudio)

// ----- HELPERS -----

// send messages to main frontend (should not be used anymore)
export const toApp = (channel: string, ...args: any[]): void => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send(channel, ...args)
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
