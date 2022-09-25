import { OPEN_FILE } from "./../../types/Channels"
// ----- FreeShow -----
// Functions to interact with local files

import { app, dialog } from "electron"
import fs from "fs"
import { Stats } from "original-fs"
import path from "path"
import { FILE_INFO, MAIN, OPEN_FOLDER, READ_FOLDER, SHOW } from "../../types/Channels"
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

export function readFile(path: string): string {
  try {
    return fs.readFileSync(path, "utf8")
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

export function writeFile(path: string, content: string, id: string = "") {
  // don't know if it's necessary to check the file
  if (fileContentMatches(content, path)) return

  fs.writeFile(path, content, (err) => {
    if (err) {
      toApp(SHOW, { error: "no_write", err, id })
      console.error("Error when writing to file: ", err)
    }
  })
}

function getFileStats(p: string) {
  try {
    const stat: Stats = fs.statSync(p)
    return { path: p, stat, extension: path.extname(p).substring(1), folder: stat.isDirectory() }
  } catch (err) {
    console.error("Error when getting file stats: ", err)
    return null
  }
}

// SELECT DIALOGS

export function selectFilesDialog(filters: any, multiple: boolean = true): string[] {
  let options: any = { properties: ["openFile"], filters: [{ name: filters.name, extensions: filters.extensions }] }
  if (multiple) options.properties.push("multiSelections")
  let files: string[] = dialog.showOpenDialogSync(mainWindow!, options) || []
  return files
}

export function selectFolderDialog(title: string = ""): string {
  let options: any = { properties: ["openDirectory"] }
  if (title) options.title = title
  let path: string[] = dialog.showOpenDialogSync(mainWindow!, options) || [""]
  return path[0]
}

// DATA FOLDERS

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

export function fileContentMatches(content: string, path: string): boolean {
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
export function getFolderContent(_e: any, folderPath: string) {
  let fileList: string[] = readFolder(folderPath)
  if (!fileList.length) return

  let files: any[] = []
  for (const name of fileList) {
    let p: string = path.join(folderPath, name)
    let stats: any = getFileStats(p)
    if (stats) files.push({ ...stats, name })
  }

  if (!files.length) return
  toApp(READ_FOLDER, { path: folderPath, files })
}

// OPEN_FOLDER
export function selectFolder(e: any, msg: { channel: string; title: string | undefined }) {
  let folder: any = selectFolderDialog(msg.title)
  if (folder) e.reply(OPEN_FOLDER, { channel: msg.channel, data: { path: folder } })
}

// OPEN_FILE
export function selectFiles(e: any, msg: { filter: any; multiple: boolean }) {
  let files: any = selectFilesDialog(msg.filter, msg.multiple === undefined ? true : msg.multiple)
  if (files) e.reply(OPEN_FILE, { files })
}

// FILE_INFO
export function getFileInfo(e: any, filePath: string) {
  let stats: any = getFileStats(filePath)
  if (stats) e.reply(FILE_INFO, stats)
}
