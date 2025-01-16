// ----- FreeShow -----
// Respond to messages from the frontend

import getFonts from "css-fonts"
import { app, BrowserWindow, desktopCapturer, DesktopCapturerSource, Display, screen, shell, systemPreferences } from "electron"
import { machineIdSync } from "node-machine-id"
import os from "os"
import path from "path"
import { closeMain, exitApp, isProd, mainWindow, maximizeMain, setGlobalMenu, toApp } from ".."
import { BIBLE, MAIN, SHOW } from "../../types/Channels"
import { restoreFiles } from "../data/backup"
import { downloadMedia } from "../data/downloadMedia"
import { importShow } from "../data/import"
import { convertPDFToImages } from "../data/pdfToImage"
import { config, error_log, stores } from "../data/store"
import { captureSlide, getThumbnail, getThumbnailFolderPath, saveImage } from "../data/thumbnails"
import { OutputHelper } from "../output/OutputHelper"
import { getPresentationApplications, presentationControl, startSlideshow } from "../output/ppt/presentation"
import { closeServers, startServers } from "../servers"
import type { Message } from "./../../types/Socket"
import { apiReturnData, emitOSC, startWebSocketAndRest, stopApiListener } from "./api"
import {
    bundleMediaFiles,
    checkShowsFolder,
    dataFolderNames,
    doesPathExist,
    getDataFolder,
    getDocumentsFolder,
    getFileInfo,
    getFolderContent,
    getMediaCodec,
    getMediaTracks,
    getPaths,
    getSimularPaths,
    getTempPaths,
    loadFile,
    locateMediaFile,
    openSystemFolder,
    readExifData,
    readFile,
    selectFiles,
    selectFilesDialog,
    selectFolder,
    writeFile,
} from "./files"
import { LyricSearch } from "./LyricSearch"
import { closeMidiInPorts, getMidiInputs, getMidiOutputs, receiveMidi, sendMidi } from "./midi"
import { deleteShows, deleteShowsNotIndexed, getAllShows, getEmptyShows, refreshAllShows } from "./shows"
import checkForUpdates from "./updater"
import { pcoConnect } from "../planningcenter/connect"

// IMPORT
export function startImport(_e: any, msg: Message) {
    let files: string[] = selectFilesDialog("", msg.data.format)

    let needsFileAndNoFileSelected = msg.data.format.extensions && !files.length
    if (needsFileAndNoFileSelected) return

    importShow(msg.channel, files || null, msg.data)
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
    GET_SYSTEM_FONTS: (data: any): void => loadFonts(data),
    URL: (data: string): void => openURL(data),
    LANGUAGE: (data: any): void => setGlobalMenu(data.strings),
    GET_PATHS: (): any => getPaths(),
    GET_TEMP_PATHS: (): any => getTempPaths(),
    SHOWS_PATH: (): string => getDocumentsFolder(),
    DATA_PATH: (): string => getDocumentsFolder(null, ""),
    LOG_ERROR: (data: any) => logError(data),
    OPEN_LOG: () => openSystemFolder(error_log.path),
    OPEN_CACHE: () => openSystemFolder(getThumbnailFolderPath()),
    GET_STORE_VALUE: (data: any) => getStoreValue(data),
    SET_STORE_VALUE: (data: any) => setStoreValue(data),
    // SHOWS
    DELETE_SHOWS: (data: any) => deleteShows(data),
    DELETE_SHOWS_NI: (data: any) => deleteShowsNotIndexed(data),
    REFRESH_SHOWS: (data: any) => refreshAllShows(data),
    GET_EMPTY_SHOWS: (data: any) => getEmptyShows(data),
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
    MEDIA_CODEC: (data: any) => getMediaCodec(data),
    MEDIA_TRACKS: (data: any) => getMediaTracks(data),
    DOWNLOAD_MEDIA: (data: any) => downloadMedia(data),
    MEDIA_BASE64: (data: any) => storeMedia(data),
    CAPTURE_SLIDE: (data: any) => captureSlide(data),
    PDF_TO_IMAGE: (data: any) => convertPDFToImages(data),
    ACCESS_CAMERA_PERMISSION: () => getPermission("camera"),
    ACCESS_MICROPHONE_PERMISSION: () => getPermission("microphone"),
    ACCESS_SCREEN_PERMISSION: () => getPermission("screen"),
    // PPT
    SLIDESHOW_GET_APPS: () => getPresentationApplications(),
    START_SLIDESHOW: (data: any) => startSlideshow(data),
    PRESENTATION_CONTROL: (data: any) => presentationControl(data),
    // SERVERS
    START: (data: any): void => startServers(data),
    STOP: (): void => closeServers(),
    // WebSocket / REST / OSC
    WEBSOCKET_START: (port: number | undefined) => startWebSocketAndRest(port),
    WEBSOCKET_STOP: () => stopApiListener(),
    API_TRIGGER: (data: any) => apiReturnData(data),
    EMIT_OSC: (data: any) => emitOSC(data),
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
    DOES_PATH_EXIST: (data: any) => {
        let p = data.path
        if (p === "data_config") p = path.join(data.dataPath, dataFolderNames.userData)
        return { ...data, exists: doesPathExist(p) }
    },
    UPDATE_DATA_PATH: () => {
        // updateDataPath({ ...data, load: true })
        let special = stores.SETTINGS.get("special")
        special.customUserDataLocation = true
        stores.SETTINGS.set("special", special)

        forceCloseApp()
    },
    LOCATE_MEDIA_FILE: (data: any) => locateMediaFile(data),
    GET_SIMULAR: (data: any) => getSimularPaths(data),
    BUNDLE_MEDIA_FILES: (data: any) => bundleMediaFiles(data),
    FILE_INFO: (data: any, e: any) => getFileInfo(data, e),
    READ_FOLDER: (data: any) => getFolderContent(data),
    READ_FILE: (data: any) => ({ ...data, content: readFile(data.path) }),
    OPEN_FOLDER: (data: any, e: any) => selectFolder(data, e),
    OPEN_FILE: (data: any, e: any) => selectFiles(data, e),
    // EXTRA
    PCO_CONNECT: () => pcoConnect(),
}

