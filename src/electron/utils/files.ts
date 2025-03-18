// ----- FreeShow -----
// Functions to interact with local files

import { app, dialog, shell } from "electron"
import { ExifData, ExifImage } from "exif"
import fs, { type Stats } from "fs"
import path, { join, parse } from "path"
import { uid } from "uid"
import { MAIN, OUTPUT, SHOW } from "../../types/Channels"
import { ToMain } from "../../types/IPC/ToMain"
import type { MainFilePaths, Subtitle } from "../../types/Main"
import type { Show } from "../../types/Show"
import { imageExtensions, mimeTypes, videoExtensions } from "../data/media"
import { stores } from "../data/store"
import { createThumbnail } from "../data/thumbnails"
import { sendMain } from "../IPC/main"
import { OutputHelper } from "../output/OutputHelper"
import { mainWindow, toApp } from "./../index"
import { getAllShows, trimShow } from "./shows"

function actionComplete(err: Error | null, actionFailedMessage: string) {
    if (err) console.error(actionFailedMessage + ":", err)
}

// GENERAL

export function doesPathExist(path: string): boolean {
    try {
        return fs.existsSync(path)
    } catch (err: any) {
        actionComplete(err, "Error when checking path")
    }

    return false
}

export function readFile(path: string, encoding: BufferEncoding = "utf8", disableLog: boolean = false): string {
    try {
        return fs.readFileSync(path, encoding)
    } catch (err: any) {
        if (!disableLog) actionComplete(err, "Error when reading file")
        return ""
    }
}

export function readFolder(path: string): string[] {
    try {
        return fs.readdirSync(path)
    } catch (err: any) {
        actionComplete(err, "Error when reading folder")
        return []
    }
}

export function deleteFolder(path: string) {
    try {
        fs.rmSync(path, { recursive: true })
    } catch (err: any) {
        actionComplete(err, "Error when deleting folder")
    }
}

export function doesPathExistAsync(path: string): Promise<boolean> {
    return new Promise((resolve) => {
        fs.access(path, (err) => {
            if (err) resolve(false)
            resolve(true)
        })
    })
}

export function readFileAsync(path: string, encoding: BufferEncoding = "utf8"): Promise<string> {
    return new Promise((resolve) =>
        fs.readFile(path, (err, buffer) => {
            if (err) console.error(err)
            resolve(err ? "" : buffer.toString(encoding))
        })
    )
}

export function readFileBufferAsync(path: string): Promise<Buffer> {
    return new Promise((resolve) =>
        fs.readFile(path, (err, buffer) => {
            if (err) console.error(err)
            resolve(err ? Buffer.of(0) : buffer)
        })
    )
}

export function readFolderAsync(path: string): Promise<string[]> {
    return new Promise((resolve) =>
        fs.readdir(path, (err, files) => {
            if (err) console.error(err)
            resolve(err ? [] : files)
        })
    )
}

export function writeFile(path: string, content: string | NodeJS.ArrayBufferView, id: string = "") {
    // don't know if it's necessary to check the file
    if (fileContentMatches(content, path)) return

    fs.writeFile(path, content, (err) => {
        actionComplete(err, "Error when writing to file")
        if (err && id) toApp(SHOW, { error: "no_write", err, id })
    })
}

export function deleteFile(path: string) {
    fs.unlink(path, (err) => actionComplete(err, "Could not delete file"))
}

export function renameFile(p: string, oldName: string, newName: string) {
    let oldPath = path.join(p, oldName)
    let newPath = path.join(p, newName)

    fs.rename(oldPath, newPath, (err) => actionComplete(err, "Could not rename file"))
}

export function getFileStats(p: string, disableLog: boolean = false) {
    try {
        const stat: Stats = fs.statSync(p)
        return { path: p, stat, extension: path.extname(p).substring(1).toLowerCase(), folder: stat.isDirectory() }
    } catch (err) {
        if (!disableLog) actionComplete(err, "Error when getting file stats")
        return null
    }
}

export function makeDir(path: string) {
    try {
        path = fs.mkdirSync(path, { recursive: true }) || path
    } catch (err) {
        console.error("Could not create a directory to path: " + path + "! " + err)
        toApp(MAIN, { channel: "ALERT", data: "Error: Could not create folder at: " + path + "!" })
    }

    return path
}

// SELECT DIALOGS

