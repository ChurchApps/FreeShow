// ----- FreeShow -----
// Functions to interact with local files

import { app, dialog, shell } from "electron"
import { ExifImage } from "exif"
import fs from "fs"
import { Stats } from "original-fs"
import path from "path"
import { FILE_INFO, MAIN, OPEN_FOLDER, READ_FOLDER, SHOW } from "../../types/Channels"
import { OPEN_FILE, READ_EXIF } from "./../../types/Channels"
import { mainWindow, toApp } from "./../index"

// GENERAL

export function doesPathExist(path: string): boolean {
    try {
        return fs.existsSync(path)
    } catch (err: any) {
        console.error("Error when checking path:", err)
    }

    return false
}

export function readFile(path: string, encoding: BufferEncoding = "utf8"): string {
    try {
        return fs.readFileSync(path, encoding)
    } catch (err: any) {
        console.error("Error when reading file:", err)
        return ""
    }
}

export function readFolder(path: string): string[] {
    try {
        return fs.readdirSync(path)
    } catch (err: any) {
        console.error("Error when reading folder:", err)
        return []
    }
}

export function writeFile(path: string, content: string | NodeJS.ArrayBufferView, id: string = "") {
    // don't know if it's necessary to check the file
    if (fileContentMatches(content, path)) return

    fs.writeFile(path, content, (err) => {
        if (err) {
            if (id) toApp(SHOW, { error: "no_write", err, id })
            console.error("Error when writing to file: ", err)
        }
    })
}

export function deleteFile(path: string) {
    fs.unlink(path, (err) => {
        if (err) {
            console.error("Could not delete file:", err)
        }
    })
}

export function renameFile(p: string, oldName: string, newName: string) {
    let oldPath = path.join(p, oldName)
    let newPath = path.join(p, newName)

    fs.rename(oldPath, newPath, (err) => {
        if (err) {
            console.error("Could not delete file:", err)
        }
    })
}

export function getFileStats(p: string) {
    try {
        const stat: Stats = fs.statSync(p)
        return { path: p, stat, extension: path.extname(p).substring(1), folder: stat.isDirectory() }
    } catch (err) {
        console.error("Error when getting file stats: ", err)
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
    // this will show an error alert when path don't exist (trycatch don't work on this)
    shell.openPath(path)
}

export function getDocumentsFolder(p: any = null, folderName: string = "Shows"): string {
    if (!p) p = path.resolve(app.getPath("documents"), "FreeShow", folderName)
    if (!doesPathExist(p)) p = fs.mkdirSync(p, { recursive: true })
    return p
}

export function checkShowsFolder(path: string): string {
    if (path && doesPathExist(path)) return path

    path = getDocumentsFolder()
    toApp(MAIN, { channel: "SHOWS_PATH", data: path })

    return path
}

// HELPERS

export function fileContentMatches(content: string | NodeJS.ArrayBufferView, path: string): boolean {
    if (doesPathExist(path) && content === readFile(path)) return true
    return false
}

export function loadFile(p: string, contentId: string = ""): any {
    let content: any = "{}"

    if (!doesPathExist(p)) return { error: "not_found", id: contentId }

    content = readFile(p)
    if (!content) return { error: "not_found", id: contentId }

    try {
        content = JSON.parse(content)
    } catch (error) {
        console.log(error)
        return { error: "not_found", id: contentId }
    }
    if (contentId && content[0] !== contentId) return { error: "not_found", id: contentId, file_id: content[0] }

    return { id: contentId, content }
}

export function getPaths(): any {
    let paths: any = {
        documents: app.getPath("documents"),
        pictures: app.getPath("pictures"),
        videos: app.getPath("videos"),
        music: app.getPath("music"),
    }

    // this will create "documents/Shows" folder if it doesen't exist
    paths.shows = getDocumentsFolder()

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
        folders.forEach((folder) => {
            let fileList: string[] = readFolder(folder.path)
            if (!fileList.length) return

            for (const name of fileList) {
                let p: string = path.join(folder.path, name)
                let stats: any = getFileStats(p)
                if (stats && !stats.folder) filesInFolders.push({ ...stats, name })
            }
        })
    }

    toApp(READ_FOLDER, { path: folderPath, files, filesInFolders })
}

// OPEN_FOLDER
export function selectFolder(e: any, msg: { channel: string; title: string | undefined; path: string | undefined }) {
    let folder: any = selectFolderDialog(msg.title, msg.path)
    if (folder) e.reply(OPEN_FOLDER, { channel: msg.channel, data: { path: folder } })
}

// OPEN_FILE
export function selectFiles(e: any, msg: { channel: string; title?: string; filter: any; multiple: boolean; read?: boolean }) {
    let files: any = selectFilesDialog(msg.title, msg.filter, msg.multiple === undefined ? true : msg.multiple)
    if (files) {
        let content: any = {}
        if (msg.read) {
            files.forEach((path: string) => {
                content[path] = readFile(path)
            })
        }

        e.reply(OPEN_FILE, { channel: msg.channel || "", data: { files, content } })
    }
}

// FILE_INFO
export function getFileInfo(e: any, filePath: string) {
    let stats: any = getFileStats(filePath)
    if (stats) e.reply(FILE_INFO, stats)
}

// READ EXIF
export function readExifData(e: any, data: any) {
    try {
        new ExifImage({ image: data.id }, function (error, exifData) {
            if (error) console.log("Error: " + error.message)
            else e.reply(READ_EXIF, { ...data, exif: exifData })
        })
    } catch (error) {
        console.log("Error: " + error.message)
    }
}

// SEARCH FOR MEDIA FILE (in drawer media folders & their following folders)
export function locateMediaFile({ fileName, folders, ref }: any) {
    let matches: string[] = []
    findMatches()

    if (matches.length !== 1) return
    toApp(MAIN, { channel: "LOCATE_MEDIA_FILE", data: { path: matches[0], ref } })

    /////

    function findMatches() {
        for (const folderPath of folders) {
            if (matches.length > 1) return

            checkFolderForMatches(folderPath)

            if (matches.length) return

            let files = readFolder(folderPath)
            for (const name of files) {
                if (matches.length) return

                let p: string = path.join(folderPath, name)
                let fileStat = getFileStats(p)
                if (fileStat?.folder) checkFolderForMatches(p)
            }
        }
    }

    function checkFolderForMatches(folderPath: string) {
        let files = readFolder(folderPath)

        for (const name of files) {
            if (matches.length > 1) return

            if (name === fileName) {
                let p: string = path.join(folderPath, name)
                matches.push(p)
            }
        }
    }
}
