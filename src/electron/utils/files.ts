// ----- FreeShow -----
// Functions to interact with local files

import { app, dialog, shell } from "electron"
import type { ExifData } from "exif"
import { ExifImage } from "exif"
import fs, { type Stats } from "fs"
import path, { join, parse } from "path"
import { uid } from "uid"
import upath from "upath"
import { OUTPUT } from "../../types/Channels"
import { Main } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"
import type { FileFolder, MainFilePaths, Subtitle } from "../../types/Main"
import type { Project } from "../../types/Projects"
import type { Item, Show, TrimmedShows } from "../../types/Show"
import { imageExtensions, mimeTypes, videoExtensions } from "../data/media"
import { _store, appDataPath, config, getStore, setStore, setStoreValue } from "../data/store"
import { createThumbnail, filePathHashCode } from "../data/thumbnails"
import { sendMain, sendToMain } from "../IPC/main"
import { OutputHelper } from "../output/OutputHelper"
import { mainWindow, setAutoProfile, toApp } from "./../index"
import { getAllShows, trimShow } from "./shows"

function actionComplete(err: Error | null, actionFailedMessage: string) {
    if (err) console.error(actionFailedMessage + ":", err)
}

// GENERAL

export function doesPathExist(filePath: string): boolean {
    if (!filePath) return false

    try {
        return fs.existsSync(filePath)
    } catch (err) {
        actionComplete(err as Error, "Error when checking path")
    }

    return false
}

export function readFile(filePath: string, encoding: BufferEncoding = "utf8", disableLog = false): string {
    try {
        return fs.readFileSync(filePath, encoding)
    } catch (err) {
        if (!disableLog) actionComplete(err as Error, "Error when reading file")
        return ""
    }
}

export function readFolder(filePath: string): string[] {
    try {
        return fs.readdirSync(filePath)
    } catch (err) {
        actionComplete(err as Error, "Error when reading folder")
        return []
    }
}

export function deleteFolder(filePath: string) {
    if (!filePath) return
    try {
        fs.rmSync(filePath, { recursive: true })
    } catch (err) {
        actionComplete(err as Error, "Error when deleting folder")
    }
}

export function doesPathExistAsync(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
        fs.access(filePath, (err) => {
            if (err) resolve(false)
            resolve(true)
        })
    })
}

export function readFileAsync(filePath: string, encoding: BufferEncoding = "utf8"): Promise<string> {
    return new Promise((resolve) =>
        fs.readFile(filePath, (err, buffer) => {
            if (err) console.error(err)
            resolve(err ? "" : buffer.toString(encoding))
        })
    )
}

export function readFileBufferAsync(filePath: string): Promise<Buffer> {
    return new Promise((resolve) =>
        fs.readFile(filePath, (err, buffer) => {
            if (err) console.error(err)
            resolve(err ? Buffer.of(0) : buffer)
        })
    )
}

export function readFolderAsync(filePath: string): Promise<string[]> {
    return new Promise((resolve) =>
        fs.readdir(filePath, (err, files) => {
            if (err) console.error(err)
            resolve(err ? [] : files)
        })
    )
}

export async function writeFileAsync(filePath: string, content: string | NodeJS.ArrayBufferView, id = ""): Promise<boolean> {
    // don't know if it's necessary to check the file
    if (await fileContentMatchesAsync(content, filePath)) return false

    return new Promise((resolve) => {
        fs.writeFile(filePath, content, (err) => {
            actionComplete(err, "Error when writing to file")
            if (err && id) sendToMain(ToMain.SHOW2, { error: "no_write", err, id })
            resolve(!err)
        })
    })
}

export function writeFile(filePath: string, content: string | NodeJS.ArrayBufferView, id = "") {
    // don't know if it's necessary to check the file
    if (fileContentMatches(content, filePath)) return false

    try {
        fs.writeFileSync(filePath, content)
        return true
    } catch (err) {
        actionComplete(err as Error, "Error when writing to file")
        if (id) sendToMain(ToMain.SHOW2, { error: "no_write", err: err as Error, id })
        return false
    }
}

export function deleteFile(filePath: string) {
    fs.unlinkSync(filePath)
}

