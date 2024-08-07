// ----- FreeShow -----
// This is the electron entry point

import { BrowserWindow, Menu, Rectangle, app, ipcMain, screen } from "electron"
import path from "path"
import { CLOUD, EXPORT, MAIN, NDI, OUTPUT, RECORDER, SHOW, STARTUP, STORE } from "../types/Channels"
import { BIBLE, IMPORT } from "./../types/Channels"
import { cloudConnect } from "./cloud/cloud"
import { currentlyDeletedShows } from "./cloud/drive"
import { startBackup } from "./data/backup"
import { startExport } from "./data/export"
import { config, stores, updateDataPath, userDataPath } from "./data/store"
import { NdiReceiver } from "./ndi/NdiReceiver"
import { receiveNDI } from "./ndi/talk"
import { OutputHelper } from "./output/OutputHelper"
import { closeServers } from "./servers"
import { stopApiListener } from "./utils/api"
import { checkShowsFolder, dataFolderNames, deleteFile, getDataFolder, loadShows, writeFile } from "./utils/files"
import { template } from "./utils/menuTemplate"
import { stopMidi } from "./utils/midi"
import { catchErrors, loadScripture, loadShow, receiveMain, renameShows, saveRecording, startImport } from "./utils/responses"
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
if (!isProd) console.log("Building app! This may take 20-90 seconds")
if (isLinux) console.log("libva error on Linux can be ignored")

// set application menu
setGlobalMenu()

// start when ready
if (RECORD_STARTUP_TIME) console.time("Full startup")
app.disableHardwareAcceleration() //Video flickers, especially on ARM mac otherwise.  Performance is actually better without.  https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering
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
    loadingWindow.on("closed", () => (loadingWindow = null))
}

// ----- MAIN WINDOW -----

export let mainWindow: BrowserWindow | null = null
export let dialogClose: boolean = false // is unsaved
const MIN_WINDOW_SIZE = 200
function createMain() {
    if (RECORD_STARTUP_TIME) console.time("Main window")
    let bounds: Rectangle = config.get("bounds")
    let screenBounds: Rectangle = screen.getPrimaryDisplay().bounds

    let options: any = {
        width: !bounds.width || bounds.width === 800 ? screenBounds.width : bounds.width,
        height: !bounds.height || bounds.height === 600 ? screenBounds.height : bounds.height,
        frame: !isProd || !isWindows,
        autoHideMenuBar: isProd && isWindows,
    }

    // should be centered to screen if x & y is not set
    if (bounds.x) options.x = bounds.x
    if (bounds.y) options.y = bounds.y

    // set minimum window size on startup (in case it's tiny)
    options.width = Math.max(MIN_WINDOW_SIZE, options.width)
    options.height = Math.max(MIN_WINDOW_SIZE, options.height)

    // create window
    mainWindow = new BrowserWindow({ ...mainOptions, ...options })

    // macos min size
    mainWindow.setMinimumSize(MIN_WINDOW_SIZE, MIN_WINDOW_SIZE)

    // this is to debug any weird positioning
    console.log("Main Window Bounds:", mainWindow.getBounds())

    loadWindowContent(mainWindow)
    setMainListeners()

    // open devtools
    if (!isProd) mainWindow.webContents.openDevTools()

    if (RECORD_STARTUP_TIME) console.timeEnd("Main window")
}

export function loadWindowContent(window: BrowserWindow, isOutput: boolean = false) {
    if (!isOutput && RECORD_STARTUP_TIME) console.time("Main window content")
    if (!isOutput) console.log("Loading main window content")
    if (isProd) window.loadFile("public/index.html").catch(error)
    else window.loadURL("http://localhost:3000").catch(error)

    window.webContents.on("did-finish-load", () => {
        if (window === mainWindow) isOutput = false // make sure window is not output
        window.webContents.send(STARTUP, { channel: "TYPE", data: isOutput ? "output" : null })
        if (!isOutput) retryLoadingContent()
    })

    function error(err: any) {
        console.error("Failed to load window:", JSON.stringify(err))
        if (isLoaded && !isOutput) app.quit()
    }
}

// retry loading until content has finshed building
const retryInterval = 10
let tries = 0
function retryLoadingContent() {
    if (isProd) return

    setTimeout(() => {
        if (isLoaded) return

        if (tries < 1) console.log("Loading content again. App is probably not finished building yet")
        else if (tries > 15) {
            console.log("Could not load app content. Please check console for any errors!")
            return app.quit()
        } else console.log("Trying to load content again")
        tries++

        mainWindow!.webContents.reload()
    }, retryInterval * 1000)
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
    mainWindow.on("closed", exitApp)
}