export function selectFilesDialog(title: string = "", filters: any, multiple: boolean = true): string[] {
    let options: any = { properties: ["openFile"], filters: [{ name: filters.name, extensions: filters.extensions }] }
    if (title) options.title = title
    if (multiple) options.properties.push("multiSelections")

    let files: string[] = dialog.showOpenDialogSync(mainWindow!, options) || []
    return files
}

export function selectFolderDialog(title: string = "", defaultPath: string = ""): string {
    let options: any = { properties: ["openDirectory"] }
    if (title) options.title = title
    if (defaultPath) options.defaultPath = defaultPath

    let path: string[] = dialog.showOpenDialogSync(mainWindow!, options) || [""]
    return path[0]
}

// DATA FOLDERS

export function openSystemFolder(path: string) {
    if (!doesPathExist(path)) return toApp(MAIN, { channel: "ALERT", data: "This does not exist!" })

    shell.openPath(path)
}

const appFolderName = "FreeShow"
export function getDocumentsFolder(p: any = null, folderName: string = "Shows", createFolder: boolean = true): string {
    let folderPath = [app.getPath("documents"), appFolderName]
    if (folderName) folderPath.push(folderName)
    if (!p) p = path.join(...folderPath)
    if (!doesPathExist(p) && createFolder) p = makeDir(p)

    return p
}

export function checkShowsFolder(path: string): string {
    if (!path) {
        path = getDocumentsFolder()
        toApp(MAIN, { channel: "SHOWS_PATH", data: path })
        return path
    }

    if (doesPathExist(path)) return path

    return makeDir(path)
}

export const dataFolderNames = {
    shows: "Shows",
    backups: "Backups",
    scriptures: "Bibles",
    media_bundle: "Media",
    exports: "Exports",
    imports: "Imports",
    lessons: "Lessons",
    planningcenter: "Planning Center",
    recordings: "Recordings",
    userData: "Config",
}

// DATA PATH
export function getDataFolder(dataPath: string, name: string) {
    if (!dataPath) return getDocumentsFolder(null, name)
    return createFolder(path.join(dataPath, name))
}

// HELPERS

export function getExtension(name: string) {
    return path.extname(name).substring(1).toLowerCase()
}

export function createFolder(path: string) {
    if (doesPathExist(path)) return path
    return makeDir(path)
}

// 2025-01-21_15-59
export function getTimePointString() {
    const date = new Date()
    let name = date.toISOString()
    name = name.slice(0, name.indexOf("T"))
    name += `_${("0" + date.getHours()).slice(-2)}-${("0" + date.getMinutes()).slice(-2)}`

    return name
}

export function fileContentMatches(content: string | NodeJS.ArrayBufferView, path: string): boolean {
    if (doesPathExist(path) && content === readFile(path)) return true
    return false
}

export function loadFile(p: string, contentId: string = ""): any {
    if (!doesPathExist(p)) return { error: "not_found", id: contentId }

    let content: string = readFile(p)
    if (!content) return { error: "not_found", id: contentId }

    let show = parseShow(content)
    if (!show) return { error: "not_found", id: contentId }

    if (contentId && show[0] !== contentId) show[0] = contentId

    return { id: contentId, content: show }
}

export function getPaths() {
    let paths: MainFilePaths = {
        // documents: app.getPath("documents"),
        pictures: app.getPath("pictures"),
        videos: app.getPath("videos"),
        music: app.getPath("music"),
    }

    // this will create "documents/Shows" folder if it doesen't exist
    // paths.shows = getDocumentsFolder()

    return paths
}

const tempPaths = ["temp"]
export function getTempPaths() {
    let paths: { [key: string]: string } = {}
    tempPaths.forEach((pathId: any) => {
        paths[pathId] = app.getPath(pathId)
    })

    return paths
}