// export function deleteFileAsync(filePath: string) {
//     return new Promise<boolean>((resolve) => {
//         fs.unlink(filePath, (err) => {
//             actionComplete(err, "Could not delete file")
//             resolve(!err)
//         })
//     })
// }

export function copyFileAsync(sourcePath: string, destPath: string) {
    return new Promise<boolean>((resolve) => {
        fs.copyFile(sourcePath, destPath, (err) => {
            actionComplete(err, "Could not copy file")
            resolve(!err)
        })
    })
}

export function moveFileAsync(oldPath: string, newPath: string) {
    return new Promise<boolean>((resolve) => {
        fs.rename(oldPath, newPath, (err) => {
            actionComplete(err, "Could not rename file")
            resolve(!err)
        })
    })
}

export async function renameFileAsync(filePath: string, oldName: string, newName: string) {
    const oldPath = path.join(filePath, oldName)
    const newPath = path.join(filePath, newName)

    return await moveFileAsync(oldPath, newPath)
}

export function getFileStats(filePath: string, disableLog = false) {
    try {
        const stat: Stats = fs.statSync(filePath)
        return { path: filePath, stat, extension: path.extname(filePath).substring(1).toLowerCase(), folder: stat.isDirectory() }
    } catch (err) {
        if (!disableLog) actionComplete(err as Error, "Error when getting file stats")
        return null
    }
}

export function getFileStatsAsync(filePath: string): Promise<null | Stats> {
    return new Promise((resolve) => {
        fs.stat(filePath, (err, stats) => {
            if (err) return resolve(null)
            resolve(stats)
        })
    })
}

export function makeDir(folderPath: string) {
    try {
        fs.mkdirSync(folderPath, { recursive: true })
    } catch (err) {
        console.error("Could not create a directory to path: " + folderPath + "! " + String(err))
        sendToMain(ToMain.ALERT, "Error: Could not create folder at: " + folderPath + "!")
    }
}

