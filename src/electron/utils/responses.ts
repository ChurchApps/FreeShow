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
import { importShow } from "../data/import"
import { error_log } from "../data/store"
import { getThumbnail, getThumbnailFolderPath, saveImage } from "../data/thumbnails"
import { outputWindows } from "../output/output"
import { closeServers, startServers } from "../servers"
import { Message } from "./../../types/Socket"
import { startWebSocketAndRest, stopApiListener } from "./api"
import {
    checkShowsFolder,
    dataFolderNames,
    deleteFile,
    getDataFolder,
    getDocumentsFolder,
    getFileInfo,
    getFolderContent,
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
    selectFiles,
    selectFilesDialog,
    selectFolder,
    writeFile,
} from "./files"
import { LyricSearch } from "./LyricSearch"
import { closeMidiInPorts, getMidiInputs, getMidiOutputs, receiveMidi, sendMidi } from "./midi"
import checkForUpdates from "./updater"

// IMPORT
export function startImport(_e: any, msg: Message) {
    let files: string[] = selectFilesDialog("", msg.data.format)

    let isLinuxAndPfdImport = isLinux && msg.channel === "pdf"
    let needsFileAndNoFileSelected = msg.data.format.extensions && !files.length
    if (needsFileAndNoFileSelected || isLinuxAndPfdImport) return

    importShow(msg.channel, files || null, msg.data.path)
}

// BIBLE
export function loadScripture(e: any, msg: Message) {
    let bibleFolder: string = getDataFolder(msg.path || "", dataFolderNames.scriptures)
    let p: string = path.join(bibleFolder, msg.name + ".fsb")

    let bible: any = loadFile(p, msg.id)

    // pre v0.5.6
    if (bible.error) p = path.join(app.getPath("documents"), "Bibles", msg.name + ".fsb")
    bible = loadFile(p, msg.id)

    if (msg.data) bible.data = msg.data
    e.reply(BIBLE, bible)
}

// SHOW
export function loadShow(e: any, msg: Message) {
    let p: string = checkShowsFolder(msg.path || "")
    p = path.join(p, (msg.name || msg.id) + ".show")
    let show: any = loadFile(p, msg.id)

    e.reply(SHOW, show)
}

// MAIN
const mainResponses: any = {
    // DATA
    LOG: (data: string): void => console.log(data),
    VERSION: (): string => app.getVersion(),
    IS_DEV: (): boolean => !isProd,
    GET_OS: (): any => ({ platform: os.platform(), name: os.hostname(), arch: os.arch() }),
    DEVICE_ID: (): string => machineIdSync(),
    IP: (): any => os.networkInterfaces(),
    // APP
    CLOSE: (): void => closeMain(),
    MAXIMIZE: (): void => maximizeMain(),
    MAXIMIZED: (): boolean => !!mainWindow?.isMaximized(),
    MINIMIZE: (): void => mainWindow?.minimize(),
    FULLSCREEN: (): void => mainWindow?.setFullScreen(!mainWindow?.isFullScreen()),
    // MAIN
    AUTO_UPDATE: (): void => checkForUpdates(),
    GET_SYSTEM_FONTS: (): void => loadFonts(),
    URL: (data: string): void => openURL(data),
    LANGUAGE: (data: any): void => setGlobalMenu(data.strings),
    GET_PATHS: (): any => getPaths(),
    GET_TEMP_PATHS: (): any => getTempPaths(),
    SHOWS_PATH: (): string => getDocumentsFolder(),
    DATA_PATH: (): string => getDocumentsFolder(null, ""),
    LOG_ERROR: (data: any) => logError(data),
    OPEN_LOG: () => openSystemFolder(error_log.path),
    OPEN_CACHE: () => openSystemFolder(getThumbnailFolderPath()),
    // SHOWS
    DELETE_SHOWS: (data: any) => deleteShowsNotIndexed(data),
    REFRESH_SHOWS: (data: any) => refreshAllShows(data),
    FULL_SHOWS_LIST: (data: any) => getAllShows(data),
    // OUTPUT
    GET_SCREENS: (): void => getScreens(),
    GET_WINDOWS: (): void => getScreens("window"),
    GET_DISPLAYS: (): Display[] => screen.getAllDisplays(),
    OUTPUT: (_: any, e: any): "true" | "false" => (e.sender.id === mainWindow?.webContents.id ? "false" : "true"),
    // MEDIA
    GET_THUMBNAIL: (data: any): any => getThumbnail(data),
    SAVE_IMAGE: (data: any): any => saveImage(data),
    READ_EXIF: (data: any, e: any) => readExifData(data, e),
    DOWNLOAD_MEDIA: (data: any) => downloadMedia(data),
    MEDIA_BASE64: (data: any) => storeMedia(data),
    ACCESS_CAMERA_PERMISSION: () => getPermission("camera"),
    ACCESS_MICROPHONE_PERMISSION: () => getPermission("microphone"),
    ACCESS_SCREEN_PERMISSION: () => getPermission("screen"),
    // SERVERS
    START: (data: any): void => startServers(data),
    STOP: (): void => closeServers(),
    // WebSocket / REST
    WEBSOCKET_START: (port: number | undefined) => startWebSocketAndRest(port),
    WEBSOCKET_STOP: () => stopApiListener(),
    // MIDI
    GET_MIDI_OUTPUTS: (): string[] => getMidiOutputs(),
    GET_MIDI_INPUTS: (): string[] => getMidiInputs(),
    SEND_MIDI: (data: any): void => {
        sendMidi(data)
    },
    RECEIVE_MIDI: (data: any): void => {
        receiveMidi(data)
    },
    CLOSE_MIDI: (data: any): void => closeMidiInPorts(data.id),
    // LYRICS
    GET_LYRICS: (data: any): void => {
        getLyrics(data)
    },
    SEARCH_LYRICS: (data: any): void => {
        searchLyrics(data)
    },
    // FILES
    RESTORE: (data: any) => restoreFiles(data),
    SYSTEM_OPEN: (data: any) => openSystemFolder(data),
    LOCATE_MEDIA_FILE: (data: any) => locateMediaFile(data),
    GET_SIMULAR: (data: any) => getSimularPaths(data),
    FILE_INFO: (data: any, e: any) => getFileInfo(data, e),
    READ_FOLDER: (data: any) => getFolderContent(data),
    OPEN_FOLDER: (data: any, e: any) => selectFolder(data, e),
    OPEN_FILE: (data: any, e: any) => selectFiles(data, e),
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
async function getLyrics({ song }: any) {
    const lyrics = await LyricSearch.get(song)
    console.log("****LYRICS", lyrics)
    toApp("MAIN", { channel: "GET_LYRICS", data: { lyrics, source: song.source } })
}

// GET DEVICE MEDIA PERMISSION
function getPermission(id: "camera" | "microphone" | "screen") {
    if (process.platform !== "darwin") return

    if (id === "screen") systemPreferences.getMediaAccessStatus(id)
    else systemPreferences.askForMediaAccess(id)
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
    let p: string = path.join(folder, msg.name)

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
