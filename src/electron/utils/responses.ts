// ----- FreeShow -----
// Respond to messages from the frontend

import { app, desktopCapturer, DesktopCapturerSource, Display, screen, shell, systemPreferences } from "electron"
import { getFonts } from "font-list"
import { machineIdSync } from "node-machine-id"
import os from "os"
import path from "path"
import { closeMain, isLinux, isProd, mainWindow, maximizeMain, setGlobalMenu, toApp } from ".."
import { BIBLE, MAIN, SHOW } from "../../types/Channels"
import { Show } from "../../types/Show"
import { restoreFiles } from "../data/backup"
import { downloadMedia } from "../data/downloadMedia"
import { createPDFWindow, exportProject, exportTXT } from "../data/export"
import { importShow } from "../data/import"
import { error_log } from "../data/store"
import { getThumbnail, saveImage } from "../data/thumbnails"
import { outputWindows } from "../output/output"
import { closeServers, startServers } from "../servers"
import { Message } from "./../../types/Socket"
import { startRestListener, startWebSocket, stopApiListener } from "./api"
import {
    checkShowsFolder,
    dataFolderNames,
    deleteFile,
    getDataFolder,
    getDocumentsFolder,
    getPaths,
    getSimularPaths,
    getTempPaths,
    loadFile,
    locateMediaFile,
    openSystemFolder,
    parseShow,
    readExifData,
    readFile,
    readFolder,
    renameFile,
    selectFilesDialog,
    selectFolderDialog,
    writeFile,
} from "./files"
import { closeMidiInPorts, getMidiInputs, getMidiOutputs, receiveMidi, sendMidi } from "./midi"
import checkForUpdates from "./updater"
import { LyricSearch } from "./LyricSearch"

// IMPORT
export function startImport(_e: any, msg: Message) {
    let files: string[] = selectFilesDialog("", msg.data.format)

    let isLinuxAndPfdImport = isLinux && msg.channel === "pdf"
    let needsFileAndNoFileSelected = msg.data.format.extensions && !files.length
    if (needsFileAndNoFileSelected || isLinuxAndPfdImport) return

    importShow(msg.channel, files || null, msg.data.path)
}

// EXPORT
export function startExport(_e: any, msg: Message) {
    if (msg.channel !== "GENERATE") return

    let dataPath: string = msg.data.path

    if (!dataPath) {
        dataPath = selectFolderDialog()
        if (!dataPath) return

        toApp(MAIN, { channel: "DATA_PATH", data: dataPath })
    }

    msg.data.path = getDataFolder(dataPath, dataFolderNames.exports)

    // WIP open in system when completed...

    if (msg.data.type === "pdf") createPDFWindow(msg.data)
    else if (msg.data.type === "txt") exportTXT(msg.data)
    else if (msg.data.type === "project") exportProject(msg.data)
}

