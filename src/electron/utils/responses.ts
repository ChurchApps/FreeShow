// ----- FreeShow -----
// Respond to messages from the frontend

import { app, desktopCapturer, Display, screen, shell, systemPreferences } from "electron"
import { getFonts } from "font-list"
import fs from "fs"
import os from "os"
import path from "path"
import { closeMain, mainWindow, maximizeMain, setGlobalMenu, toApp } from ".."
import { BIBLE, MAIN, SHOW } from "../../types/Channels"
import { Show } from "../../types/Show"
import { closeServers, startServers } from "../servers"
import { Message } from "./../../types/Socket"
import { restoreFiles } from "./backup"
import { createPDFWindow, exportProject, exportTXT } from "./export"
import { checkShowsFolder, deleteFile, doesPathExist, getDocumentsFolder, getPaths, loadFile, locateMediaFile, openSystemFolder, readFile, readFolder, renameFile, selectFilesDialog, selectFolderDialog, writeFile } from "./files"
import { importShow } from "./import"
import { closeMidiInPorts, getMidiInputs, getMidiOutputs, receiveMidi, sendMidi } from "./midi"
import { outputWindows } from "./output"
import { downloadMedia } from "./downloadMedia"
import { error_log } from "./store"

// IMPORT
export function startImport(_e: any, msg: Message) {
    let files: string[] = selectFilesDialog("", msg.data)

    if ((os.platform() === "linux" && msg.channel === "pdf") || (msg.data.extensions && !files.length)) return
    importShow(msg.channel, files || null)
}

// EXPORT
export function startExport(_e: any, msg: Message) {
    if (msg.channel !== "GENERATE") return

    let path: string = msg.data.path

    if (!path) {
        path = selectFolderDialog()
        if (!path) return
        toApp(MAIN, { channel: "EXPORT_PATH", data: path })
    }

    // WIP open in system when completed...

    if (msg.data.type === "pdf") createPDFWindow(msg.data)
    else if (msg.data.type === "txt") exportTXT(msg.data)
    else if (msg.data.type === "project") exportProject(msg.data)
}

// BIBLE
export function loadScripture(e: any, msg: Message) {
    let bibleFolder: string = msg.path || ""
    if (!bibleFolder) bibleFolder = getDocumentsFolder(null, "Bibles")
    let p: string = path.resolve(bibleFolder, msg.name + ".fsb")

    let bible: any = loadFile(p, msg.id)

    // pre v0.5.6
    if (bible.error) p = path.resolve(app.getPath("documents"), "Bibles", msg.name + ".fsb")
    bible = loadFile(p, msg.id)

    if (msg.data) bible.data = msg.data
    e.reply(BIBLE, bible)
}

// SHOW
export function loadShow(e: any, msg: Message) {
    let p: string = checkShowsFolder(msg.path || "")
    p = path.resolve(p, (msg.name || msg.id) + ".show")
    let show: any = loadFile(p, msg.id)

    e.reply(SHOW, show)
}

