import getFonts from "css-fonts"
import { app, BrowserWindow, desktopCapturer, DesktopCapturerSource, screen, shell, systemPreferences } from "electron"
import { machineIdSync } from "node-machine-id"
import os from "os"
import path from "path"
import { getMainWindow, isProd, mainWindow, maximizeMain, setGlobalMenu } from ".."
import { Main, MainResponses } from "../../types/IPC/Main"
import type { ErrorLog, LyricSearchResult, OS } from "../../types/Main"
import { restoreFiles } from "../data/backup"
import { downloadMedia } from "../data/downloadMedia"
import { importShow } from "../data/import"
import { convertPDFToImages } from "../data/pdfToImage"
import { save } from "../data/save"
import { config, error_log, getStore, stores, updateDataPath, userDataPath } from "../data/store"
import { captureSlide, getThumbnail, getThumbnailFolderPath, saveImage } from "../data/thumbnails"
import { OutputHelper } from "../output/OutputHelper"
import { getPresentationApplications, presentationControl, startSlideshow } from "../output/ppt/presentation"
import { pcoDisconnect, pcoStartupLoad } from "../planningcenter/connect"
import { pcoLoadServices } from "../planningcenter/request"
import { closeServers, startServers, updateServerData } from "../servers"
import { apiReturnData, emitOSC, startWebSocketAndRest, stopApiListener } from "../utils/api"
import { closeMain, forceCloseApp } from "../utils/close"
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
    loadShows,
    locateMediaFile,
    openSystemFolder,
    readExifData,
    readFile,
    selectFiles,
    selectFilesDialog,
    selectFolder,
    writeFile,
} from "../utils/files"
import { LyricSearch } from "../utils/LyricSearch"
import { closeMidiInPorts, getMidiInputs, getMidiOutputs, receiveMidi, sendMidi } from "../utils/midi"
import { deleteShows, deleteShowsNotIndexed, getAllShows, getEmptyShows, refreshAllShows } from "../utils/shows"
import checkForUpdates from "../utils/updater"