export function getValidFileName(filePath: string) {
    return filePath
        .replace(/[/\\?%*:|"<>]/g, "")
        .replace(/\s+/g, " ")
        .trim()
}

// SELECT DIALOGS

export function selectFilesDialog(title = "", filters: Electron.FileFilter, multiple = true, initialPath: string = ""): string[] {
    // crashes if empty in electron v37
    if (!filters.extensions?.length) filters.extensions = ["*"]

    const options: Electron.OpenDialogSyncOptions = { properties: ["openFile"], filters: [{ name: filters.name, extensions: filters.extensions }] }
    if (title) options.title = title
    if (multiple) options.properties!.push("multiSelections")
    if (initialPath) options.defaultPath = initialPath

    const files: string[] = dialog.showOpenDialogSync(mainWindow!, options) || []
    return files
}

export function selectFolderDialog(title = "", defaultPath = ""): string {
    const options: Electron.OpenDialogSyncOptions = { properties: ["openDirectory"] }
    if (title) options.title = title
    if (defaultPath) options.defaultPath = defaultPath

    const folderPaths: string[] = dialog.showOpenDialogSync(mainWindow!, options) || [""]
    return folderPaths[0]
}

// DATA FOLDERS

export function openInSystem(filePath: string, openFolder = false) {
    if (!doesPathExist(filePath)) return sendToMain(ToMain.ALERT, "This does not exist!")

    if (openFolder) shell.openPath(filePath).catch((err) => console.error("Could not open system folder: " + String(err)))
    else shell.showItemInFolder(filePath)
}

export const dataFolderNames = {
    shows: "Shows",
    backups: "Backups",
    scriptures: "Bibles",
    onlineMedia: "Online",
    media: "Media",
    exports: "Exports",
    imports: "Imports",
    lessons: "Lessons",
    planningcenter: "Planning Center",
    recordings: "Recordings",
    audio: "Audio",
    userData: "Config",
    cloud: "Cloud"
}

// Documents/FreeShow
export function getDefaultDataFolderRoot() {
    const documentsPath = getMediaFolderPath("documents")
    if (!documentsPath) return appDataPath

    const appFolderName = "FreeShow"
    return createFolder(path.join(documentsPath, appFolderName))
}
export function getDataFolderRoot() {
    return config.get("dataPath") || getDefaultDataFolderRoot()
}

export function getDataFolderPath(id: keyof typeof dataFolderNames, subfolder?: string) {
    let folderPath = path.join(getDataFolderRoot(), dataFolderNames[id])
    if (subfolder) folderPath = path.join(folderPath, subfolder)
    return createFolder(folderPath)
}

// HELPERS

export function getExtension(name: string) {
    return path.extname(name).substring(1).toLowerCase()
}

export function createFolder(folderPath: string) {
    if (doesPathExist(folderPath)) return folderPath
    makeDir(folderPath)
    return folderPath
}

// 2025-01-21_15-59
export function getTimePointString() {
    const date = new Date()
    let name = date.toISOString()
    name = name.slice(0, name.indexOf("T"))
    name += `_${date.getHours().toString().padStart(2, "0")}-${date.getMinutes().toString().padStart(2, "0")}`

    return name
}

export async function fileContentMatchesAsync(content: string | NodeJS.ArrayBufferView, filePath: string) {
    if ((await doesPathExistAsync(filePath)) && content === (await readFileAsync(filePath))) return true
    return false
}

export function fileContentMatches(content: string | NodeJS.ArrayBufferView, filePath: string): boolean {
    if (doesPathExist(filePath) && content === readFile(filePath)) return true
    return false
}

export function loadFile(filePath: string, contentId = "") {
    if (!doesPathExist(filePath)) return { error: "not_found", id: contentId }

    const content: string = readFile(filePath)
    if (!content) return { error: "not_found", id: contentId }

    const show = parseJSON(content)
    if (!show) return { error: "not_found", id: contentId }

    if (contentId && show[0] !== contentId) show[0] = contentId

    return { id: contentId, content: show }
}

export function getPaths() {
    const paths: MainFilePaths = {
        // documents: getMediaFolderPath("documents"),
        pictures: getMediaFolderPath("pictures"),
        videos: getMediaFolderPath("videos"),
        music: getMediaFolderPath("music")
    }

    return paths
}
function getMediaFolderPath(name: Parameters<typeof app.getPath>[0]): string {
    try {
        return app.getPath(name)
    } catch (err) {
        console.warn(`Failed to get '${name}' path:`, err)
        return ""
    }
}

// READ_FOLDER
export async function readFolderContent(data: { path: string | string[]; depth?: number; generateThumbnails?: boolean; captureFolderContent?: boolean }) {
    let folderContent = new Map<string, FileFolder>()

    if (!Array.isArray(data.path)) data.path = [data.path]
    if (data.depth === undefined) data.depth = 0

    await Promise.all(
        data.path.map(async (folderPath) => {
            const stats = await getFileStatsAsync(folderPath)
            if (!stats?.isDirectory()) return

            await getFolderContentRecursive(folderPath)
        })
    )

    async function getFolderContentRecursive(folderPath: string, currentDepth: number = 0) {
        let exceededDepth = currentDepth > data.depth!
        if ((data.captureFolderContent && currentDepth < 2 ? false : exceededDepth) || folderContent.has(folderPath)) {
            let filePaths: string[] = []
            if (currentDepth === 1) {
                const fileList = await readFolderAsync(folderPath)
                filePaths = fileList.map((name) => path.join(folderPath, name))
            }

            folderContent.set(folderPath, { isFolder: true, path: folderPath, name: path.basename(folderPath), files: filePaths })
            return
        }

        const fileList = await readFolderAsync(folderPath)
        const filePaths: string[] = fileList.map((name) => path.join(folderPath, name))

        let captureThumbnailPaths = data.captureFolderContent && currentDepth === 1 ? getFirstMediaFiles(filePaths, 4) : []
        let currentPaths = data.captureFolderContent && exceededDepth ? captureThumbnailPaths : filePaths

        await Promise.all(
            currentPaths.map(async (filePath) => {
                const stats = await getFileStatsAsync(filePath)
                if (!stats) return

                if (stats.isDirectory()) {
                    await getFolderContentRecursive(filePath, currentDepth + 1)
                } else {
                    let thumbnailPath = ""
                    if (captureThumbnailPaths.includes(filePath) || (data.generateThumbnails && currentDepth === 0 && isMedia(path.extname(filePath).substring(1)))) {
                        try {
                            thumbnailPath = createThumbnail(filePath)
                        } catch (err) {
                            console.error("Thumbnail creation failed:", err)
                        }
                    }

                    folderContent.set(filePath, { isFolder: false, path: filePath, name: path.basename(filePath), thumbnailPath, stats })
                }
            })
        )

        folderContent.set(folderPath, { isFolder: true, path: folderPath, name: path.basename(folderPath), files: filePaths })
    }

    return Object.fromEntries(folderContent)
}

function isMedia(extension: string) {
    return [...imageExtensions, ...videoExtensions].includes(extension.toLowerCase())
}

function getFirstMediaFiles(paths: string[], count: number) {
    return paths.filter((filePath: string) => isMedia(path.extname(filePath).substring(1))).slice(0, count)
}

export function getSimularPaths(data: { paths: string[] }) {
    const parentFolderPathNames = data.paths.map(getParentFolderName)
    const allFilePaths = parentFolderPathNames.map((parentPath: string) => readFolder(parentPath).map((a) => join(parentPath, a)))
    const filteredFilePaths = [...new Set(allFilePaths.flat())]

    let similarArray: [{ path: string; name: string }, number][] = []
    data.paths.forEach((originalFilePath: string) => {
        const originalFileName = parse(originalFilePath).name

        filteredFilePaths.forEach((filePath: string) => {
            const name = parse(filePath).name
            if (data.paths.includes(filePath) || similarArray.find((a) => a[0].name.includes(name))) return

            const match = similarity(originalFileName, name)
            if (match < 0.5) return

            similarArray.push([{ path: filePath, name }, match])
        })
    })

    similarArray = similarArray.sort((a, b) => b[1] - a[1])
    const sortedSimularArray = similarArray.slice(0, 10).map((a) => a[0])

    return sortedSimularArray
}
function getParentFolderName(filePath: string) {
    return parse(filePath).dir
}
function similarity(str1: string, str2: string) {
    function levenshteinDistance(s1: string, s2: string) {
        const m = s1.length
        const n = s2.length
        const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[])

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
export function selectFolder(msg: { channel: string; title?: string; path?: string }) {
    const folder = selectFolderDialog(msg.title, msg.path)
    if (!folder) return

    if (msg.channel === "SHOWS") {
        sendMain(Main.FULL_SHOWS_LIST, getAllShows())
        sendMain(Main.SHOWS, loadShows())
    }

    sendToMain(ToMain.OPEN_FOLDER2, { channel: msg.channel, path: folder })
    return
}

// OPEN_FILE
export function selectFiles(msg: { id: string; channel: string; title?: string; filter: Electron.FileFilter; multiple: boolean; read?: boolean }) {
    const files = selectFilesDialog(msg.title, msg.filter, msg.multiple === undefined ? true : msg.multiple)
    if (!files) return

    const content: { [key: string]: string } = {}
    if (msg.read) files.forEach(getContent)
    function getContent(filePath: string) {
        content[filePath] = readFile(filePath)
    }

    sendToMain(ToMain.OPEN_FILE2, { channel: msg.channel, id: msg.id, files, content })
    return
}

// FILE_INFO
export function getFileInfo(filePath: string) {
    const stats = getFileStats(filePath)
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
            actionComplete(err as Error, "Error loading EXIF image")
        }
    })
}