// MAIN
const mainResponses: any = {
    LOG: (data: string): void => console.log(data),
    GET_OS: (): any => ({ platform: os.platform(), name: os.hostname() }),
    GET_SYSTEM_FONTS: (): void => loadFonts(),
    VERSION: (): string => app.getVersion(),
    URL: (data: string): void => openURL(data),
    START: (data: any): void => startServers(data),
    STOP: (): void => closeServers(),
    IP: (): any => os.networkInterfaces(),
    LANGUAGE: (data: any): void => setGlobalMenu(data.strings),
    SHOWS_PATH: (): string => getDocumentsFolder(),
    EXPORT_PATH: (): string => getDocumentsFolder(null, "Exports"),
    SCRIPTURE_PATH: (): string => getDocumentsFolder(null, "Bibles"),
    RECORDING_PATH: (): string => getDocumentsFolder(null, "Recordings"),
    // READ_SAVED_CACHE: (data: any): string => readFile(path.resolve(getDocumentsFolder(null, "Saves"), data.id + ".json")),
    DISPLAY: (): boolean => false,
    GET_MIDI_OUTPUTS: (): string[] => getMidiOutputs(),
    GET_MIDI_INPUTS: (): string[] => getMidiInputs(),
    GET_SCREENS: (): void => getScreens(),
    GET_WINDOWS: (): void => getScreens("window"),
    GET_DISPLAYS: (): Display[] => screen.getAllDisplays(),
    GET_PATHS: (): any => getPaths(),
    OUTPUT: (_: any, e: any): "true" | "false" => (e.sender.id === mainWindow?.webContents.id ? "false" : "true"),
    CLOSE: (): void => closeMain(),
    MAXIMIZE: (): void => maximizeMain(),
    MAXIMIZED: (): boolean => !!mainWindow?.isMaximized(),
    MINIMIZE: (): void => mainWindow?.minimize(),
    FULLSCREEN: (): void => mainWindow?.setFullScreen(!mainWindow?.isFullScreen()),
    SEARCH_LYRICS: (data: any): void => {
        searchLyrics(data)
    },
    SEND_MIDI: (data: any): void => {
        sendMidi(data)
    },
    RECEIVE_MIDI: (data: any): void => {
        receiveMidi(data)
    },
    CLOSE_MIDI: (data: any): void => {
        closeMidiInPorts(data.id)
    },
    DELETE_SHOWS: (data: any) => deleteShowsNotIndexed(data),
    REFRESH_SHOWS: (data: any) => refreshAllShows(data),
    FULL_SHOWS_LIST: (data: any) => getAllShows(data),
    ACCESS_CAMERA_PERMISSION: () => {
        if (process.platform !== "darwin") return
        systemPreferences.askForMediaAccess("camera")
    },
    ACCESS_MICROPHONE_PERMISSION: () => {
        if (process.platform !== "darwin") return
        systemPreferences.askForMediaAccess("microphone")
    },
    ACCESS_SCREEN_PERMISSION: () => {
        if (process.platform !== "darwin") return
        systemPreferences.getMediaAccessStatus("screen")
    },
    RESTORE: (data: any) => restoreFiles(data),
    SYSTEM_OPEN: (data: any) => openSystemFolder(data),
    LOCATE_MEDIA_FILE: (data: any) => locateMediaFile(data),
    DOWNLOAD_MEDIA: (data: any) => downloadMedia(data),
    LOG_ERROR: (data: any) => logError(data),
    OPEN_LOG: () => openSystemFolder(error_log.path),
    MEDIA_BASE64: (data: any) => storeMedia(data),
}

export function receiveMain(e: any, msg: Message) {
    let data: any = msg
    if (mainResponses[msg.channel]) data = mainResponses[msg.channel](msg.data, e)

    if (data !== undefined) e.reply(MAIN, { channel: msg.channel, data })
}

///// HELPERS /////

// SHOWS
function deleteShowsNotIndexed(data: any) {
    // get all names
    let names: string[] = Object.entries(data.shows).map(([id, { name }]: any) => (name || id) + ".show")

    // list all shows in folder
    let filesInFolder: string[] = readFolder(data.path)
    if (!filesInFolder.length) return

    let deleted: string[] = []

    for (const name of filesInFolder) checkFile(name)
    function checkFile(name: string) {
        if (names.includes(name) || !name.includes(".show")) return

        let p: string = path.join(data.path, name)
        deleteFile(p)
        deleted.push(name)
    }

    toApp("MAIN", { channel: "DELETE_SHOWS", data: { deleted } })
}

function getAllShows(data: any) {
    let filesInFolder: string[] = readFolder(data.path)
    return filesInFolder
}