export const mainResponses: MainResponses = {
    // DEV
    [Main.LOG]: (data) => console.log(data),
    [Main.IS_DEV]: () => !isProd,
    [Main.GET_TEMP_PATHS]: () => getTempPaths(),
    // APP
    [Main.VERSION]: () => app.getVersion(),
    [Main.GET_OS]: () => getOS(),
    [Main.DEVICE_ID]: () => machineIdSync(),
    [Main.IP]: () => os.networkInterfaces(),
    // STORES
    [Main.SETTINGS]: () => getStore("SETTINGS"),
    [Main.SYNCED_SETTINGS]: () => getStore("SYNCED_SETTINGS"),
    [Main.STAGE_SHOWS]: () => getStore("STAGE_SHOWS"),
    [Main.PROJECTS]: () => getStore("PROJECTS"),
    [Main.OVERLAYS]: () => getStore("OVERLAYS"),
    [Main.TEMPLATES]: () => getStore("TEMPLATES"),
    [Main.EVENTS]: () => getStore("EVENTS"),
    [Main.MEDIA]: () => getStore("MEDIA"),
    [Main.THEMES]: () => getStore("THEMES"),
    [Main.DRIVE_API_KEY]: () => getStore("DRIVE_API_KEY"),
    [Main.HISTORY]: () => getStore("HISTORY"),
    [Main.USAGE]: () => getStore("USAGE"),
    [Main.CACHE]: () => getStore("CACHE"),
    // WINDOW
    [Main.CLOSE]: () => closeMain(),
    [Main.MAXIMIZE]: () => maximizeMain(),
    [Main.MAXIMIZED]: () => !!getMainWindow()?.isMaximized(),
    [Main.MINIMIZE]: () => getMainWindow()?.minimize(),
    [Main.FULLSCREEN]: () => getMainWindow()?.setFullScreen(!getMainWindow()?.isFullScreen()),
    /////////////////////////
    [Main.SAVE]: async (a) => {
        if (userDataPath === null) updateDataPath()
        save(a)
    },
    [Main.IMPORT]: (data) => startImport(data),
    [Main.BIBLE]: (data) => loadScripture(data),
    [Main.SHOW]: (data) => loadShow(data),
    // MAIN
    [Main.SHOWS]: (data) => {
        if (userDataPath === null) updateDataPath()
        return loadShows(data)
    },
    [Main.AUTO_UPDATE]: () => checkForUpdates(),
    [Main.GET_SYSTEM_FONTS]: () => loadFonts(),
    [Main.URL]: (data) => openURL(data),
    [Main.LANGUAGE]: (data) => setGlobalMenu(data.strings),
    [Main.GET_PATHS]: () => getPaths(),
    [Main.SHOWS_PATH]: () => getDocumentsFolder(),
    [Main.DATA_PATH]: () => getDocumentsFolder(null, ""),
    [Main.LOG_ERROR]: (data) => logError(data),
    [Main.OPEN_LOG]: () => openSystemFolder(error_log.path),
    [Main.OPEN_CACHE]: () => openSystemFolder(getThumbnailFolderPath()),
    [Main.GET_STORE_VALUE]: (data) => getStoreValue(data),
    [Main.SET_STORE_VALUE]: (data) => setStoreValue(data),
    // SHOWS
    [Main.DELETE_SHOWS]: (data) => deleteShows(data),
    [Main.DELETE_SHOWS_NI]: (data) => deleteShowsNotIndexed(data),
    [Main.REFRESH_SHOWS]: (data) => refreshAllShows(data),
    [Main.GET_EMPTY_SHOWS]: (data) => getEmptyShows(data),
    [Main.FULL_SHOWS_LIST]: (data) => getAllShows(data),
    // OUTPUT
    [Main.GET_SCREENS]: () => getScreens(),
    [Main.GET_WINDOWS]: () => getScreens("window"),
    [Main.GET_DISPLAYS]: () => screen.getAllDisplays(),
    [Main.OUTPUT]: (_, e) => (e.sender.id === getMainWindow()?.webContents.id ? "false" : "true"),
    // MEDIA
    [Main.GET_THUMBNAIL]: (data) => getThumbnail(data),
    [Main.SAVE_IMAGE]: (data) => saveImage(data),
    [Main.READ_EXIF]: (data) => readExifData(data),
    [Main.MEDIA_CODEC]: (data) => getMediaCodec(data),
    [Main.MEDIA_TRACKS]: (data) => getMediaTracks(data),
    [Main.DOWNLOAD_MEDIA]: (data) => downloadMedia(data),
    // [Main.MEDIA_BASE64]: (data) => storeMedia(data),
    [Main.CAPTURE_SLIDE]: (data) => captureSlide(data),
    [Main.PDF_TO_IMAGE]: (data) => convertPDFToImages(data),
    [Main.ACCESS_CAMERA_PERMISSION]: () => getPermission("camera"),
    [Main.ACCESS_MICROPHONE_PERMISSION]: () => getPermission("microphone"),
    [Main.ACCESS_SCREEN_PERMISSION]: () => getPermission("screen"),
    // PPT
    [Main.SLIDESHOW_GET_APPS]: () => getPresentationApplications(),
    [Main.START_SLIDESHOW]: (data) => startSlideshow(data),
    [Main.PRESENTATION_CONTROL]: (data) => presentationControl(data),
    // SERVERS
    [Main.START]: (data) => startServers(data),
    [Main.STOP]: () => closeServers(),
    [Main.SERVER_DATA]: (data) => updateServerData(data),
    // WebSocket / REST / OSC
    [Main.WEBSOCKET_START]: (port) => startWebSocketAndRest(port),
    [Main.WEBSOCKET_STOP]: () => stopApiListener(),
    [Main.API_TRIGGER]: (data) => apiReturnData(data),
    [Main.EMIT_OSC]: (data) => emitOSC(data),
    // MIDI
    [Main.GET_MIDI_OUTPUTS]: () => getMidiOutputs(),
    [Main.GET_MIDI_INPUTS]: () => getMidiInputs(),
    [Main.SEND_MIDI]: (data) => {
        sendMidi(data)
    },
    [Main.RECEIVE_MIDI]: (data) => receiveMidi(data),
    [Main.CLOSE_MIDI]: (data) => closeMidiInPorts(data.id),
    // LYRICS
    [Main.GET_LYRICS]: (data) => getLyrics(data),
    [Main.SEARCH_LYRICS]: (data) => searchLyrics(data),
    // FILES
    [Main.RESTORE]: (data) => restoreFiles(data),
    [Main.SYSTEM_OPEN]: (data) => openSystemFolder(data),
    [Main.DOES_PATH_EXIST]: (data) => {
        let p = data.path
        if (p === "data_config") p = path.join(data.dataPath, dataFolderNames.userData)
        return { ...data, exists: doesPathExist(p) }
    },
    [Main.UPDATE_DATA_PATH]: () => {
        // updateDataPath({ ...data, load: true })
        let special = stores.SETTINGS.get("special")
        special.customUserDataLocation = true
        stores.SETTINGS.set("special", special)

        forceCloseApp()
    },
    [Main.LOCATE_MEDIA_FILE]: (data) => locateMediaFile(data),
    [Main.GET_SIMULAR]: (data) => getSimularPaths(data),
    [Main.BUNDLE_MEDIA_FILES]: (data) => bundleMediaFiles(data),
    [Main.FILE_INFO]: (data) => getFileInfo(data),
    [Main.READ_FOLDER]: (data) => getFolderContent(data),
    [Main.READ_FILE]: (data) => ({ content: readFile(data.path) }),
    [Main.OPEN_FOLDER]: (data) => selectFolder(data),
    [Main.OPEN_FILE]: (data) => selectFiles(data),
    // CONNECTION
    [Main.PCO_LOAD_SERVICES]: (data) => pcoLoadServices(data.dataPath),
    [Main.PCO_STARTUP_LOAD]: (data) => pcoStartupLoad(data.dataPath),
    [Main.PCO_DISCONNECT]: () => pcoDisconnect(),
}