// GET MEDIA CODEC
export async function getMediaCodec(data: { path: string }) {
    return await extractCodecInfo(data)
}

async function extractCodecInfo(data: { path: string }): Promise<{ path: string; codecs: string[]; mimeType: string; mimeCodec: string }> {
    const MP4Box = require("mp4box")

    return new Promise((resolve) => {
        try {
            const buffer = fs.readFileSync(data.path)
            const uint8Array = new Uint8Array(buffer)
            const arrayBuffer: any = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength)
            if (!arrayBuffer) return resolve({ ...data, codecs: [], mimeType: getMimeType(data.path), mimeCodec: "" })

            const mp4boxfile = MP4Box.createFile()
            mp4boxfile.onError = (err: Error) => console.error("MP4Box error:", err)
            mp4boxfile.onReady = (info: { tracks: { codec: string }[]; [key: string]: any }) => {
                const codecs = info.tracks.map((track: { codec: string }) => track.codec)
                const mimeType = getMimeType(data.path)
                const mimeCodec = `${mimeType}; codecs="${codecs.join(", ")}"`
                resolve({ ...data, codecs, mimeType, mimeCodec })
            }

            arrayBuffer.fileStart = 0
            mp4boxfile.appendBuffer(arrayBuffer)
            mp4boxfile.flush()
        } catch (err) {
            console.error("MP4Box error catch:", err)
            resolve({ ...data, codecs: [], mimeType: getMimeType(data.path), mimeCodec: "" })
            return
        }
    })
}