// BIBLE
export function loadScripture(e: any, msg: Message) {
    let bibleFolder: string = getDataFolder(msg.path || "", dataFolderNames.scriptures)
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
    VERSION: (): string => app.getVersion(),
    IS_DEV: (): boolean => !isProd,
    GET_OS: (): any => ({ platform: os.platform(), name: os.hostname(), arch: os.arch() }),
    DEVICE_ID: (): string => machineIdSync(),
    AUTO_UPDATE: (): void => checkForUpdates(),
    GET_SYSTEM_FONTS: (): void => loadFonts(),
    URL: (data: string): void => openURL(data),
    START: (data: any): void => startServers(data),
    STOP: (): void => closeServers(),
    IP: (): any => os.networkInterfaces(),
    LANGUAGE: (data: any): void => setGlobalMenu(data.strings),
    SHOWS_PATH: (): string => getDocumentsFolder(),
    DATA_PATH: (): string => getDocumentsFolder(null, ""),
    DISPLAY: (): boolean => false,
    GET_LYRICS: (data: any): void => { getLyrics(data) },
    GET_MIDI_OUTPUTS: (): string[] => getMidiOutputs(),
    GET_MIDI_INPUTS: (): string[] => getMidiInputs(),
    GET_SCREENS: (): void => getScreens(),
    GET_WINDOWS: (): void => getScreens("window"),
    GET_DISPLAYS: (): Display[] => screen.getAllDisplays(),
    GET_PATHS: (): any => getPaths(),
    OUTPUT: (_: any, e: any): "true" | "false" => (e.sender.id === mainWindow?.webContents.id ? "false" : "true"),
    GET_TEMP_PATHS: (): any => getTempPaths(),
    GET_THUMBNAIL: (data: any): any => getThumbnail(data),
    SAVE_IMAGE: (data: any): any => saveImage(data),
    CLOSE: (): void => closeMain(),
    MAXIMIZE: (): void => maximizeMain(),
    MAXIMIZED: (): boolean => !!mainWindow?.isMaximized(),
    MINIMIZE: (): void => mainWindow?.minimize(),
    FULLSCREEN: (): void => mainWindow?.setFullScreen(!mainWindow?.isFullScreen()),
    SEARCH_LYRICS: (data: any): void => { searchLyrics(data) },
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
    READ_EXIF: (data: any, e: any) => readExifData(data, e),
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
    GET_SIMULAR: (data: any) => getSimularPaths(data),
    // WebSocket / REST (Combined)
    WEBSOCKET_START: (port: number | undefined) => {
        startRestListener(port ? port + 1 : 0)
        startWebSocket(port)
    },
    WEBSOCKET_STOP: () => stopApiListener(),
    // // WebSocket (Companion)
    // WEBSOCKET_START: (port: number | undefined) => startWebSocket(port),
    // WEBSOCKET_STOP: () => stopApiListener("WebSocket"),
    // // REST
    // REST_START: (port: number | undefined) => startRestListener(port),
    // REST_STOP: () => stopApiListener("REST"),
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

export function getAllShows(data: any) {
    let filesInFolder: string[] = readFolder(data.path).filter((a) => a.includes(".show") && a.length > 5)
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
        let show = parseShow(readFile(p))

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
export function trimShow(showCache: Show) {
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
    const songs = await LyricSearch.search(artist, title)
    toApp("MAIN", { channel: "SEARCH_LYRICS", data: songs })
}

// GET_LYRICS
async function getLyrics({song}: any) {
    const lyrics = await LyricSearch.get(song)
    console.log("****LYRICS", lyrics)
    toApp("MAIN", { channel: "GET_LYRICS", data: { lyrics, source:song.source } })
}

// GET_SCREENS | GET_WINDOWS
function getScreens(type: "window" | "screen" = "screen") {
    desktopCapturer.getSources({ types: [type] }).then((sources) => {
        let screens: any[] = []
        sources.map((source) => screens.push({ name: source.name, id: source.id }))
        if (type === "window") screens = addFreeShowWindows(screens, sources)

        toApp(MAIN, { channel: type === "window" ? "GET_WINDOWS" : "GET_SCREENS", data: screens })
    })

    function addFreeShowWindows(screens: any[], sources: DesktopCapturerSource[]) {
        Object.values({ main: mainWindow, ...outputWindows }).forEach((window: any) => {
            let mediaId = window?.getMediaSourceId()
            let windowsAlreadyExists = sources.find((a: any) => a.id === mediaId)
            if (windowsAlreadyExists) return

            screens.push({ name: window?.getTitle(), id: mediaId })
        })

        return screens
    }
}

// RECORDER
export function saveRecording(_: any, msg: any) {
    let folder: string = getDataFolder(msg.path || "", dataFolderNames.recordings)
    let p: string = path.resolve(folder, msg.name)

    const buffer = Buffer.from(msg.blob)
    writeFile(p, buffer)
}

// ERROR LOGGER
const maxLogLength = 250
export function logError(log: any, electron: boolean = false) {
    if (!isProd) return

    let storedLog: any = error_log.store
    let key = electron ? "main" : "renderer"

    let previousLog: any[] = storedLog[key] || []
    previousLog.push(log)

    if (previousLog.length > maxLogLength) previousLog = previousLog.slice(previousLog.length - maxLogLength)

    // error_log.clear()
    error_log.set({ [key]: previousLog })
}

export function catchErrors() {
    process.on("uncaughtException", (err) => logError(createLog(err), true))
}

function createLog(err: Error) {
    return {
        time: new Date(),
        os: process.platform || "Unknown",
        version: app.getVersion(),
        type: "Uncaught Exception",
        source: "See stack",
        message: err.message,
        stack: err.stack,
    }
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
