// ----- FreeShow -----
// Export as TXT or PDF
// When exporting as PDF we create a new window and capture its content

import AdmZip from "adm-zip"
import { BrowserWindow, ipcMain } from "electron"
import fs from "fs"
import { join } from "path"
import { EXPORT, STARTUP } from "../../types/Channels"
import { Main } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"
import type { Show, Slide } from "../../types/Show"
import type { Message } from "../../types/Socket"
import { isProd } from "../index"
import { sendMain, sendToMain } from "../IPC/main"
import { createFolder, dataFolderNames, doesPathExist, getDataFolder, getShowsFromIds, getTimePointString, makeDir, openSystemFolder, parseShow, readFile, selectFolderDialog } from "../utils/files"
import { getAllShows } from "../utils/shows"
import { exportOptions } from "../utils/windowOptions"

// SHOW: .show, PROJECT: .project, BIBLE: .fsb
const customJSONExtensions = {
    TEMPLATE: ".fstemplate",
    THEME: ".fstheme",
}

export function startExport(_e: Electron.IpcMainEvent, msg: Message) {
    if (!msg.data) return
    let dataPath: string = msg.data.path

    if (!dataPath) {
        dataPath = selectFolderDialog()
        if (!dataPath) return

        sendMain(Main.DATA_PATH, dataPath)
    }

    msg.data.path = getDataFolder(dataPath, dataFolderNames.exports)

    let customExt = customJSONExtensions[msg.channel as keyof typeof customJSONExtensions]
    if (customExt) {
        exportJSON(msg.data.content, customExt, msg.data.path)
        return
    }

    if (msg.channel === "USAGE") {
        let path = createFolder(join(msg.data.path, "Usage"))
        exportJSONFile(msg.data.content, path, getTimePointString())
        return
    }

    if (msg.channel === "ALL_SHOWS") {
        exportAllShows(msg.data)
        return
    }

    if (msg.channel !== "GENERATE") return

    if (msg.data.showIds && msg.data.showsPath) {
        // load shows
        msg.data.shows = getShowsFromIds(msg.data.showIds, msg.data.showsPath)
    }

    if (msg.data.type === "pdf") createPDFWindow(msg.data)
    else if (msg.data.type === "show") exportShow(msg.data)
    else if (msg.data.type === "txt") exportTXT(msg.data)
    else if (msg.data.type === "project") exportProject(msg.data)
}

// only open once per session
let systemOpened: boolean = false
function doneWritingFile(err: NodeJS.ErrnoException | null, exportFolder: string, toMain: boolean = true) {
    let msg: string = "export.exported"

    // open export location in system when completed
    if (!err && !systemOpened) {
        openSystemFolder(exportFolder)
        systemOpened = true
    } else if (err) msg = err.toString()

    if (toMain) sendToMain(ToMain.ALERT, msg)
}

// ----- PDF -----

const options = {
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    pageSize: "A4" as "A4",
    printBackground: true,
    landscape: false,
}

export function generatePDF(path: string) {
    exportWindow?.webContents.printToPDF(options).then(savePdf).catch(exportMessage)

    function savePdf(data: Buffer) {
        writeFile(path, ".pdf", data, undefined, doneWritingFile)
    }

    function doneWritingFile(err: NodeJS.ErrnoException | null) {
        if (err) return exportMessage(err.toString())

        exportWindow?.webContents.send(EXPORT, { channel: "NEXT" })
    }
}

function exportMessage(message: string = "") {
    sendToMain(ToMain.ALERT, message)

    exportWindow?.on("closed", () => (exportWindow = null))
    exportWindow?.close()
}

let exportWindow: BrowserWindow | null = null
export function createPDFWindow(data: any) {
    exportWindow = new BrowserWindow(exportOptions)

    // load path
    if (isProd) exportWindow.loadFile("public/index.html")
    else exportWindow.loadURL("http://localhost:3000")

    exportWindow.webContents.once("did-finish-load", windowLoaded)
    function windowLoaded() {
        exportWindow?.webContents.send(STARTUP, { channel: "TYPE", data: "pdf" })
        exportWindow?.webContents.send(EXPORT, { channel: "PDF", data })
    }
}

ipcMain.on(EXPORT, (_e, msg: any) => {
    if (!msg.data?.path) return

    if (msg.channel === "DONE") {
        doneWritingFile(null, msg.data.path)
        return
    }
    if (msg.channel !== "EXPORT") return

    if (!msg.data?.name) return
    sendToMain(ToMain.ALERT, msg.data.name)
    if (msg.data.type === "pdf") generatePDF(join(msg.data.path, msg.data.name))
})