export function getMimeType(filePath: string) {
    if (typeof filePath !== "string") return ""

    // const ext = filePath.split(".").pop()?.toLowerCase() || ""
    const ext = path.extname(filePath).toLowerCase().slice(1)
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
        const buffer = fs.readFileSync(data.path)
        const uint8Array = new Uint8Array(buffer)
        arrayBuffer = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength)
    } catch (err) {
        console.error(err)
        return { ...data, tracks: [] }
    }

    if (!arrayBuffer) return { ...data, tracks: [] }

    return new Promise((resolve) => {
        const mp4boxfile = MP4Box.createFile()
        mp4boxfile.onError = (e: Error) => console.error("MP4Box error:", e)
        mp4boxfile.onReady = (info: any) => {
            const tracks: Subtitle[] = []
            let trackCount = 0
            let completed = 0
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

                mp4boxfile.onSamples = (_id: number, _user: any, samples: { data: BufferSource; cts: number; duration: number }[]) => {
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

/// ///

export function getMediaSyncFolderPath() {
    return getStore("config").mediaFolderPath || getDataFolderPath("media")
}
export function setMediaSyncFolderPath(folderPath: string) {
    setStoreValue({ file: "config", key: "mediaFolderPath", value: folderPath })
}

// SEARCH FOR MEDIA FILE (in drawer media folders & their following folders)
const NESTED_SEARCH = 8 // folder levels deep
export async function locateMediaFile({ filePath, folders }: { filePath: string; folders: string[] }) {
    if (await doesPathExistAsync(filePath)) return { path: filePath, hasChanged: false }

    const matches: string[] = []

    // Media Sync Folder
    const mediaFolder = getMediaSyncFolderPath()
    const folderId = getFileParentFolderId(filePath)
    const mediaFilePath = path.join(mediaFolder, folderId, upath.basename(filePath))
    if (await doesPathExistAsync(mediaFilePath)) return { path: mediaFilePath, hasChanged: true }
    folders.unshift(mediaFolder)

    // lookup already replaced paths from cache
    const syncCache = getStore("CACHE_SYNC")
    if (!syncCache.replacedPaths) syncCache.replacedPaths = {}
    const cachedPath = syncCache.replacedPaths[folderId]
    if (cachedPath && (await doesPathExistAsync(cachedPath))) {
        return { path: cachedPath, hasChanged: false }
    }

    const fileName = upath.basename(filePath)

    await findMatches()
    const newPath = matches?.[0]
    if (!newPath) return null

    // store replaced path in cache
    syncCache.replacedPaths[folderId] = newPath
    setStore(_store.CACHE_SYNC, syncCache)

    return { path: newPath, hasChanged: true }

    async function findMatches() {
        for (const folderPath of folders) {
            // if (matches.length > 1) return // this might be used if we want the user to choose if more than one match is found
            if (matches.length) return
            await searchInFolder(folderPath)
        }
    }

    async function searchInFolder(folderPath: string, level = 1) {
        if (level > NESTED_SEARCH || matches.length) return
        if (!(await doesPathExistAsync(folderPath))) return

        // check any path with same parent folder for matches first to limit search a bit
        // this should also help if multiple files has the same name, but originates from different folders
        const parentFolderName = upath.basename(upath.dirname(filePath))
        const potentialPath = path.join(folderPath, parentFolderName, fileName)
        if (await doesPathExistAsync(potentialPath)) {
            matches.push(potentialPath)
            return
        }

        const currentFolderFolders: string[] = []
        const files = await readFolderAsync(folderPath)

        await Promise.all(
            files.map(async (name) => {
                const currentFilePath: string = path.join(folderPath, name)
                const isFolder = await checkIsFolder(currentFilePath)

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
        if (matches.length) return

        // simple search: match by file name only
        if (currentFileName === fileName) {
            matches.push(path.join(folderPath, currentFileName))
        }
    }
}

async function checkIsFolder(filePath: string): Promise<boolean> {
    return new Promise((resolve) =>
        fs.stat(filePath, (err, stats) => {
            resolve(err ? false : stats.isDirectory())
        })
    )
}

/////

// detect new files in downloads folder for easy importing
// - auto import .project files
// - suggest importing videos/images/pdfs
// - WIP extract & import zip files with media content
export async function detectNewFiles() {
    const downloadsFolder = app.getPath("downloads")
    const MAX_TIME = 16 * 60 * 60 * 1000 // 16 hours
    const ONE_MINUTE = 60 * 1000
    const WRITE_WAIT_MS = 2000
    const temporaryExtensions = [".crdownload", ".part", ".download", ".tmp"]

    // read folder once and build known set
    const dirListing = await readFolderAsync(downloadsFolder)
    const knownFiles = new Set(dirListing)

    // initial recent files
    const cutoff = Date.now() - MAX_TIME
    const allRecentFiles: string[] = []
    for (const fileName of dirListing) {
        if (!fileName) continue
        const ext = path.extname(fileName).toLowerCase()
        if (temporaryExtensions.includes(ext)) continue

        const filePath = path.join(downloadsFolder, fileName)
        const stats = await getFileStatsAsync(filePath)
        if (!stats) continue

        if (stats.birthtimeMs < cutoff) continue

        allRecentFiles.push(filePath)
    }

    sendToMain(ToMain.RECENTLY_ADDED_FILES, { paths: allRecentFiles })

    // watch for file changes
    fs.watch(downloadsFolder, { persistent: false }, async (eventType, filename) => {
        if (eventType !== "rename" || !filename) return

        const ext = path.extname(filename).toLowerCase()
        if (temporaryExtensions.includes(ext)) return

        const filePath = path.join(downloadsFolder, filename)

        const exists = await doesPathExistAsync(filePath)
        if (!exists) {
            const isKnown = knownFiles.delete(filename)
            if (!isKnown) return

            const idx = allRecentFiles.indexOf(filePath)
            if (idx === -1) return

            allRecentFiles.splice(idx, 1)
            sendToMain(ToMain.RECENTLY_ADDED_FILES, { paths: allRecentFiles })
            return
        }

        if (knownFiles.has(filename)) return

        // treat as potential new download after a short write-wait
        setTimeout(async () => {
            const stats = await getFileStatsAsync(filePath)
            if (!stats) return

            knownFiles.add(filename)
            if (stats.birthtimeMs < Date.now() - ONE_MINUTE) return

            if (!allRecentFiles.includes(filePath)) allRecentFiles.push(filePath)
            sendToMain(ToMain.RECENTLY_ADDED_FILES, { paths: allRecentFiles })
        }, WRITE_WAIT_MS)
    })
}

/// ///

// region: BUNDLE MEDIA FILES FROM ALL SHOWS AND PROJECTS (IMAGE/VIDEO/AUDIO)
let currentlyBundling = false
/**
 * Bundles media files from all shows and projects
 * @param openFolderWhenDone [default=false] Whether to open the output folder when done
 */
export function bundleMediaFiles({ openFolder = false }: { openFolder?: boolean } = {}) {
    if (currentlyBundling) return
    currentlyBundling = true

    let allMediaFiles: string[] = []
    function addFile(filePath: string | undefined) {
        if (filePath) allMediaFiles.push(filePath)
    }

    // shows
    const showsPath = getDataFolderPath("shows")
    let showsList = readFolder(showsPath)
    showsList = showsList
        .filter((name) => name.toLowerCase().endsWith(".show")) // only .show files
        .filter((trimmedName) => trimmedName) // remove files with no name

    function readShow(fileName: string) {
        const showPath: string = path.join(showsPath, fileName)
        const jsonData = readFile(showPath) || "{}"
        const show: Show | undefined = parseShow(jsonData)?.[1]

        if (!show) return

        // media backgrounds & audio
        Object.values(show.media || {}).forEach((media) => {
            const mediaPath = media.path || media.id
            if (mediaPath) addFile(mediaPath)
        })

        // slide media items
        Object.values(show.slides || {}).forEach((a) => getItemsMedia(a.items || []))
    }
    for (const name of showsList) readShow(name)

    // projects
    function readProject(project: Project) {
        project?.shows?.forEach((show) => {
            const type = show.type || "show"
            if (["image", "video", "audio", "pdf", "ppt"].includes(type)) {
                addFile(show.id)
            } else if (type === "folder") {
                // WIP handle project media folders?
            }
        })
    }
    const projects = getStore("PROJECTS").projects as Project
    Object.values(projects).forEach(readProject)

    // get overlays media
    const overlays = getStore("OVERLAYS")
    Object.values(overlays).forEach((a) => getItemsMedia(a.items || []))

    // get templates media
    const templates = getStore("TEMPLATES")
    Object.values(templates).forEach((a) => getItemsMedia(a.items || []))

    function getItemsMedia(items: Item[]) {
        items.forEach((item) => {
            if (item.type === "media") addFile(item.src)
        })
    }

    // remove duplicates
    allMediaFiles = [...new Set(allMediaFiles)]
    if (!allMediaFiles.length) {
        currentlyBundling = false
        return
    }

    // bundle should use default Media folder, and not any custom sync folders
    const outputFolder = getDataFolderPath("media")

    // copy media files
    addToMediaFolder(allMediaFiles, outputFolder) // skip awaiting

    if (openFolder) openInSystem(outputFolder, true)
    currentlyBundling = false
}

export async function addToMediaFolder(mediaPaths: string[], outputFolder?: string) {
    const mediaFolderPath = outputFolder || getMediaSyncFolderPath()
    let changed = false

    await Promise.all(
        mediaPaths.map(async (mediaPath) => {
            // if media path is already in media folder, skip
            if (mediaPath.startsWith(mediaFolderPath)) return

            // make sure original media exists
            if (!(await doesPathExistAsync(mediaPath))) return

            // ensure folder name is matching path in case files with the same name has the same parent folder name
            const folderId = getFileParentFolderId(mediaPath)

            const newFolderPath = path.join(mediaFolderPath, folderId)
            createFolder(newFolderPath)

            const fileName = path.basename(mediaPath)
            const newMediaPath = path.join(newFolderPath, fileName)

            const alreadyExists = await doesPathExistAsync(newMediaPath)
            if (alreadyExists) {
                // no need when we have the folder name path id
                // double check that it's actually different
                // const matches = await fileContentMatchesAsync(await readFileAsync(mediaPath), newMediaPath)
                // if (matches) return
                return
            }

            changed = true
            await copyFileAsync(mediaPath, newMediaPath)
        })
    )

    return changed
}

function getFileParentFolderId(filePath: string) {
    const fileFolderPath = upath.dirname(filePath)
    const parentFolderName = upath.basename(fileFolderPath)
    const uniqueName = parentFolderName + "_" + filePathHashCode(fileFolderPath)
    return uniqueName
}

// LOAD SHOWS

export function loadShows(returnShows = false, newShows: string[] = []) {
    const showsPath = getDataFolderPath("shows")

    specialCaseFixer()

    // list all shows in folder
    let filesInFolder: string[] = readFolder(showsPath)

    const cachedShows = getStore("SHOWS") || {}
    const newCachedShows: TrimmedShows = {}
    const textCache: { [key: string]: string } = {}

    // create a map for quick lookup of cached shows by name
    const cachedShowNames = new Map<string, string>()
    for (const [id, show] of Object.entries(cachedShows)) {
        if (show?.name && !newShows.includes(show.name)) cachedShowNames.set(show.name, id)
    }

    filesInFolder = filesInFolder
        .filter((name) => name.toLowerCase().endsWith(".show"))
        .map((name) => name.slice(0, -5)) // remove .show extension
        .filter((trimmedName) => trimmedName) // remove files with no name

    for (const name of filesInFolder) checkShow(name)
    function checkShow(name: string) {
        const matchingShowId = cachedShowNames.get(name)
        if (matchingShowId && !newCachedShows[matchingShowId]) {
            newCachedShows[matchingShowId] = cachedShows[matchingShowId]
            return
        }

        const showPath: string = path.join(showsPath, `${name}.show`)
        const jsonData = readFile(showPath) || "{}"
        const show = parseShow(jsonData)

        if (!show || !show[1]) return

        let id = show[0]
        // some old duplicated shows might have the same id
        if (newCachedShows[id]) id = uid()

        const trimmedShow = trimShow({ ...show[1], name })
        if (trimmedShow) newCachedShows[id] = trimmedShow

        // cache text content
        const txt = getTextCacheString(show[1])
        if (txt) textCache[id] = txt
    }

    // send updated text cache
    if (Object.keys(textCache).length) {
        const cache = getStore("CACHE")
        cache.text = { ...cache.text, ...textCache }
        sendMain(Main.CACHE, cache)
    }

    if (returnShows) return newCachedShows

    // save this (for cloud sync)
    setStore(_store.SHOWS, newCachedShows)

    return newCachedShows
}

// same as frontend setShow.ts
function getTextCacheString(show: Show) {
    if (!show?.slides || show?.reference?.type) return ""

    return Object.values(show.slides)
        .flatMap((slide) => slide?.items)
        .flatMap((item) => item?.lines || [])
        .flatMap((line) => line?.text || [])
        .map((text) => text?.value || "")
        .join(" ")
        .toLowerCase()
}

export function parseShow(jsonData: string) {
    return parseJSON(jsonData) as [string, Show] | null
}
// export function parseBible(jsonData: string) {
//     return parseJSON(jsonData) as [string, Bible] | null
// }
export function parseJSON(jsonData: string) {
    let show: [string, any] | null = null

    try {
        show = JSON.parse(jsonData)
    } catch (err) {
        // try to fix broken files
        jsonData = jsonData.slice(0, jsonData.indexOf("}}]") + 3)

        // try again
        try {
            show = JSON.parse(jsonData)
        } catch (e) {
            console.error("Error parsing show")
        }
    }

    return show
}

// load shows by id (used for show export)
export function getShowsFromIds(showIds: string[]) {
    const shows: Show[] = []
    const cachedShows = getStore("SHOWS")
    const showsPath = getDataFolderPath("shows")

    showIds.forEach((id) => {
        const cachedShow = cachedShows[id]
        if (!cachedShow) return

        const fileName = cachedShow.name || id

        const showPath: string = path.join(showsPath, `${fileName}.show`)
        const jsonData = readFile(showPath) || "{}"
        const show = parseShow(jsonData)

        if (show?.[1]) shows.push({ ...show[1], id })
    })

    return shows
}

// some users might have got themselves in a situation they can't get out of
// example: enables "kiosk" mode on mac might have resulted in a black screen, and they can't find the app data location to revert it!
// how: Place any file in your Documents/FreeShow folder that has the FIXES key in it's name (e.g. DISABLE_KIOSK_MODE), when you now start your app the fix will be triggered!
const FIXES = {
    DISABLE_KIOSK_MODE: () => {
        // wait to ensure output settings have loaded in the app!
        setTimeout(() => {
            toApp(OUTPUT, { channel: "UPDATE_OUTPUTS_DATA", data: { key: "kioskMode", value: false, autoSave: true } })
            OutputHelper.getAllOutputs().forEach((output) => output.window.setKiosk(false))
        }, 1000)
    },
    OPEN_APPDATA_SETTINGS: () => {
        // this will open the "settings.json" file located at the app data location (can also be used to find other setting files here)
        openInSystem(_store.SETTINGS?.path || "", true)
    },
    ADMIN_PROFILE: () => {
        setAutoProfile("admin")
    }
}
function specialCaseFixer() {
    const defaultDataFolder = getDefaultDataFolderRoot()
    if (!doesPathExist(defaultDataFolder)) return

    const files: string[] = readFolder(defaultDataFolder)
    files.forEach((fileName) => {
        const matchFound = Object.keys(FIXES).find((key) => fileName.includes(key))
        if (matchFound) FIXES[matchFound as keyof typeof FIXES]()
    })
}
