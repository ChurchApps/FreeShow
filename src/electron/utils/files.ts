// ----- FreeShow -----
// Functions to interact with local files

import { app, dialog, shell } from "electron"
import { ExifImage } from "exif"
import fs from "fs"
import { Stats } from "original-fs"
import path, { join, parse } from "path"
import { uid } from "uid"
import { FILE_INFO, MAIN, OPEN_FOLDER, READ_FOLDER, SHOW, STORE } from "../../types/Channels"
import { stores } from "../data/store"
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

export function readFile(path: string, encoding: BufferEncoding = "utf8"): string {
    try {
        return fs.readFileSync(path, encoding)
    } catch (err: any) {
        actionComplete(err, "Error when reading file")
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

export function getFileStats(p: string) {
    try {
        const stat: Stats = fs.statSync(p)
        return { path: p, stat, extension: path.extname(p).substring(1), folder: stat.isDirectory() }
    } catch (err) {
        actionComplete(err, "Error when getting file stats")
        return null
    }
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
    if (!p) p = path.resolve(...folderPath)
    if (!doesPathExist(p)) p = fs.mkdirSync(p, { recursive: true })

    return p
}

export function checkShowsFolder(path: string): string {
    if (!path) {
        path = getDocumentsFolder()
        toApp(MAIN, { channel: "SHOWS_PATH", data: path })
        return path
    }

    if (doesPathExist(path)) return path

    return fs.mkdirSync(path, { recursive: true }) || path
}

export const dataFolderNames = {
    backups: "Backups",
    scriptures: "Bibles",
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
    return fs.mkdirSync(path, { recursive: true }) || path
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

// READ_FOLDER
export function getFolderContent(_e: any, data: any) {
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
        if (stats) files.push({ ...stats, name })
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
export function selectFolder(e: any, msg: { channel: string; title: string | undefined; path: string | undefined }) {
    let folder: any = selectFolderDialog(msg.title, msg.path)

    if (!folder) return

    // only when initializing
    if (msg.channel === "DATA_SHOWS") {
        e.reply(OPEN_FOLDER, { channel: msg.channel, data: { path: folder, showsPath: path.join(folder, "Shows") } })
        return
    }

    if (msg.channel === "SHOWS") {
        loadShows({ showsPath: folder })
        toApp(MAIN, { channel: "FULL_SHOWS_LIST", data: getAllShows({ path: folder }) })
    }

    e.reply(OPEN_FOLDER, { channel: msg.channel, data: { path: folder } })
}

// OPEN_FILE
export function selectFiles(e: any, msg: { id: string; channel: string; title?: string; filter: any; multiple: boolean; read?: boolean }) {
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
export function getFileInfo(e: any, filePath: string) {
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

// SEARCH FOR MEDIA FILE (in drawer media folders & their following folders)
export function locateMediaFile({ fileName, splittedPath, folders, ref }: any) {
    let matches: string[] = []

    findMatches(true)
    if (matches.length < 1) findMatches()
    if (matches.length < 1) return

    toApp(MAIN, { channel: "LOCATE_MEDIA_FILE", data: { path: matches[0], ref } })

    /////

    function findMatches(searchWithFolder: boolean = false) {
        for (const folderPath of folders) {
            if (matches.length > 1) return

            checkFolderForMatches(folderPath, searchWithFolder)

            if (matches.length) return

            let files = readFolder(folderPath)
            for (const name of files) {
                if (matches.length) return

                let p: string = path.join(folderPath, name)
                let fileStat = getFileStats(p)
                if (fileStat?.folder) checkFolderForMatches(p, searchWithFolder)
            }
        }
    }

    function checkFolderForMatches(folderPath: string, searchWithFolder: boolean = false) {
        let files = readFolder(folderPath)

        let folderName = path.basename(folderPath)
        let searchName = fileName
        if (searchWithFolder && splittedPath?.length > 1) searchName = path.join(splittedPath[splittedPath.length - 2], fileName)

        for (let name of files) {
            if (matches.length > 1) return

            let pathName = searchWithFolder ? path.join(folderName, name) : name
            if (pathName === searchName) {
                let p: string = path.join(folderPath, name)
                matches.push(p)
            }
        }
    }
}

// LOAD SHOWS

export function loadShows({ showsPath }: any) {
    // list all shows in folder
    let filesInFolder: string[] = readFolder(showsPath)

    let cachedShows = stores.SHOWS.store
    let newCachedShows: any = {}

    for (const name of filesInFolder) checkShow(name)
    function checkShow(name: string) {
        if (!name.toLowerCase().includes(".show")) return

        let trimmedName = name.slice(0, -5) // remove .show

        // no name results in the id trying to be read leading to show not found
        if (!trimmedName) return

        let matchingShowId = Object.entries(cachedShows).find(([_id, a]: any) => a.name === trimmedName)?.[0]
        if (matchingShowId && !newCachedShows[matchingShowId]) {
            newCachedShows[matchingShowId] = cachedShows[matchingShowId]
            return
        }

        let p: string = path.join(showsPath, name)
        let jsonData = readFile(p) || "{}"
        let show = parseShow(jsonData)

        if (!show || !show[1]) return

        let id = show[0]
        // some old duplicated shows might have the same id
        if (newCachedShows[id]) id = uid()

        newCachedShows[id] = trimShow({ ...show[1], name: trimmedName })
    }

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
