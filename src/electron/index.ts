// ----- FreeShow -----
// This is the electron entry point

import { app, BrowserWindow, desktopCapturer, ipcMain, Menu, Rectangle, screen, shell } from "electron"
import { getFonts } from "font-list"
import path from "path"
import { CLOUD, EXPORT, FILE_INFO, MAIN, OPEN_FILE, OPEN_FOLDER, OUTPUT, READ_FOLDER, SHOW, STORE } from "../types/Channels"
import { BIBLE, IMPORT } from "./../types/Channels"
import { closeServers } from "./servers"
import { checkShowsFolder, getDocumentsFolder, getFileInfo, getFolderContent, selectFiles, selectFolder, writeFile } from "./utils/files"
import { template } from "./utils/menuTemplate"
import { closeMidiInPorts } from "./utils/midi"
import { closeAllOutputs, displayAdded, displayRemoved, receiveOutput } from "./utils/output"
import { loadScripture, loadShow, receiveMain, startExport, startImport } from "./utils/responses"
import { config, stores } from "./utils/store"
import { loadingOptions, mainOptions } from "./utils/windowOptions"
import { cloudConnect } from "./cloud/cloud"
// import checkForUpdates from "./utils/updater"

// ----- STARTUP -----

// check if app's in production or not
export const isProd: boolean = process.env.NODE_ENV === "production" || !/[\\/]electron/.exec(process.execPath)

// check if store works
config.set("loaded", true)
if (!config.get("loaded")) console.error("Could not get stored data!")

// start when ready
app.on("ready", () => {
    if (isProd) startApp()
    else setTimeout(startApp, 15000)
})

function startApp() {
    createLoading()
    createMain()

    // listeners
    screen.on("display-added", displayAdded)
    screen.on("display-removed", displayRemoved)

    // midi
    // createVirtualMidi()

    // express
    require("./servers")
    // WIP: require("./webcam")

    // set app title to app name on windows
    if (process.platform === "win32") app.setAppUserModelId(app.name)

    // TODO: check for updates
    // if (isProd) checkForUpdates()
}

// get LOADED message from frontend
ipcMain.once("LOADED", () => {
    if (config.get("maximized")) mainWindow!.maximize()
    mainWindow?.show()
    loadingWindow?.close()
})

// ----- CUSTOM EXTENSION -----

// Custom .show file

//   var data = null;
//   if (process.platform === 'win32' && process.argv.length >= 2) {
//     var openFilePath = process.argv[1];
//     data = fs.readFileSync(openFilePath, 'utf-8');
//   }

// "fileAssociations": [
//   {
//     "ext": "show",
//     "name": "Show File",
//     "description": "A FreeShow lyric/presentation file",
//     "role": "Editor",
//     "perMachine": true
//   }
// ],

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
        frame: !isProd || process.platform !== "win32",
        autoHideMenuBar: isProd && process.platform === "win32",
    }

    // create window
    mainWindow = new BrowserWindow({ ...mainOptions, ...options })

    // load path
    if (isProd) mainWindow.loadFile("public/index.html").catch(err)
    else mainWindow.loadURL("http://localhost:3000").catch(err)

    function err(err: any) {
        console.error("Something went wrong when loading index:", JSON.stringify(err))
        app.quit()
    }

    // listeners
    mainWindow.on("maximize", () => config.set("maximized", true))
    mainWindow.on("unmaximize", () => config.set("maximized", false))
    mainWindow.on("resize", () => config.set("bounds", mainWindow!.getBounds()))
    mainWindow.on("move", () => config.set("bounds", mainWindow!.getBounds()))

    mainWindow.on("close", (e) => {
        if (!dialogClose) {
            e.preventDefault()
            toApp(MAIN, { channel: "CLOSE" })
        }
    })

    mainWindow.on("closed", () => {
        mainWindow = null
        dialogClose = false
        closeAllOutputs()
        closeServers()

        // midi
        // closeVirtualMidi()
        closeMidiInPorts()

        app.quit()

        // shouldn't need to use exit!
        app.exit()
    })

    setGlobalMenu()

    // open devtools
    if (!isProd) mainWindow.webContents.openDevTools()
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
    // closeServers()
    app.quit()
})

