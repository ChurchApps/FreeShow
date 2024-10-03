// ----- FreeShow -----
// Functions to interact with local files

import { app, dialog, shell } from "electron"
import { ExifImage } from "exif"
import fs, { type Stats } from "fs"
import path, { join, parse } from "path"
import { uid } from "uid"
import { FILE_INFO, MAIN, OPEN_FOLDER, OUTPUT, READ_FOLDER, SHOW, STORE } from "../../types/Channels"
import { Show } from "../../types/Show"
import { defaultSettings } from "../data/defaults"
import { stores } from "../data/store"
import { createThumbnail } from "../data/thumbnails"
import { OutputHelper } from "../output/OutputHelper"
import { OPEN_FILE } from "./../../types/Channels"
import { mainWindow, toApp } from "./../index"
import { getAllShows, trimShow } from "./responses"

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

export async function readFileAsync(path: string, encoding: BufferEncoding = "utf8"): Promise<string> {
    return new Promise((resolve) =>
        fs.readFile(path, (err, buffer) => {
            if (err) console.error(err)
            resolve(err ? "" : buffer.toString(encoding))
        })
    )
}

export async function readFileBufferAsync(path: string): Promise<Buffer> {
    return new Promise((resolve) =>
        fs.readFile(path, (err, buffer) => {
            if (err) console.error(err)
            resolve(err ? Buffer.of(0) : buffer)
        })
    )
}

export async function readFolderAsync(path: string): Promise<string[]> {
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
export function getDocumentsFolder(p: any = null, folderName: string = "Shows"): string {
    let folderPath = [app.getPath("documents"), appFolderName]
    if (folderName) folderPath.push(folderName)
    if (!p) p = path.join(...folderPath)
    if (!doesPathExist(p)) p = makeDir(p)

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
    backups: "Backups",
    scriptures: "Bibles",
    media_bundle: "Media",
    exports: "Exports",
    imports: "Imports",
    lessons: "Lessons",
    recordings: "Recordings",
    userData: "Config",
}

// DATA PATH
export function getDataFolder(dataPath: string, name: string) {
    if (!dataPath) return getDocumentsFolder(null, name)
    return createFolder(path.join(dataPath, name))
}

// HELPERS

function createFolder(path: string) {
    if (doesPathExist(path)) return path
    return makeDir(path)
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

export function getPaths(): any {
    let paths: any = {
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
    let paths: any = {}
    tempPaths.forEach((pathId: any) => {
        paths[pathId] = app.getPath(pathId)
    })

    return paths
}

// READ_FOLDER
const MEDIA_EXTENSIONS = [...defaultSettings.imageExtensions, ...defaultSettings.videoExtensions]
export function getFolderContent(data: any) {
    let folderPath: string = data.path
    let fileList: string[] = readFolder(folderPath)

    if (!fileList.length) {
        toApp(READ_FOLDER, { path: folderPath, files: [], filesInFolders: [] })
        return
    }

    let files: any[] = []
    for (const name of fileList) {
        let p: string = path.join(folderPath, name)
        let stats: any = getFileStats(p)
        if (stats) files.push({ ...stats, name, thumbnailPath: !data.disableThumbnails && isMedia() ? createThumbnail(p) : "" })

        function isMedia() {
            if (stats.folder) return false
            return MEDIA_EXTENSIONS.includes(stats.extension)
        }
    }

    if (!files.length) {
        toApp(READ_FOLDER, { path: folderPath, files: [], filesInFolders: [] })
        return
    }

    // get first "layer" of files inside folder for searching
    let filesInFolders: string[] = []
    if (data.listFilesInFolders) {
        let folders: any[] = files.filter((a) => a.folder)
        folders.forEach(getFilesInFolder)
    }

    function getFilesInFolder(folder: any) {
        let fileList: string[] = readFolder(folder.path)
        if (!fileList.length) return

        for (const name of fileList) {
            let p: string = path.join(folder.path, name)
            let stats: any = getFileStats(p)
            if (stats && !stats.folder) filesInFolders.push({ ...stats, name })
        }
    }

    toApp(READ_FOLDER, { path: folderPath, files, filesInFolders })
}

export function getSimularPaths(data: any) {
    let parentFolderPathNames = data.paths.map(getParentFolderName)
    let allFilePaths = parentFolderPathNames.map((parentPath: string) => readFolder(parentPath).map((a) => join(parentPath, a)))
    allFilePaths = [...new Set(allFilePaths.flat())]

    let simularArray: any[] = []
    data.paths.forEach((path: string) => {
        let originalFileName = parse(path).name

        allFilePaths.forEach((filePath: string) => {
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
export function selectFolder(msg: { channel: string; title: string | undefined; path: string | undefined }, e: any) {
    let folder: any = selectFolderDialog(msg.title, msg.path)

    if (!folder) return

    // only when initializing
    if (msg.channel === "DATA_SHOWS") {
        let dataPath = folder
        let showsPath = checkShowsFolder(path.join(folder, "Shows"))
        e.reply(OPEN_FOLDER, { channel: msg.channel, data: { path: dataPath, showsPath } })
        return
    }

    if (msg.channel === "SHOWS") {
        loadShows({ showsPath: folder })
        toApp(MAIN, { channel: "FULL_SHOWS_LIST", data: getAllShows({ path: folder }) })
    }

    e.reply(OPEN_FOLDER, { channel: msg.channel, data: { path: folder } })
}

// OPEN_FILE
export function selectFiles(msg: { id: string; channel: string; title?: string; filter: any; multiple: boolean; read?: boolean }, e: any) {
    let files: any = selectFilesDialog(msg.title, msg.filter, msg.multiple === undefined ? true : msg.multiple)
    if (!files) return

    let content: any = {}
    if (msg.read) files.forEach(getContent)
    function getContent(path: string) {
        content[path] = readFile(path)
    }

    e.reply(OPEN_FILE, { channel: msg.channel || "", data: { id: msg.id, files, content } })
}

// FILE_INFO
export function getFileInfo(filePath: string, e: any) {
    let stats: any = getFileStats(filePath)
    if (stats) e.reply(FILE_INFO, stats)
}

// READ EXIF
export function readExifData({ id }: any, e: any) {
    try {
        new ExifImage({ image: id }, (err, exifData) => {
            actionComplete(err, "Error getting EXIF data")
            if (!err) e.reply(MAIN, { channel: "READ_EXIF", data: { id, exif: exifData } })
        })
    } catch (err) {
        actionComplete(err, "Error loading EXIF image")
    }
}

//////

// SEARCH FOR MEDIA FILE (in drawer media folders & their following folders)
const NESTED_SEARCH = 8 // folder levels deep
export function locateMediaFile({ fileName, splittedPath, folders, ref }: any) {
    locateMediaFileAsync({ fileName, splittedPath, folders, ref })
}

async function locateMediaFileAsync({ fileName, splittedPath, folders, ref }: any) {
    let matches: string[] = []

    await findMatches()
    if (!matches.length) return

    toApp(MAIN, { channel: "LOCATE_MEDIA_FILE", data: { path: matches[0], ref } })

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

    toApp(STORE, { channel: "SHOWS", data: newCachedShows })
}

export function parseShow(jsonData: string) {
    let show = null

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
    let defaultDataFolder = getDocumentsFolder(null, "")
    let files: string[] = readFolder(defaultDataFolder)
    files.forEach((fileName) => {
        let matchFound = Object.keys(FIXES).find((key) => fileName.includes(key))
        if (matchFound) FIXES[matchFound]()
    })
}
