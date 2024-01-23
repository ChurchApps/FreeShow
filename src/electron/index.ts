// ----- FreeShow -----
// This is the electron entry point

import { BrowserWindow, Menu, Rectangle, app, ipcMain, screen } from "electron"
import path from "path"
import { CLOUD, EXPORT, FILE_INFO, MAIN, NDI, OPEN_FILE, OPEN_FOLDER, OUTPUT, READ_EXIF, READ_FOLDER, RECORDER, SHOW, STARTUP, STORE } from "../types/Channels"
import { BIBLE, IMPORT } from "./../types/Channels"
import { cloudConnect } from "./cloud/cloud"
import { receiveNDI } from "./ndi/talk"
import { closeServers } from "./servers"
import { startBackup } from "./utils/backup"
import { checkShowsFolder, dataFolderNames, deleteFile, getDataFolder, getFileInfo, getFolderContent, loadShows, readExifData, selectFiles, selectFolder, writeFile } from "./utils/files"
import { template } from "./utils/menuTemplate"
import { closeMidiInPorts } from "./utils/midi"
import { closeAllOutputs, receiveOutput } from "./utils/output"
import { catchErrors, loadScripture, loadShow, receiveMain, renameShows, saveRecording, startExport, startImport } from "./utils/responses"
import { config, stores, updateDataPath, userDataPath } from "./utils/store"
import checkForUpdates from "./utils/updater"
import { loadingOptions, mainOptions } from "./utils/windowOptions"
import { stopReceiversNDI } from "./ndi/ndi"

// ----- STARTUP -----

// check if app's in production or not
export const isProd: boolean = process.env.NODE_ENV === "production" || !/[\\/]electron/.exec(process.execPath)

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

// start when ready
app.on("ready", startApp)

function startApp() {
    createLoading()
    setTimeout(createMain, 100)
    setTimeout(initialize, 3000)
}

function initialize() {
    // midi
    // createVirtualMidi()

    // express
    require("./servers")

    // set app title to app name
    if (isWindows) app.setAppUserModelId(app.name)

    if (!isProd) return

    checkForUpdates()
    catchErrors()
}

// get LOADED message from frontend
let isLoaded: boolean = false
ipcMain.once("LOADED", () => {
    isLoaded = true
    if (config.get("maximized")) mainWindow!.maximize()
    mainWindow?.show()
    loadingWindow?.close()
})

// ----- CUSTOM EXTENSION -----
// rquires administator access on install

// Custom .show file

//   var data = null;
//   if (isWindows && process.argv.length >= 2) {
//     var openFilePath = process.argv[1];
//     data = fs.readFileSync(openFilePath, 'utf-8');
//   }

// "fileAssociations": [
//     {
//         "ext": "show",
//         "name": "FreeShow Show",
//         "description": "A FreeShow Show File",
//         "role": "Editor"
//     },
//     {
//         "ext": "fsb",
//         "name": "FreeShow Bible",
//         "description": "A FreeShow Bible File",
//         "role": "Editor"
//     },
//     {
//         "ext": "project",
//         "name": "FreeShow Project",
//         "description": "A FreeShow Project File",
//         "role": "Editor"
//     }
// ],
// "nsis": {
//     "perMachine": true
// },

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
function createMain() {
    let bounds: Rectangle = config.get("bounds")
    let screenBounds: Rectangle = screen.getPrimaryDisplay().bounds

    let options: any = {
        width: !bounds.width || bounds.width === 800 ? screenBounds.width : bounds.width,
        height: !bounds.height || bounds.height === 600 ? screenBounds.height : bounds.height,
        x: !bounds.x ? screenBounds.x : bounds.x,
        y: !bounds.y ? screenBounds.y : bounds.y,
        frame: !isProd || !isWindows,
        autoHideMenuBar: isProd && isWindows,
    }

    // create window
    mainWindow = new BrowserWindow({ ...mainOptions, ...options })

    loadWindowContent(mainWindow)
    setMainListeners()
    setGlobalMenu()

    // open devtools
    if (!isProd) mainWindow.webContents.openDevTools()
}

export function loadWindowContent(window: BrowserWindow, isOutput: boolean = false) {
    if (!isOutput) console.log("Loading main window content")
    if (isProd) window.loadFile("public/index.html").catch(error)
    else window.loadURL("http://localhost:3000").catch(error)

    window.webContents.on("did-finish-load", () => {
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

    mainWindow.on("maximize", () => config.set("maximized", true))
    mainWindow.on("unmaximize", () => config.set("maximized", false))

    mainWindow.on("resize", () => config.set("bounds", mainWindow?.getBounds()))
    mainWindow.on("move", () => config.set("bounds", mainWindow?.getBounds()))

    mainWindow.on("close", callClose)
    mainWindow.on("closed", exitApp)
}

function callClose(e: any) {
    if (dialogClose) return
    e.preventDefault()

    toApp(MAIN, { channel: "CLOSE" })
}

export async function exitApp() {
    mainWindow = null
    dialogClose = false

    await closeAllOutputs()
    stopReceiversNDI()
    closeServers()

    // midi
    // closeVirtualMidi()
    closeMidiInPorts()

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
// I think this is never called, because of the "will-quit" listener
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
    contents.on("will-navigate", (e, navigationUrl) => {
        // allow Hot Module Replacement in dev mode
        const parsedURL = new URL(navigationUrl)
        if (!isProd && parsedURL.host === "localhost:3000") return

        e.preventDefault()
        console.warn("Stopped attempt to open: " + navigationUrl)
    })
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
            let p: string = path.resolve(data.path, (value.name || id) + ".show")
            // WIP will overwrite a file with JSON data from another show 0,007% of the time (7 shows get broken when saving 1000 at the same time)
            writeFile(p, JSON.stringify([id, value]), id)
        }

        // delete shows
        if (data.deletedShows) data.deletedShows.forEach(deleteShow)
        function deleteShow({ name, id }: any) {
            if (!name || data.showsCache[id]) return
            let p: string = path.resolve(data.path, (name || id) + ".show")
            deleteFile(p)
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

ipcMain.on(IMPORT, startImport)
ipcMain.on(EXPORT, startExport)
ipcMain.on(BIBLE, loadScripture)
ipcMain.on(SHOW, loadShow)
ipcMain.on(MAIN, receiveMain)
ipcMain.on(OUTPUT, receiveOutput)
ipcMain.on(READ_FOLDER, getFolderContent)
ipcMain.on(OPEN_FOLDER, selectFolder)
ipcMain.on(OPEN_FILE, selectFiles)
ipcMain.on(FILE_INFO, getFileInfo)
ipcMain.on(READ_EXIF, readExifData)
ipcMain.on(CLOUD, cloudConnect)
ipcMain.on(RECORDER, saveRecording)
ipcMain.on(NDI, receiveNDI)

// ----- HELPERS -----

// send messages to main frontend
export const toApp = (channel: string, ...args: any[]): void => mainWindow?.webContents.send(channel, ...args)

// set/update global application menu
export function setGlobalMenu(strings: any = {}) {
    const menu: Menu = Menu.buildFromTemplate(template(strings))
    Menu.setApplicationMenu(menu)
}