// close app completely on mac
app.on("will-quit", () => {
    if (process.platform === "darwin") app.exit()
})

// mac activate app after quit
// app.on("activate", () => {
//   // startServers()
//   mainWindow?.show()
// })

app.on("web-contents-created", (_e, contents) => {
    // console.info(e)
    // Security of webviews
    contents.on("will-attach-webview", (_event, webPreferences, _params) => {
        // console.info(event, params)
        // Strip away preload scripts if unused or verify their location is legitimate
        delete webPreferences.preload

        // Verify URL being loaded
        // if (!params.src.startsWith(`file://${join(__dirname)}`)) {
        //   event.preventDefault(); // We do not open anything now
        // }
    })

    // disallow in app web redirects
    contents.on("will-navigate", (e, navigationUrl) => {
        const parsedURL = new URL(navigationUrl)
        // In dev mode allow Hot Module Replacement
        if (parsedURL.host !== "localhost:3000" && !isProd) {
            console.warn("Stopped attempt to open: " + navigationUrl)
            e.preventDefault()
        } else if (isProd) {
            console.warn("Stopped attempt to open: " + navigationUrl)
            e.preventDefault()
        }
    })
})

// ----- STORE DATA -----

ipcMain.on(STORE, (e, msg) => {
    if (msg.channel === "SAVE") {
        save(msg.data)
        e.reply(STORE, { channel: "SAVE" })
    } else if (stores[msg.channel]) e.reply(STORE, { channel: msg.channel, data: stores[msg.channel].store })
})

function save(data: any) {
    // save to files
    Object.entries(stores).forEach(storeData)
    function storeData([key, store]: any) {
        if (!data[key] || JSON.stringify(store.store) === JSON.stringify(data[key])) return
        store.clear()
        store.set(data[key])
    }

    // shows
    data.path = checkShowsFolder(data.path)
    if (data.showsCache) Object.entries(data.showsCache).forEach(saveShow)
    function saveShow([id, value]: any) {
        let p: string = path.resolve(data.path, value.name + ".show")
        writeFile(p, JSON.stringify([id, value]), id)
    }

    // scriptures
    if (data.scripturesCache) Object.entries(data.scripturesCache).forEach(saveScripture)
    function saveScripture([id, value]: any) {
        let p: string = path.resolve(getDocumentsFolder(null, "Bibles"), value.name + ".fsb")
        writeFile(p, JSON.stringify([id, value]), id)
    }

    // saved cache
    if (data.savedCache) {
        let p: string = path.resolve(getDocumentsFolder(null, "Saves"), data.savedCache.name + ".json")
        writeFile(p, JSON.stringify(data.savedCache.data))
    }
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
ipcMain.on(CLOUD, cloudConnect)

// ----- HELPERS -----

// send messages to main frontend
export const toApp = (channel: string, ...args: any[]): void => mainWindow?.webContents.send(channel, ...args)

// open url in default web browser
export const openURL = (url: string) => {
    shell.openExternal(url)
    return
}

// set/update global application menu
export function setGlobalMenu(strings: any = {}) {
    const menu: Menu = Menu.buildFromTemplate(template(strings))
    Menu.setApplicationMenu(menu)
}

// get system fonts
export function loadFonts() {
    getFonts({ disableQuoting: true })
        .then((fonts: string[]) => toApp(MAIN, { channel: "GET_SYSTEM_FONTS", data: fonts }))
        .catch((err: any) => console.log(err))
}

// get screens/windows
export function getScreens(type: "window" | "screen" = "screen") {
    desktopCapturer.getSources({ types: [type] }).then(async (sources) => {
        const screens: any[] = []
        // console.log(sources)
        sources.map((source) => screens.push({ name: source.name, id: source.id }))
        // , display_id: source.display_id
        toApp(MAIN, { channel: type === "window" ? "GET_WINDOWS" : "GET_SCREENS", data: screens })
    })
}