function callClose(e: any) {
    if (dialogClose) return
    e.preventDefault()

    toApp(MAIN, { channel: "CLOSE" })
}

export async function exitApp() {
    console.log("Closing app!")

    mainWindow = null
    dialogClose = false

    await OutputHelper.Lifecycle.closeAllOutputs()
    NdiReceiver.stopReceiversNDI()

    closeServers()
    stopApiListener()

    stopMidi()

    if (!isProd) {
        console.log("Dev mode active - Relaunching...")
        app.relaunch()
    }

    try {
        app.quit()

        // shouldn't need to use exit!
        app.exit()
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
    toApp(MAIN, { channel: "MAXIMIZED", data: !isMaximized })

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

// ----- STORE DATA -----

ipcMain.on(STORE, (e, msg) => {
    if (userDataPath === null) updateDataPath()

    if (msg.channel === "UPDATE_PATH") updateDataPath(msg.data)
    else if (msg.channel === "SAVE") save(msg.data)
    else if (msg.channel === "SHOWS") loadShows(msg.data)
    else if (stores[msg.channel]) e.reply(STORE, { channel: msg.channel, data: stores[msg.channel].store })
})

function save(data: any) {
    // save to files
    Object.entries(stores).forEach(storeData)
    function storeData([key, store]: any) {
        if (!data[key] || JSON.stringify(store.store) === JSON.stringify(data[key])) return
        store.clear()
        store.set(data[key])

        if (data.reset === true) toApp(STORE, { channel: key, data: data[key] })
    }

    // scriptures
    let scripturePath = getDataFolder(data.dataPath, dataFolderNames.scriptures)
    if (data.scripturesCache) Object.entries(data.scripturesCache).forEach(saveScripture)
    function saveScripture([id, value]: any) {
        if (!value) return
        let p: string = path.join(scripturePath, value.name + ".fsb")
        writeFile(p, JSON.stringify([id, value]), id)
    }

    data.path = checkShowsFolder(data.path)
    // rename shows
    if (data.renamedShows) {
        let renamedShows = data.renamedShows.filter(({ id }: any) => !data.deletedShows[id])
        renameShows(renamedShows, data.path)
    }

    // let rename finish
    setTimeout(() => {
        // shows
        if (data.showsCache) Object.entries(data.showsCache).forEach(saveShow)
        function saveShow([id, value]: any) {
            if (!value) return
            let p: string = path.join(data.path, (value.name || id) + ".show")
            // WIP will overwrite a file with JSON data from another show 0,007% of the time (7 shows get broken when saving 1000 at the same time)
            writeFile(p, JSON.stringify([id, value]), id)
        }

        // delete shows
        if (data.deletedShows) data.deletedShows.forEach(deleteShow)
        function deleteShow({ name, id }: any) {
            if (!name || data.showsCache[id]) return

            let p: string = path.join(data.path, (name || id) + ".show")
            deleteFile(p)

            // update cloud
            currentlyDeletedShows.push(id)
        }

        // SAVED
        if (!data.reset) {
            setTimeout(() => {
                toApp(STORE, { channel: "SAVE", data: { closeWhenFinished: data.closeWhenFinished, backup: data.backup } })
            }, 300)
        }

        if (data.backup) startBackup({ showsPath: data.path, dataPath: data.dataPath, scripturePath })
    }, 700)
}

// ----- LISTENERS -----

ipcMain.on(MAIN, receiveMain)
ipcMain.on(OUTPUT, OutputHelper.receiveOutput)
ipcMain.on(IMPORT, startImport)
ipcMain.on(EXPORT, startExport)
ipcMain.on(SHOW, loadShow)
ipcMain.on(BIBLE, loadScripture)
ipcMain.on(CLOUD, cloudConnect)
ipcMain.on(RECORDER, saveRecording)
ipcMain.on(NDI, receiveNDI)

// ----- HELPERS -----

// send messages to main frontend
export const toApp = (channel: string, ...args: any[]): void => mainWindow?.webContents.send(channel, ...args)

// set/update global application menu
export function setGlobalMenu(strings: any = {}) {
    if (isProd && isWindows) {
        // set to null as it is not used on Windows
        Menu.setApplicationMenu(null)
        return
    }

    const menu: Menu = Menu.buildFromTemplate(template(strings))
    Menu.setApplicationMenu(menu)
}