export function receiveMain(e: any, msg: Message) {
    let data: any = msg
    if (mainResponses[msg.channel]) data = mainResponses[msg.channel](msg.data, e)

    if (data !== undefined) e.reply(MAIN, { channel: msg.channel, data })
}

///// HELPERS /////

// URL: open url in default web browser
export const openURL = (url: string) => {
    shell.openExternal(url)
    return
}

// GET_SYSTEM_FONTS
function loadFonts(data: any) {
    loadFontsAsync(data)
}
async function loadFontsAsync(data: any) {
    const fonts = await getFonts()
    toApp(MAIN, { channel: "GET_SYSTEM_FONTS", data: { ...data, fonts } })
}

// SEARCH_LYRICS
async function searchLyrics({ artist, title }: any) {
    const songs = await LyricSearch.search(artist, title)
    toApp("MAIN", { channel: "SEARCH_LYRICS", data: songs })
}

// GET_LYRICS
async function getLyrics({ song }: any) {
    const lyrics = await LyricSearch.get(song)
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
        const windows: BrowserWindow[] = []
        OutputHelper.getAllOutputs().forEach(([output]: any) => {
            output.window && windows.push(output.window)
        })
        Object.values({ main: mainWindow, ...windows }).forEach((window: any) => {
            let mediaId = window?.getMediaSourceId()
            let windowsAlreadyExists = sources.find((a: any) => a.id === mediaId)
            if (windowsAlreadyExists) return

            screens.push({ name: window?.getTitle(), id: mediaId })
        })

        return screens
    }
}

export function forceCloseApp() {
    toApp(MAIN, { channel: "ALERT", data: "actions.closing" })
    // let user read message and action finish
    setTimeout(exitApp, 2000)
}

// RECORDER
// only open once per session
let systemOpened: boolean = false
export function saveRecording(_: any, msg: any) {
    let folder: string = getDataFolder(msg.path || "", dataFolderNames.recordings)
    let p: string = path.join(folder, msg.name)

    const buffer = Buffer.from(msg.blob)
    writeFile(p, buffer)

    if (!systemOpened) {
        openSystemFolder(folder)
        systemOpened = true
    }
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
    if (!previousLog.length) return

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

// GET STORE VALUE (used in special cases - currently only disableHardwareAcceleration)
function getStoreValue(data: { file: string; key: string }) {
    let store = data.file === "config" ? config : stores[data.file]
    return { ...data, value: store.get(data.key) }
}

// GET STORE VALUE (used in special cases - currently only disableHardwareAcceleration)
function setStoreValue(data: { file: string; key: string; value: any }) {
    let store = data.file === "config" ? config : stores[data.file]
    store.set(data.key, data.value)
}