function refreshAllShows(data: any) {
    // list all shows in folder
    let filesInFolder: string[] = readFolder(data.path)
    if (!filesInFolder.length) return

    let newShows: any = {}

    for (const name of filesInFolder) loadFile(name)
    function loadFile(name: string) {
        if (!name.includes(".show")) return

        let p: string = path.join(data.path, name)
        let show = null
        try {
            show = JSON.parse(readFile(p) || "{}")
        } catch (error) {
            console.error("Error parsing show " + name) //  + ":", error
        }
        if (!show || !show[1]) return

        newShows[show[0]] = trimShow({ ...show[1], name: name.replace(".show", "") })
    }

    if (!Object.keys(newShows).length) return
    toApp("MAIN", { channel: "REFRESH_SHOWS", data: newShows })
}

export function renameShows(shows: any, path: string) {
    for (const show of shows) checkFile(show)
    function checkFile(show: any) {
        let oldName = show.oldName + ".show"
        let newName = (show.name || show.id) + ".show"

        renameFile(path, oldName, newName)
    }
}

// WIP duplicate of setShow.ts
function trimShow(showCache: Show) {
    let show: any = {}
    if (!showCache) return show

    show = {
        name: showCache.name,
        category: showCache.category,
        timestamps: showCache.timestamps,
    }
    if (showCache.private) show.private = true

    return show
}

// URL: open url in default web browser
export const openURL = (url: string) => {
    shell.openExternal(url)
    return
}

// GET_SYSTEM_FONTS
function loadFonts() {
    getFonts({ disableQuoting: true })
        .then((fonts: string[]) => toApp(MAIN, { channel: "GET_SYSTEM_FONTS", data: fonts }))
        .catch((err: any) => console.log(err))
}

// SEARCH_LYRICS
async function searchLyrics({ artist, title }: any) {
    const Genius = require("genius-lyrics")
    const Client = new Genius.Client()

    const songs = await Client.songs.search(title + artist)
    const lyrics = songs[0] ? await songs[0].lyrics() : ""

    toApp("MAIN", { channel: "SEARCH_LYRICS", data: { lyrics } })
}

// GET_SCREENS | GET_WINDOWS
function getScreens(type: "window" | "screen" = "screen") {
    desktopCapturer.getSources({ types: [type] }).then(async (sources) => {
        const screens: any[] = []
        // console.log(sources)
        sources.map((source) => screens.push({ name: source.name, id: source.id }))
        // , display_id: source.display_id

        // add FreeShow windows
        if (type === "window") {
            Object.values({ main: mainWindow, ...outputWindows }).forEach((window: any) => {
                let mediaId = window?.getMediaSourceId()
                if (!sources.find((a) => a.id === mediaId)) screens.push({ name: window?.getTitle(), id: mediaId })
            })
        }

        toApp(MAIN, { channel: type === "window" ? "GET_WINDOWS" : "GET_SCREENS", data: screens })
    })
}

// RECORDER
export function saveRecording(_: any, msg: any) {
    let folder: string = msg.path || ""
    if (!folder) folder = getDocumentsFolder(null, "Recordings")
    else if (!doesPathExist(folder)) folder = fs.mkdirSync(folder, { recursive: true }) || folder

    let p: string = path.resolve(folder, msg.name)

    const buffer = Buffer.from(msg.blob)
    writeFile(p, buffer)
}

// ERROR LOGGER
const maxLogLength = 250
export function logError(log: any, electron: boolean = false) {
    let storedLog: any = error_log.store
    let key = electron ? "main" : "renderer"

    let previousLog: any[] = storedLog[key] || []
    previousLog.push(log)

    if (previousLog.length > maxLogLength) previousLog = previousLog.slice(previousLog.length - maxLogLength)

    // error_log.clear()
    error_log.set({ [key]: previousLog })
}

// STORE MEDIA AS BASE64
function storeMedia(files: any[]) {
    let encodedFiles: any[] = []
    files.forEach(({ id, path }) => {
        let content = readFile(path, "base64")
        encodedFiles.push({ id, content })
    })

    toApp(MAIN, { channel: "MEDIA_BASE64", data: encodedFiles })
}
