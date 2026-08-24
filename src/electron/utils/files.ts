// ----- FreeShow -----
// Functions to interact with local files

import { app, dialog, shell } from "electron"
import type { ExifData } from "exif"
import { ExifImage } from "exif"
import fs, { type Stats } from "fs"
import path, { join, parse } from "path"
import { uid } from "uid"
import upath from "upath"
import { fileURLToPath } from "url"
import { Main } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"
import type { FileFolder, MainFilePaths, MediaCodecInfo, Subtitle } from "../../types/Main"
import type { Project } from "../../types/Projects"
import type { Item, Show, TrimmedShows } from "../../types/Show"
import { imageExtensions, mimeTypes, videoExtensions } from "../data/media"
import { _store, appDataPath, config, getStore, setStore, setStoreValue } from "../data/store"
import { createThumbnail, doesMediaExist, filePathHashCode } from "../data/thumbnails"
import { sendMain, sendToMain } from "../IPC/main"
import { mainWindow, setAutoProfile } from "./../index"
import { getAllShows, trimShow } from "./shows"

function actionComplete(err: Error | null, actionFailedMessage: string) {
    if (err) console.error(actionFailedMessage + ":", err)
}

function isPermissionDeniedError(err: unknown): boolean {
    // the user has not granted permission to access the file/folder, or the file/folder is locked by another process
    if (!err || typeof err !== "object") return false
    const code = (err as NodeJS.ErrnoException).code
    return code === "EPERM" || code === "EACCES"
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
        if (!fs.existsSync(filePath) || fs.lstatSync(filePath).isDirectory()) return ""
        const buffer = fs.readFileSync(filePath)
        return safeBufferToString(buffer, encoding, filePath)
    } catch (err) {
        if (!disableLog) actionComplete(err as Error, "Error when reading file")
        return ""
    }
}

export function readFolder(filePath: string): string[] {
    try {
        return fs.readdirSync(filePath)
    } catch (err) {
        if (isPermissionDeniedError(err)) return []
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

export function deleteFolderAsync(filePath: string) {
    return new Promise<void>((resolve) => {
        fs.rm(filePath, { recursive: true, force: true }, (err) => {
            if (err) actionComplete(err, "Error when deleting folder")
            resolve()
        })
    })
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
            resolve(err ? "" : safeBufferToString(buffer, encoding, filePath))
        })
    )
}

const MAX_NODE_STRING_LENGTH = 0x1fffffe8
function safeBufferToString(buffer: Buffer, encoding: BufferEncoding, filePath: string): string {
    if (!buffer?.length) return ""

    // Guard against Node's maximum string length to avoid runtime RangeError.
    if (buffer.length > MAX_NODE_STRING_LENGTH) {
        console.error(`Skipped string conversion for oversized file: ${filePath}`)
        return ""
    }

    try {
        return buffer.toString(encoding)
    } catch (err) {
        console.error(err, `Error when converting file buffer to string (${filePath})`)
        return ""
    }
}

export function readFileBufferAsync(filePath: string): Promise<Buffer> {
    return new Promise((resolve) =>
        fs.readFile(filePath, (err, buffer) => {
            if (err) console.error(err)
            resolve(err ? Buffer.alloc(0) : buffer)
        })
    )
}

export function readFolderAsync(filePath: string): Promise<string[]> {
    return new Promise((resolve) =>
        fs.readdir(filePath, (err, files) => {
            if (err && !isPermissionDeniedError(err)) console.error(err)
            resolve(err ? [] : files)
        })
    )
}

async function readFolderWithTypesAsync(folderPath: string): Promise<fs.Dirent[]> {
    return new Promise((resolve, reject) => {
        fs.readdir(folderPath, { withFileTypes: true }, (err, entries) => {
            if (err) {
                if (isPermissionDeniedError(err)) return resolve([])
                return reject(err)
            } else resolve(entries)
        })
    })
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
    try {
        fs.unlinkSync(filePath)
        return true
    } catch (err) {
        actionComplete(err as Error, "Could not delete file")
        return false
    }
}