// READ_FOLDER
export function getFolderContent(data: { path: string; disableThumbnails?: boolean; listFilesInFolders?: boolean }) {
    let folderPath: string = data.path
    let fileList: string[] = readFolder(folderPath)

    if (!fileList.length) {
        return { path: folderPath, files: [], filesInFolders: [], folderFiles: {} }
    }

    let files: any[] = []
    for (const name of fileList) {
        let p: string = path.join(folderPath, name)
        let stats: any = getFileStats(p)
        if (stats) files.push({ ...stats, name, thumbnailPath: !data.disableThumbnails && isMedia() ? createThumbnail(p) : "" })

        function isMedia() {
            if (stats.folder) return false
            return [...imageExtensions, ...videoExtensions].includes(stats.extension.toLowerCase())
        }
    }

    if (!files.length) {
        return { path: folderPath, files: [], filesInFolders: [], folderFiles: {} }
    }

    // get first "layer" of files inside folder for searching
    let filesInFolders: string[] = []
    let folderFiles: { [key: string]: any[] } = {}
    if (data.listFilesInFolders) {
        let folders: any[] = files.filter((a) => a.folder)
        folders.forEach(getFilesInFolder)
    }

    function getFilesInFolder(folder: any) {
        let fileList: string[] = readFolder(folder.path)
        folderFiles[folder.path] = []
        if (!fileList.length) return

        for (const name of fileList) {
            let p: string = path.join(folder.path, name)
            let stats: any = getFileStats(p)
            if (!stats) return

            if (!stats.folder) filesInFolders.push({ ...stats, name })
            folderFiles[folder.path].push({ ...stats, name })
        }
    }

    return { path: folderPath, files, filesInFolders, folderFiles }
}