//////////

// IMPORT
export function startImport(data: { channel: string; format: { name: string; extensions: string[] }; settings?: any }) {
    let files: string[] = selectFilesDialog("", data.format)

    let needsFileAndNoFileSelected = data.format.extensions && !files.length
    if (needsFileAndNoFileSelected) return

    importShow(data.channel, files || null, data.settings)
}

// BIBLE
export function loadScripture(msg: { id: string; path: string; name: string; data: any }) {
    let bibleFolder: string = getDataFolder(msg.path || "", dataFolderNames.scriptures)
    let p: string = path.join(bibleFolder, msg.name + ".fsb")

    let bible = loadFile(p, msg.id)

    // pre v0.5.6
    if (bible.error) p = path.join(app.getPath("documents"), "Bibles", msg.name + ".fsb")
    bible = loadFile(p, msg.id)

    if (msg.data) return { ...bible, data: msg.data }
    return bible
}

// SHOW
export function loadShow(msg: { id: string; path: string | null; name: string }) {
    let p: string = checkShowsFolder(msg.path || "")
    p = path.join(p, (msg.name || msg.id) + ".show")
    let show = loadFile(p, msg.id)

    return show
}

function getOS() {
    return { platform: os.platform(), name: os.hostname(), arch: os.arch() } as OS
}

// URL: open url in default web browser
export const openURL = (url: string) => {
    shell.openExternal(url)
    return
}

async function loadFonts() {
    const fonts = await getFonts()
    return { fonts }
}

async function searchLyrics({ artist, title }: { artist: string; title: string }) {
    const songs = await LyricSearch.search(artist, title)
    return songs
}

async function getLyrics({ song }: { song: LyricSearchResult }) {
    const lyrics = await LyricSearch.get(song)
    return { lyrics, source: song.source, title: song.title }
}

// GET DEVICE MEDIA PERMISSION
function getPermission(id: "camera" | "microphone" | "screen") {
    if (process.platform !== "darwin") return

    if (id === "screen") systemPreferences.getMediaAccessStatus(id)
    else systemPreferences.askForMediaAccess(id)
}

function getScreens(type: "window" | "screen" = "screen"): Promise<{ name: string; id: string }[]> {
    return new Promise((resolve) => {
        desktopCapturer.getSources({ types: [type] }).then((sources) => {
            let screens: { name: string; id: string }[] = []
            sources.map((source) => screens.push({ name: source.name, id: source.id }))
            if (type === "window") screens = addFreeShowWindows(screens, sources)

            resolve(screens)
        })
    })

    function addFreeShowWindows(screens: { name: string; id: string }[], sources: DesktopCapturerSource[]) {
        const windows: BrowserWindow[] = []
        OutputHelper.getAllOutputs().forEach(([_id, output]) => {
            if (output.window) windows.push(output.window)
        })
        ;[mainWindow!, ...windows].forEach((window) => {
            let mediaId = window?.getMediaSourceId()
            let windowsAlreadyExists = sources.find((a) => a.id === mediaId)
            if (windowsAlreadyExists) return

            screens.push({ name: window?.getTitle(), id: mediaId })
        })

        return screens
    }
}

// RECORDER
// only open once per session
let systemOpened: boolean = false
export function saveRecording(_: Electron.IpcMainEvent, msg: any) {
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
export function logError(log: ErrorLog, electron: boolean = false) {
    if (!isProd) log.dev = true

    let storedLog = error_log.store
    let key: "main" | "renderer" = electron ? "main" : "renderer"

    let previousLog = storedLog[key] || []
    previousLog.push(log)

    if (previousLog.length > maxLogLength) previousLog = previousLog.slice(previousLog.length - maxLogLength)
    if (!previousLog.length) return

    // error_log.clear()
    error_log.set({ [key]: previousLog })
}

const ERROR_FILTER = [
    "ENOENT: no such file or directory", // file/folder does not exist
]
export function catchErrors() {
    process.on("uncaughtException", (err) => {
        if (ERROR_FILTER.find((a) => err.message.includes(a))) return
        logError(createLog(err), true)
    })
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
    } as ErrorLog
}

// STORE MEDIA AS BASE64
// function storeMedia(files: { id: string; path: string }[]) {
//     let encodedFiles: { id: string; content: string }[] = []
//     files.forEach(({ id, path }) => {
//         let content = readFile(path, "base64")
//         encodedFiles.push({ id, content })
//     })
//     return encodedFiles
// }

// GET STORE VALUE (used in special cases - currently only disableHardwareAcceleration)
function getStoreValue(data: { file: "config" | keyof typeof stores; key: string }) {
    let store = data.file === "config" ? config : stores[data.file]
    return { ...data, value: (store as any).get(data.key) }
}

// GET STORE VALUE (used in special cases - currently only disableHardwareAcceleration)
function setStoreValue(data: { file: "config" | keyof typeof stores; key: string; value: any }) {
    let store = data.file === "config" ? config : stores[data.file]
    store.set(data.key, data.value)
}