export function deleteFileAsync(filePath: string) {
    return new Promise<boolean>((resolve) => {
        fs.unlink(filePath, (err) => {
            actionComplete(err, "Could not delete file")
            resolve(!err)
        })
    })
}

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
        fs.rename(oldPath, newPath, async (err) => {
            if (err && err.code === "EXDEV") {
                // cross-device link not permitted, fallback to copy + delete
                try {
                    await copyFileAsync(oldPath, newPath)
                    await deleteFileAsync(oldPath)
                    resolve(true)
                } catch (copyErr) {
                    actionComplete(copyErr as Error, "Could not copy file for cross-device move")
                    resolve(false)
                }
            } else {
                actionComplete(err, "Could not rename file")
                resolve(!err)
            }
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

export function sanitizeFileName(name: string) {
    if (!name || typeof name !== "string") return ""

    // Remove ASCII control chars and reserved characters
    name = name.replace(/[<>:\"/\\|?*\x00-\x1F]/g, "")
    // Collapse whitespace and trim
    name = name.replace(/\s+/g, " ").trim()
    // Remove trailing dots/spaces (Windows disallows these)
    name = name.replace(/[.\s]+$/g, "")

    return name
}

export function getFileStatsAsync(filePath: string): Promise<null | Stats> {
    return new Promise((resolve) => {
        if (!filePath) return resolve(null)
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

export function selectFilesDialog(title = "", filters: Electron.FileFilter, multiple = true, initialPath = ""): string[] {
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

export async function openInSystem(filePath: string, openFolder = false) {
    if (!doesPathExist(filePath)) return sendToMain(ToMain.ALERT, "This does not exist!")

    const err = openFolder ? await shell.openPath(filePath).catch(() => "error") : ""
    if (!openFolder || err) shell.showItemInFolder(filePath)
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
    const fullPath = path.join(documentsPath, appFolderName)

    try {
        if (doesPathExist(fullPath)) {
            fs.accessSync(fullPath, fs.constants.W_OK)
            return fullPath
        } else {
            fs.mkdirSync(fullPath, { recursive: true })
            return fullPath
        }
    } catch (err) {
        console.warn("Documents folder is not writable, falling back to AppData:", err)
        return appDataPath
    }
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

export function isWritable(filePath: string): boolean {
    try {
        fs.accessSync(filePath, fs.constants.W_OK)
        return true
    } catch (err) {
        return false
    }
}

export function getExtension(name: string) {
    return path.extname(name).substring(1).toLowerCase()
}

export function createFolder(folderPath: string) {
    if (doesPathExist(folderPath)) {
        if (fs.lstatSync(folderPath).isDirectory()) return folderPath
        // exists but is a file
    }
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
    const folderContent = new Map<string, FileFolder>()

    if (!Array.isArray(data.path)) data.path = [data.path]
    if (data.depth === undefined) data.depth = 0

    await asyncPool(8, data.path, async (folderPath) => {
        const stats = await getFileStatsAsync(folderPath)
        if (!stats?.isDirectory()) return

        await getFolderContentRecursive(folderPath)
    })

    async function getFolderContentRecursive(folderPath: string, currentDepth = 0) {
        const exceededDepth = currentDepth > data.depth!

        if (folderContent.has(folderPath)) return

        if (data.captureFolderContent && currentDepth >= 2 && exceededDepth) {
            folderContent.set(folderPath, { isFolder: true, path: folderPath, name: path.basename(folderPath), files: [] })
            return
        }

        const fileList = await readFolderAsync(folderPath)
        const filePaths: string[] = fileList.map((name) => path.join(folderPath, name))

        let noMedia = false
        if (data.captureFolderContent) {
            // check if any of the files in the current folder are media files and no folders (because they might contain media files)
            noMedia = true
            await asyncPool(32, filePaths, async (p) => {
                if (!noMedia) return
                const stats = await getFileStatsAsync(p)
                if (stats?.isDirectory() || isMedia(getExtension(p))) noMedia = false
            })
        }

        if (data.captureFolderContent && currentDepth < 2 ? false : exceededDepth) {
            folderContent.set(folderPath, { isFolder: true, path: folderPath, name: path.basename(folderPath), files: filePaths, noMedia: noMedia ? true : undefined })
            return
        }

        const captureThumbnailPaths = data.captureFolderContent && currentDepth === 1 ? getFirstMediaFiles(filePaths, 4) : []
        const currentPaths = data.captureFolderContent && exceededDepth ? captureThumbnailPaths : filePaths

        await asyncPool(32, currentPaths, async (filePath) => {
            const stats = await getFileStatsAsync(filePath)
            if (!stats) return

            if (stats.isDirectory()) {
                await getFolderContentRecursive(filePath, currentDepth + 1)
            } else {
                let thumbnailPath = ""
                if (captureThumbnailPaths.includes(filePath) || (data.generateThumbnails && currentDepth === 0 && isMedia(getExtension(filePath)))) {
                    try {
                        thumbnailPath = createThumbnail(filePath)
                    } catch (err) {
                        console.error("Thumbnail creation failed:", err)
                    }
                }

                folderContent.set(filePath, { isFolder: false, path: filePath, name: path.basename(filePath), thumbnailPath, stats })
            }
        })

        folderContent.set(folderPath, { isFolder: true, path: folderPath, name: path.basename(folderPath), files: filePaths, noMedia: noMedia ? true : undefined })
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
export function readExifData({ id }: { id: string }): Promise<{ id: string; exif: ExifData | undefined }> {
    return new Promise((resolve) => {
        try {
            new ExifImage({ image: id }, (err, exifData) => {
                actionComplete(err, "Error getting EXIF data")
                // always settle the promise, otherwise an awaiting IPC request hangs until it times out
                resolve({ id, exif: err ? undefined : exifData })
            })
        } catch (err) {
            actionComplete(err as Error, "Error loading EXIF image")
            resolve({ id, exif: undefined })
        }
    })
}

// GET MEDIA CODEC
export async function getMediaCodec(data: { path: string }): Promise<MediaCodecInfo> {
    const mimeType = getMimeType(data.path)
    const emptyResult: MediaCodecInfo = { ...data, codecs: [], mimeType, mimeCodec: "" }

    return parseMp4File(data.path, emptyResult, (mp4boxfile, resolve) => {
        mp4boxfile.onReady = (info: any) => {
            const codecs = info?.tracks?.map((t: any) => t.codec).filter(Boolean) || []
            if (!codecs.length) return resolve(emptyResult)

            const mimeCodec = `${mimeType}; codecs="${codecs.join(", ")}"`
            resolve({ ...data, codecs, mimeType, mimeCodec })
        }
    })
}

export function getMimeType(filePath: string): string {
    if (!filePath || typeof filePath !== "string") return "application/octet-stream"

    const ext = path.extname(filePath).toLowerCase().replace(/^\./, "")
    return mimeTypes[ext] || "application/octet-stream"
}

// GET EMBEDDED SUBTITLES
export async function getMediaTracks(data: { path: string }): Promise<{ path: string; tracks: Subtitle[] }> {
    const DECODER = new TextDecoder("utf-8")
    const emptyResult = { ...data, tracks: [] as Subtitle[] }

    return parseMp4File(data.path, emptyResult, (mp4boxfile, resolve) => {
        mp4boxfile.onReady = (info: any) => {
            const subTracks = info?.tracks?.filter((t: any) => t?.type === "subtitles" || t?.type === "text") || []
            if (!subTracks.length) return resolve(emptyResult)

            const tracks: Subtitle[] = []
            const pendingIds = new Set<number>(subTracks.map((t: any) => t.id))
            const trackVttMap = new Map<number, { lines: string[]; index: number; language: string }>()

            subTracks.forEach((track: any) => {
                trackVttMap.set(track.id, { lines: ["WEBVTT\n"], index: 1, language: track.language || "und" })
                mp4boxfile.setExtractionOptions(track.id, null, { nbSamples: track.nb_samples })
            })

            mp4boxfile.onSamples = (id: number, _user: any, samples: any[]) => {
                if (!pendingIds.has(id)) return
                const trackInfo = subTracks.find((t: any) => t.id === id)
                const vttInfo = trackVttMap.get(id)

                if (trackInfo && vttInfo) {
                    const scale = trackInfo.timescale || 1

                    for (const sample of samples) {
                        const subtitleText = DECODER.decode(sample.data)
                            .replace(/[^\x20-\x7E\r\n\t]+/g, "")
                            .trim()
                        if (!subtitleText) continue

                        const start = formatTimestamp((sample.cts / scale) * 1000)
                        const end = formatTimestamp(((sample.cts + sample.duration) / scale) * 1000)

                        vttInfo.lines.push(`${vttInfo.index++}`, `${start} --> ${end}`, `${subtitleText}\n`)
                    }

                    if (vttInfo.lines.length > 1) {
                        tracks.push({ lang: vttInfo.language.slice(0, 2), name: vttInfo.language, vtt: vttInfo.lines.join("\n"), embedded: true })
                    }
                }

                pendingIds.delete(id)
                if (pendingIds.size === 0) resolve({ ...data, tracks })
            }

            mp4boxfile.start()
        }
    })
}

function formatTimestamp(ms: number): string {
    const pad = (n: number, z = 2) => Math.floor(n).toString().padStart(z, "0")
    return `${pad(ms / 3600000)}:${pad((ms % 3600000) / 60000)}:${pad((ms % 60000) / 1000)}.${pad(ms % 1000, 3)}`
}

// MP4BOX HELPER
const CHUNK_SIZE = 1024 * 1024 // Read in 1MB chunks
function parseMp4File<T>(filePath: string, fallback: T, setupListeners: (mp4boxfile: any, resolve: (res: T) => void) => void): Promise<T> {
    return new Promise((resolve) => {
        if (!fs.existsSync(filePath)) return resolve(fallback)

        const MP4Box = require("mp4box")

        let fd: number | null = null
        let settled = false

        const cleanupAndResolve = (result: T) => {
            if (settled) return
            settled = true
            if (fd !== null) {
                try {
                    fs.closeSync(fd)
                } catch {}
            }
            resolve(result)
        }

        try {
            const stats = fs.statSync(filePath)
            fd = fs.openSync(filePath, "r")

            const mp4boxfile = MP4Box.createFile()
            mp4boxfile.onError = () => cleanupAndResolve(fallback)

            setupListeners(mp4boxfile, cleanupAndResolve)

            let offset = 0
            const buffer = Buffer.allocUnsafe(CHUNK_SIZE)

            while (offset < stats.size && !settled) {
                const bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, offset)
                if (bytesRead === 0) break

                const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + bytesRead) as ArrayBuffer & { fileStart?: number }
                arrayBuffer.fileStart = offset
                offset += bytesRead

                // Safeguard against internal mp4box runtime errors
                try {
                    mp4boxfile.appendBuffer(arrayBuffer)
                } catch {
                    return cleanupAndResolve(fallback)
                }
            }

            try {
                mp4boxfile.flush()
            } catch {}
            if (!settled) cleanupAndResolve(fallback)
        } catch {
            cleanupAndResolve(fallback)
        }
    })
}

/// ///

export function getMediaSyncFolderPath() {
    return getStore("config").mediaFolderPath || getDataFolderPath("media")
}
export function setMediaSyncFolderPath(folderPath: string) {
    setStoreValue({ file: "config", key: "mediaFolderPath", value: folderPath })
}

function fileNamesMatch(nameA: string, nameB: string) {
    return normalizeFileNameForMatch(nameA) === normalizeFileNameForMatch(nameB)
}
function normalizeFileNameForMatch(name: string) {
    return name.normalize("NFC").toLowerCase()
}

function normalizeLocalPath(filePath: string) {
    if (!filePath || typeof filePath !== "string") return ""

    let normalizedPath = filePath

    if (normalizedPath.startsWith("file://")) {
        try {
            normalizedPath = fileURLToPath(normalizedPath)
        } catch {
            normalizedPath = normalizedPath.replace(/^file:\/\//, "")
        }
    }

    try {
        normalizedPath = decodeURI(normalizedPath)
    } catch {
        // ignore malformed URI sequences and keep original
    }

    return normalizedPath
}

// SEARCH FOR MEDIA FILE (in drawer media folders & their following folders)
const NESTED_SEARCH = 8 // folder levels deep
export async function locateMediaFile({ filePath, folders }: { filePath: string; folders: string[] }) {
    const normalizedOriginalPath = normalizeLocalPath(filePath)
    if ((await doesMediaExist({ path: normalizedOriginalPath })).exists) return { path: normalizedOriginalPath, hasChanged: false }

    // Media Sync Folder
    const mediaFolder = getMediaSyncFolderPath()
    const folderId = getFileParentFolderId(normalizedOriginalPath)
    const fileName = upath.basename(normalizedOriginalPath)
    const mediaFilePath = path.join(mediaFolder, folderId, fileName)
    if ((await doesMediaExist({ path: mediaFilePath })).exists) return { path: mediaFilePath, hasChanged: true }
    const searchFolders = [mediaFolder, ...folders].map(normalizeLocalPath).filter((folderPath) => folderPath)

    // lookup already replaced paths from cache
    const syncCache = getStore("CACHE_SYNC")
    if (!syncCache.replacedPaths) syncCache.replacedPaths = {}
    const cacheId = `${folderId}_${fileName}`
    const cachedPath = syncCache.replacedPaths[cacheId]
    // TEMP disable in case the wrong file is cached
    if (false && cachedPath && (await doesMediaExist({ path: cachedPath })).exists) {
        return { path: cachedPath, hasChanged: false }
    }

    const parentFolderName = upath.basename(upath.dirname(normalizedOriginalPath))

    const newPath = await findMatches()
    if (!newPath) return null

    // store replaced path in cache
    syncCache.replacedPaths[cacheId] = newPath
    setStore(_store.CACHE_SYNC, syncCache)

    return { path: newPath, hasChanged: true }

    async function findMatches() {
        for (const folderPath of searchFolders) {
            const newPath = await searchInFolder(folderPath)
            if (newPath) return newPath
        }
        return null
    }

    async function searchInFolder(folderPath: string, level = 1): Promise<string | null> {
        if (level > NESTED_SEARCH) return null
        if (!(await doesPathExistAsync(folderPath))) return null

        // check any path with same parent folder for matches first to limit search a bit
        // this should also help if multiple files has the same name, but originates from different folders
        const potentialPath = path.join(folderPath, parentFolderName, fileName)
        if (await doesPathExistAsync(potentialPath)) {
            return potentialPath
        }

        let entries: fs.Dirent[] = []
        try {
            entries = await readFolderWithTypesAsync(folderPath)
        } catch {
            return null
        }

        const subFolders: string[] = []

        // ---- Scan files & collect subfolders
        let found: string | null = null

        // search all files in current folder before searching in any nested folders
        for (const entry of entries) {
            const currentPath = path.join(folderPath, entry.name)

            if (entry.isDirectory()) {
                subFolders.push(currentPath)
                continue
            }

            if (fileNamesMatch(entry.name, fileName)) {
                return currentPath
            }
        }

        if (found) return found

        // ---- Scan files in subfolders
        await asyncPool(8, subFolders, async (sub) => {
            if (found) return

            const result = await searchInFolder(sub, level + 1)
            if (result) {
                found = result
            }
        })

        return found
    }
}

// poolLimit = number of concurrent promises
export async function asyncPool<T>(poolLimit: number, array: T[], iteratorFn: (item: T) => Promise<void>) {
    const ret: Promise<void>[] = []
    const executing: Promise<void>[] = []

    for (const item of array) {
        if ((iteratorFn as any).shouldStop?.()) break
        const p = Promise.resolve().then(() => iteratorFn(item))
        ret.push(p)

        if (poolLimit <= array.length) {
            const e: Promise<void> = p.then(() => {
                executing.splice(executing.indexOf(e), 1)
            })
            executing.push(e)

            if (executing.length >= poolLimit) {
                await Promise.race(executing)
            }
        }
    }

    await Promise.all(ret)
}

/// //

// detect new files in downloads folder for easy importing
// - auto import .project files
// - suggest importing videos/images/pdfs
// - WIP extract & import zip files with media content
export async function detectNewFiles() {
    if (!getStore("SETTINGS").initialized) return

    let downloadsFolder: string
    try {
        downloadsFolder = app.getPath("downloads")
    } catch {
        return
    }

    const MAX_TIME = 8 * 60 * 60 * 1000 // 8 hours
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
    try {
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
    } catch (err) {
        console.warn("No permission to watch folder:", err)
    }
}

/// ///

// region: BUNDLE MEDIA FILES FROM ALL SHOWS AND PROJECTS (IMAGE/VIDEO/AUDIO)
let currentlyBundling = false
/**
 * Bundles media files from all shows and projects
 *
 * @param openFolderWhenDone [default=false] Whether to open the output folder when done
 */
export function bundleMediaFiles({ openFolder = false, outputPath = "" }: { openFolder?: boolean; outputPath?: string } = {}) {
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
            if (!show) return
            const type = show.type || "show"
            if (["image", "video", "audio", "pdf", "ppt"].includes(type)) {
                addFile(show.id)
            } else if (type === "folder") {
                // skip media folder items, because it's a fixed folder path, regardless of the media inside
            }
        })
    }
    const projects = getStore("PROJECTS").projects as Project
    Object.values(projects || {}).forEach(readProject)

    // get overlays media
    const overlays = getStore("OVERLAYS")
    Object.values(overlays || {}).forEach((a) => getItemsMedia(a.items || []))

    // get templates media
    const templates = getStore("TEMPLATES")
    Object.values(templates || {}).forEach((a) => getItemsMedia(a.items || []))

    function getItemsMedia(items: Item[]) {
        items.forEach((item) => {
            if (item?.type === "media") addFile(item.src)
        })
    }

    // remove duplicates
    allMediaFiles = [...new Set(allMediaFiles)]
    if (!allMediaFiles.length) {
        currentlyBundling = false
        return
    }

    // use custom output path or FreeShow Media folder
    const outputFolder = outputPath || getDataFolderPath("media")

    // copy media files
    addToMediaFolder(allMediaFiles, outputFolder) // skip awaiting

    if (openFolder) openInSystem(outputFolder, true)
    currentlyBundling = false
}

export async function addToMediaFolder(mediaPaths: string[], outputFolder?: string) {
    const mediaFolderPath = outputFolder || getMediaSyncFolderPath()
    let changed = false

    await asyncPool(50, mediaPaths, async (mediaPath) => {
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

    return changed
}

function getFileParentFolderId(filePath: string) {
    const fileFolderPath = upath.dirname(filePath)
    const parentFolderName = upath.basename(fileFolderPath)
    const uniqueName = parentFolderName + "_" + filePathHashCode(fileFolderPath)
    return uniqueName
}

// LOAD SHOWS

export function loadShows(returnShows = false, reCacheNames: string[] = []) {
    const showsPath = getDataFolderPath("shows")

    // list all shows in folder
    let filesInFolder: string[] = readFolder(showsPath)

    const cachedShows = getStore("SHOWS") || {}
    const newCachedShows: TrimmedShows = {}
    const textCache: { [key: string]: string } = {}
    const existingCacheText: { [key: string]: string } = getStore("CACHE")?.text || {}

    // create a map for quick lookup of cached shows by name
    const cachedShowNames = new Map<string, string>()
    for (const [id, show] of Object.entries(cachedShows)) {
        if (show?.name && !reCacheNames.includes(show.name)) cachedShowNames.set(show.name, id)
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
            // backfill: build text for an already-cached show that was never text-cached (e.g. it existed before the text cache)
            if (!existingCacheText[matchingShowId]) {
                const cachedShowData = parseShow(readFile(path.join(showsPath, `${name}.show`)) || "{}")
                const cachedTxt = cachedShowData?.[1] ? getTextCacheString(cachedShowData[1]) : ""
                if (cachedTxt) textCache[matchingShowId] = cachedTxt
            }
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

export async function loadShowsAsync(returnShows = false, reCacheNames: string[] = []) {
    const showsPath = getDataFolderPath("shows")

    // list all shows in folder
    const allFiles = await readFolderAsync(showsPath)
    const filesInFolder = allFiles
        .filter((name) => name.toLowerCase().endsWith(".show"))
        .map((name) => name.slice(0, -5)) // remove .show extension
        .filter((trimmedName) => trimmedName) // remove files with no name

    const cachedShows = getStore("SHOWS") || {}
    const newCachedShows: TrimmedShows = {}
    const textCache: { [key: string]: string } = {}
    const existingCacheText: { [key: string]: string } = getStore("CACHE")?.text || {}

    // send already cached shows to the frontend immediately
    if (!returnShows && !reCacheNames.length && Object.keys(cachedShows).length) {
        sendMain(Main.SHOWS, cachedShows)
    }

    // create a map for quick lookup of cached shows by name
    const cachedShowNames = new Map<string, string>()
    for (const [id, show] of Object.entries(cachedShows)) {
        if (show?.name && !reCacheNames.includes(show.name)) cachedShowNames.set(show.name, id)
    }

    const BATCH_SIZE = 50
    for (let i = 0; i < filesInFolder.length; i += BATCH_SIZE) {
        const batch = filesInFolder.slice(i, i + BATCH_SIZE)
        let hadIo = false

        await asyncPool(20, batch, async (name) => {
            const matchingShowId = cachedShowNames.get(name)
            if (matchingShowId && !newCachedShows[matchingShowId]) {
                newCachedShows[matchingShowId] = cachedShows[matchingShowId]
                // backfill: build text for an already-cached show that was never text-cached
                if (!existingCacheText[matchingShowId]) {
                    hadIo = true
                    const cachedShowData = parseShow((await readFileAsync(path.join(showsPath, `${name}.show`))) || "{}")
                    const cachedTxt = cachedShowData?.[1] ? getTextCacheString(cachedShowData[1]) : ""
                    if (cachedTxt) textCache[matchingShowId] = cachedTxt
                }
                return
            }

            hadIo = true
            const showPath: string = path.join(showsPath, `${name}.show`)
            const jsonData = (await readFileAsync(showPath)) || "{}"
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
        })

        if (hadIo) await new Promise((resolve) => setImmediate(resolve))
    }

    // send updated text cache
    if (Object.keys(textCache).length) {
        const cache = getStore("CACHE")
        cache.text = { ...cache.text, ...textCache }
        sendMain(Main.CACHE, cache)
    }

    if (returnShows) return newCachedShows

    setImmediate(() => setStore(_store.SHOWS, newCachedShows))

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
export function getShowsFromIds(showIds: string[], projectItems?: any[]) {
    const shows: Show[] = []
    const cachedShows = getStore("SHOWS")
    const showsPath = getDataFolderPath("shows")

    showIds.forEach((id) => {
        // Find if this is a project item (section/media)
        const projectItem = projectItems?.find((item) => item.id === id)

        if (projectItem && projectItem.type && projectItem.type !== "show") {
            const type = projectItem.type
            if (type === "section") {
                // Synthetic show for section header
                shows.push({
                    id,
                    name: projectItem.name || "Section",
                    type: "section",
                    color: projectItem.color || "",
                    notes: projectItem.notes || "",
                    data: projectItem.data || {},
                    meta: {},
                    settings: { activeLayout: "default" },
                    slides: {},
                    layouts: {},
                    media: {}
                } as any)
            } else if (type === "image" || type === "video" || type === "audio") {
                // Synthetic show for media slide
                const filename = upath.basename(id)
                shows.push({
                    id,
                    name: projectItem.name || filename,
                    type,
                    meta: {},
                    settings: { activeLayout: "default" },
                    slides: {
                        slide1: {
                            group: null,
                            color: null,
                            settings: {},
                            notes: "",
                            items: []
                        }
                    },
                    layouts: {
                        default: {
                            id: "default",
                            name: "Default",
                            notes: "",
                            slides: [
                                {
                                    id: "slide1",
                                    background: id
                                }
                            ]
                        }
                    },
                    media: {
                        [id]: {
                            id,
                            path: id,
                            type: "media"
                        }
                    }
                } as any)
            }
            return
        }

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
// how: Place any file in your Documents/FreeShow folder that has the FIXES key in it's name (e.g. OPEN_APPDATA_SETTINGS), when you now start your app the fix will be triggered!
const FIXES = {
    OPEN_APPDATA_SETTINGS: () => {
        // this will open the "settings.json" file located at the app data location (can also be used to find other setting files here)
        openInSystem(_store.SETTINGS?.path || "", true)
    },
    ADMIN_PROFILE: () => {
        setAutoProfile("admin")
    }
}
export function specialCaseFixer() {
    const defaultDataFolder = getDefaultDataFolderRoot()
    if (!doesPathExist(defaultDataFolder)) return

    const files: string[] = readFolder(defaultDataFolder)
    files.forEach((fileName) => {
        const matchFound = Object.keys(FIXES).find((key) => fileName.includes(key))
        if (matchFound) FIXES[matchFound as keyof typeof FIXES]()
    })
}