// ----- JSON -----

export function exportJSON(content: any, extension: string, path: string) {
    writeFile(join(path, content.name || "Unnamed"), extension, JSON.stringify(content, null, 4), "utf-8", (err) => doneWritingFile(err, path))
}

export function exportJSONFile(content: any, path: string, name: string) {
    writeFile(join(path, name), ".json", JSON.stringify(content, null, 4), "utf-8", (err) => doneWritingFile(err, path))
}

// ----- SHOW -----

export function exportShow(data: { path: string; shows: Show[] }) {
    data.shows.forEach((show, i) => {
        let id = show.id
        delete show.id

        writeFile(join(data.path, show.name || id!), ".show", JSON.stringify([id, show]), "utf-8", (err) => doneWritingFile(err, data.path, i >= data.shows.length - 1))
    })
}

// ----- TXT -----

export function exportTXT(data: { path: string; shows: Show[] }) {
    data.shows.forEach((show, i) => {
        writeFile(join(data.path, show.name || show.id!), ".txt", getSlidesText(show), "utf-8", (err) => doneWritingFile(err, data.path, i >= data.shows.length - 1))
    })
}

// WIP do this in frontend
function getSlidesText(show: Show) {
    let text: string = ""

    let slides: Slide[] = []
    show.layouts?.[show.settings?.activeLayout].slides.forEach((layoutSlide) => {
        let slide = show.slides[layoutSlide.id]
        if (!slide) return

        slides.push(slide)
        if (!slide.children) return

        slide.children.forEach((childId: string) => {
            let slide = show.slides[childId]
            slides.push(slide)
        })
    })

    slides.forEach((slide) => {
        if (slide.group) text += "[" + slide.group + "]\n"

        slide.items.forEach((item) => {
            if (!item.lines) return

            item.lines.forEach((line) => {
                if (!line.text) return

                line.text.forEach((t) => {
                    text += t.value
                })
                text += "\n"
            })

            text += "\n"
        })

        // no lines in this slide
        if (text.slice(text.length - 2) === "]\n") text += "\n"
    })

    text = text.replaceAll("\n\n\n", "\n\n")

    return text.trim()
}

// ----- ALL SHOWS -----

function exportAllShows(data: { type: string; showsPath: string; path: string }) {
    let type = data.type

    const supportedTypes = ["txt", "show"]
    if (!supportedTypes.includes(type)) return

    let allShows: string[] = getAllShows({ path: data.showsPath })
    let shows: Show[] = []
    for (let i = 0; i < allShows.length; i++) {
        const showName: string = allShows[i]
        const showFilePath = join(data.showsPath, showName)
        // WIP override existing instead of creating new?
        const showContent = parseShow(readFile(showFilePath))

        if (showContent?.[1]) shows.push({ ...showContent[1], id: showContent[0] })
    }

    if (shows.length) {
        // create custom folder to organize the amount of files
        data.path = join(data.path, getTimePointString())
        makeDir(data.path)

        if (type === "show") exportShow({ ...data, shows })
        else if (type === "txt") exportTXT({ ...data, shows })
    } else {
        sendToMain(ToMain.ALERT, "Exported 0 shows!")
    }
}

// ----- PROJECT -----

export function exportProject(data: { type: "project"; path: string; name: string; file: any }) {
    sendToMain(ToMain.ALERT, "export.exporting")

    const files: string[] = data.file.files || []
    if (!files.length) {
        // export as plain JSON
        writeFile(join(data.path, data.name), ".project", JSON.stringify(data.file), "utf-8", (err) => doneWritingFile(err, data.path))
        return
    }

    // create archive
    const zip = new AdmZip()

    // copy files
    files.forEach((path) => {
        try {
            // file might not exist
            zip.addLocalFile(path)
        } catch (err) {
            console.error("Could not add a file to project:", err)
        }
    })

    // add project file
    zip.addFile("data.json", Buffer.from(JSON.stringify(data.file)))

    const outputPath = join(data.path, data.name)
    let p = getUniquePath(outputPath, ".project")
    zip.writeZip(p, (err) => doneWritingFile(err, data.path))
}

// ----- HELPERS -----

function writeFile(path: string, extension: string, data: string | Buffer, options: any = undefined, callback: (err: NodeJS.ErrnoException | null) => void) {
    let p = getUniquePath(path, extension)
    fs.writeFile(p, data, options, callback)
}

function getUniquePath(path: string, extension: string) {
    let number = -1
    let p: string = path

    do {
        number++
        p = path + (number ? "_" + number : "") + extension
    } while (doesPathExist(p))

    return p
}