export function getSimularPaths(data: { paths: string[] }) {
    let parentFolderPathNames = data.paths.map(getParentFolderName)
    let allFilePaths = parentFolderPathNames.map((parentPath: string) => readFolder(parentPath).map((a) => join(parentPath, a)))
    const filteredFilePaths = [...new Set(allFilePaths.flat())]

    let simularArray: any[] = []
    data.paths.forEach((path: string) => {
        let originalFileName = parse(path).name

        filteredFilePaths.forEach((filePath: string) => {
            let name = parse(filePath).name
            if (data.paths.includes(filePath) || simularArray.find((a) => a[0].name.includes(name))) return

            let match = similarity(originalFileName, name)
            if (match < 0.5) return

            simularArray.push([{ path: filePath, name }, match])
        })
    })

    simularArray = simularArray.sort((a, b) => b[1] - a[1])
    simularArray = simularArray.slice(0, 10).map((a) => a[0])

    return simularArray
}
function getParentFolderName(path: string) {
    return parse(path).dir
}
function similarity(str1: string, str2: string) {
    function levenshteinDistance(s1: string, s2: string) {
        const m = s1.length
        const n = s2.length
        const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

        for (let i = 0; i <= m; i++) {
            for (let j = 0; j <= n; j++) {
                if (i === 0) {
                    dp[i][j] = j
                } else if (j === 0) {
                    dp[i][j] = i
                } else {
                    dp[i][j] = s1[i - 1] === s2[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
                }
            }
        }

        return dp[m][n]
    }

    const distance = levenshteinDistance(str1, str2)
    const maxLength = Math.max(str1.length, str2.length)
    const matchPercentage = 1 - distance / maxLength

    return matchPercentage
}

// OPEN_FOLDER
export function selectFolder(msg: { channel: string; title: string | undefined; path: string | undefined }) {
    let folder: any = selectFolderDialog(msg.title, msg.path)

    if (!folder) return

    // only when initializing
    if (msg.channel === "DATA_SHOWS") {
        let dataPath = folder
        let showsPath = checkShowsFolder(path.join(folder, dataFolderNames.shows))
        sendMain(ToMain.OPEN_FOLDER2, { channel: msg.channel, path: dataPath, showsPath })
        return
    }

    if (msg.channel === "SHOWS") {
        loadShows({ showsPath: folder })
        toApp(MAIN, { channel: "FULL_SHOWS_LIST", data: getAllShows({ path: folder }) })
    }

    sendMain(ToMain.OPEN_FOLDER2, { channel: msg.channel, path: folder })
    return
}

// OPEN_FILE
export function selectFiles(msg: { id: string; channel: string; title?: string; filter: any; multiple: boolean; read?: boolean }) {
    let files: any = selectFilesDialog(msg.title, msg.filter, msg.multiple === undefined ? true : msg.multiple)
    if (!files) return

    let content: { [key: string]: string } = {}
    if (msg.read) files.forEach(getContent)
    function getContent(path: string) {
        content[path] = readFile(path)
    }

    sendMain(ToMain.OPEN_FILE2, { channel: msg.channel, id: msg.id, files, content })
    return
}

// FILE_INFO
export function getFileInfo(filePath: string) {
    let stats = getFileStats(filePath)
    return stats
}

// READ EXIF
export function readExifData({ id }: { id: string }): Promise<{ id: string; exif: ExifData }> {
    return new Promise((resolve) => {
        try {
            new ExifImage({ image: id }, (err, exifData) => {
                actionComplete(err, "Error getting EXIF data")
                if (!err) resolve({ id, exif: exifData })
            })
        } catch (err) {
            actionComplete(err, "Error loading EXIF image")
        }
    })
}

// GET MEDIA CODEC
export function getMediaCodec(data: { path: string }) {
    extractCodecInfo(data)
}

async function extractCodecInfo(data: { path: string }) {
    const MP4Box = require("mp4box")
    let arrayBuffer: any

    try {
        arrayBuffer = new Uint8Array(fs.readFileSync(data.path)).buffer
    } catch (err) {
        console.error(err)
        toApp(MAIN, { channel: "MEDIA_CODEC", data: { ...data, codecs: [], mimeType: getMimeType(data.path), mimeCodec: "" } })
        return
    }

    const mp4boxfile = MP4Box.createFile()
    mp4boxfile.onError = (e: Error) => console.error("MP4Box error:", e)
    mp4boxfile.onReady = (info: any) => {
        const codecs = info.tracks.map((track: any) => track.codec)
        const mimeType = getMimeType(data.path)
        const mimeCodec = `${mimeType}; codecs="${codecs.join(", ")}"`
        toApp(MAIN, { channel: "MEDIA_CODEC", data: { ...data, codecs, mimeType, mimeCodec } })
    }

    arrayBuffer.fileStart = 0
    mp4boxfile.appendBuffer(arrayBuffer)
    mp4boxfile.flush()
}

function getMimeType(path: string) {
    const ext = path.split(".").pop()?.toLowerCase() || ""
    return mimeTypes[ext] || ""
}

// get embedded subtitles/captions
export function getMediaTracks(data: { path: string }) {
    return extractSubtitles(data)
}

async function extractSubtitles(data: { path: string }): Promise<{ path: string; tracks: Subtitle[] }> {
    const MP4Box = require("mp4box")
    let arrayBuffer: any

    try {
        arrayBuffer = new Uint8Array(fs.readFileSync(data.path)).buffer
    } catch (err) {
        console.error(err)
        return { ...data, tracks: [] }
    }

    return new Promise((resolve) => {
        const mp4boxfile = MP4Box.createFile()
        mp4boxfile.onError = (e: Error) => console.error("MP4Box error:", e)
        mp4boxfile.onReady = (info: any) => {
            let tracks: Subtitle[] = []
            let trackCount: number = 0
            let completed: number = 0
            info.tracks.forEach((track: any) => {
                if (track.type !== "subtitles" && track.type !== "text") {
                    resolve({ ...data, tracks: [] })
                    return
                }
                trackCount++

                // console.log(`Found subtitle track ID ${track.id}, language: ${track.language}`)
                const vttLines = ["WEBVTT\n"]
                const timescale = track.timescale

                mp4boxfile.setExtractionOptions(track.id, null, { nbSamples: track.nb_samples })
                mp4boxfile.start()

                mp4boxfile.onSamples = (_id: number, _user: any, samples: any[]) => {
                    let index = 1
                    samples.forEach((sample) => {
                        const utf8Decoder = new TextDecoder("utf-8")
                        let subtitleText = utf8Decoder.decode(sample.data).trim()
                        // remove any non-printable characters (excluding line breaks)
                        subtitleText = subtitleText.replace(/[^\x20-\x7E\n\r]+/g, "")
                        if (!subtitleText) {
                            resolve({ ...data, tracks: [] })
                            return
                        }

                        const startTime = formatTimestamp((sample.cts / timescale) * 1000)
                        const endTime = formatTimestamp(((sample.cts + sample.duration) / timescale) * 1000)

                        vttLines.push(`${index}`)
                        vttLines.push(`${startTime} --> ${endTime}`)
                        vttLines.push(`${subtitleText}\n`)

                        index++
                    })

                    completed++
                    if (vttLines.length > 1) tracks.push({ lang: track.language?.slice(0, 2), name: track.language || "", vtt: vttLines.join("\n"), embedded: true })
                    if (completed === trackCount) resolve({ ...data, tracks })
                }
            })
        }

        arrayBuffer.fileStart = 0
        mp4boxfile.appendBuffer(arrayBuffer)
        mp4boxfile.flush()
    })
}

// format timestamp in WebVTT format (HH:MM:SS.mmm)
function formatTimestamp(timestamp: number) {
    const hours = Math.floor(timestamp / 3600000)
    const minutes = Math.floor((timestamp % 3600000) / 60000)
    const seconds = Math.floor((timestamp % 60000) / 1000)
    const milliseconds = Math.floor(timestamp % 1000)

    const formatted = [hours.toString().padStart(2, "0"), minutes.toString().padStart(2, "0"), seconds.toString().padStart(2, "0") + "." + milliseconds.toString().padStart(3, "0")].join(":")
    return formatted
}

//////

// SEARCH FOR MEDIA FILE (in drawer media folders & their following folders)
const NESTED_SEARCH = 8 // folder levels deep
export async function locateMediaFile({ fileName, splittedPath, folders, ref }: { fileName: string; splittedPath: string[]; folders: string[]; ref: { showId: string; mediaId: string; cloudId: string } }) {
    let matches: string[] = []

    await findMatches()
    if (!matches.length) return

    return { path: matches[0], ref }

    async function findMatches() {
        for (const folderPath of folders) {
            // if (matches.length > 1) return // this might be used if we want the user to choose if more than one match is found
            if (matches.length) return
            await searchInFolder(folderPath)
        }
    }

    async function searchInFolder(folderPath: string, level: number = 1) {
        if (level > NESTED_SEARCH || matches.length) return

        let currentFolderFolders: string[] = []
        let files = await readFolderAsync(folderPath)

        await Promise.all(
            files.map(async (name) => {
                let currentFilePath: string = path.join(folderPath, name)
                let isFolder = await checkIsFolder(currentFilePath)

                if (isFolder) {
                    // search all files in current folder before searching in any nested folders
                    currentFolderFolders.push(currentFilePath)
                } else {
                    checkFileForMatch(name, folderPath)
                    if (matches.length) return
                }
            })
        )

        if (matches.length) return

        await Promise.all(
            currentFolderFolders.map(async (folderName) => {
                await searchInFolder(folderName, level + 1)
                if (matches.length) return
            })
        )
    }

    function checkFileForMatch(currentFileName: string, folderPath: string) {
        // include original parent folder name in search first (to limit it a bit if two files with same name are in two different folders!)
        if (splittedPath?.length > 1) {
            let currentParentFolder = path.basename(folderPath)
            let pathName = path.join(currentParentFolder, currentFileName)
            let searchName = path.join(splittedPath[splittedPath.length - 2], fileName)
            if (pathName === searchName) {
                let p: string = path.join(folderPath, currentFileName)
                matches.push(p)
            }
        }

        if (matches.length) return

        // check for file name exact match
        if (currentFileName === fileName) {
            let p: string = path.join(folderPath, currentFileName)
            matches.push(p)
        }
    }
}

async function checkIsFolder(path: string): Promise<boolean> {
    return new Promise((resolve) =>
        fs.stat(path, (err, stats) => {
            resolve(err ? false : stats.isDirectory())
        })
    )
}

//////

// BUNDLE MEDIA FILES FROM ALL SHOWS (IMAGE/VIDEO/AUDIO)
let currentlyBundling: boolean = false
export function bundleMediaFiles({ showsPath, dataPath }: { showsPath: string; dataPath: string }) {
    if (currentlyBundling) return
    currentlyBundling = true

    let showsList = readFolder(showsPath)
    showsList = showsList
        .filter((name) => name.toLowerCase().endsWith(".show")) // only .show files
        .filter((trimmedName) => trimmedName) // remove files with no name

    let allMediaFiles: string[] = []

    for (const name of showsList) readShow(name)
    function readShow(fileName: string) {
        let p: string = path.join(showsPath, fileName)
        let jsonData = readFile(p) || "{}"
        let show: Show | undefined = parseShow(jsonData)?.[1]

        if (!show) return

        // media backgrounds & audio
        Object.values(show.media).forEach((media) => {
            let path = media.path || media.id
            if (path) allMediaFiles.push(path)
        })

        // WIP also copy media item paths? (only when it's supported by the auto find feature)
    }

    // remove duplicates
    allMediaFiles = [...new Set(allMediaFiles)]
    if (!allMediaFiles.length) {
        currentlyBundling = false
        return
    }

    // get/create new folder
    let outputPath = getDataFolder(dataPath, dataFolderNames.media_bundle)

    // copy media files
    allMediaFiles.forEach((mediaPath) => {
        let fileName = path.basename(mediaPath)
        let newPath = path.join(outputPath, fileName)

        // don't copy if it's already copied
        if (doesPathExist(newPath)) return

        fs.copyFile(mediaPath, newPath, (err) => {
            if (err) console.error("Could not copy: " + mediaPath + "! File might not exist.")
        })
    })

    // open folder
    openSystemFolder(outputPath)
    currentlyBundling = false
}

// LOAD SHOWS

export function loadShows({ showsPath }: any, returnShows: boolean = false) {
    if (!showsPath) {
        console.log("Invalid shows path, does the program have proper read/write permission?")
        return {}
    }

    specialCaseFixer()

    // check if Shows folder exist
    // makeDir(showsPath)
    if (!doesPathExist(showsPath)) return {}

    // list all shows in folder
    let filesInFolder: string[] = readFolder(showsPath)

    let cachedShows: { [key: string]: any } = stores.SHOWS.store || {}
    let newCachedShows: any = {}

    // create a map for quick lookup of cached shows by name
    let cachedShowNames = new Map<string, string>()
    for (const [id, show] of Object.entries(cachedShows)) {
        if (show?.name) cachedShowNames.set(show.name, id)
    }

    filesInFolder = filesInFolder
        .filter((name) => name.toLowerCase().endsWith(".show"))
        .map((name) => name.slice(0, -5)) // remove .show extension
        .filter((trimmedName) => trimmedName) // remove files with no name

    for (const name of filesInFolder) checkShow(name)
    function checkShow(name: string) {
        let matchingShowId = cachedShowNames.get(name)
        if (matchingShowId && !newCachedShows[matchingShowId]) {
            newCachedShows[matchingShowId] = cachedShows[matchingShowId]
            return
        }

        let p: string = path.join(showsPath, `${name}.show`)
        let jsonData = readFile(p) || "{}"
        let show = parseShow(jsonData)

        if (!show || !show[1]) return

        let id = show[0]
        // some old duplicated shows might have the same id
        if (newCachedShows[id]) id = uid()

        newCachedShows[id] = trimShow({ ...show[1], name })
    }

    if (returnShows) return newCachedShows

    // save this (for cloud sync)
    stores.SHOWS.clear()
    stores.SHOWS.set(newCachedShows)

    return newCachedShows
}

export function parseShow(jsonData: string) {
    let show: [string, Show] | null = null

    try {
        show = JSON.parse(jsonData)
    } catch (error) {
        // try to fix broken files
        jsonData = jsonData.slice(0, jsonData.indexOf("}}]") + 3)

        // try again
        try {
            show = JSON.parse(jsonData)
        } catch (err) {
            console.error("Error parsing show")
        }
    }

    return show
}

// load shows by id (used for show export)
export function getShowsFromIds(showIds: string[], showsPath: string) {
    let shows: Show[] = []
    let cachedShows: { [key: string]: any } = stores.SHOWS.store || {}

    showIds.forEach((id) => {
        let cachedShow = cachedShows[id]
        if (!cachedShow) return

        let fileName = cachedShow.name || id

        let p: string = path.join(showsPath, `${fileName}.show`)
        let jsonData = readFile(p) || "{}"
        let show = parseShow(jsonData)

        if (show?.[1]) shows.push({ ...show[1], id })
    })

    return shows
}

// some users might have got themselves in a situation they can't get out of
// example: enables "kiosk" mode on mac might have resulted in a black screen, and they can't find the app data location to revert it!
// how: Place any file in your Documents/FreeShow folder that has the FIXES key in it's name (e.g. DISABLE_KIOSK_MODE), when you now start your app the fix will be triggered!
const FIXES: any = {
    DISABLE_KIOSK_MODE: () => {
        // wait to ensure output settings have loaded in the app!
        setTimeout(() => {
            toApp(OUTPUT, { channel: "UPDATE_OUTPUTS_DATA", data: { key: "kioskMode", value: false, autoSave: true } })
            OutputHelper.getAllOutputs().forEach(([_id, output]) => output.window.setKiosk(false))
        }, 1000)
    },
    OPEN_APPDATA_SETTINGS: () => {
        // this will open the "settings.json" file located at the app data location (can also be used to find other setting files here)
        openSystemFolder(stores.SETTINGS.path)
    },
}
function specialCaseFixer() {
    let defaultDataFolder = getDocumentsFolder(null, "", false)
    if (!doesPathExist(defaultDataFolder)) return

    let files: string[] = readFolder(defaultDataFolder)
    files.forEach((fileName) => {
        let matchFound = Object.keys(FIXES).find((key) => fileName.includes(key))
        if (matchFound) FIXES[matchFound]()
    })
}
