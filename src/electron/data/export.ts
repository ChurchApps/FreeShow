// ----- FreeShow -----
// Export as TXT or PDF
// When exporting as PDF we create a new window and capture its content

import AdmZip from "adm-zip"
import { BrowserWindow, ipcMain } from "electron"
import fs, { type WriteFileOptions } from "fs"
import { basename, extname, join } from "path"
import { EXPORT, STARTUP } from "../../types/Channels"
import { ToMain } from "../../types/IPC/ToMain"
import type { Show, Slide, Template } from "../../types/Show"
import type { Message } from "../../types/Socket"
import { isProd } from "../index"
import { sendToMain } from "../IPC/main"
import { doesPathExist, getDataFolderPath, getShowsFromIds, getTimePointString, makeDir, openInSystem, parseShow, readFile } from "../utils/files"
import { getAllShows } from "../utils/shows"
import { exportOptions } from "../utils/windowOptions"
import { filePathHashCode } from "./thumbnails"

// SHOW: .show, PROJECT: .project, BIBLE: .fsb
const customJSONExtensions = {
    TEMPLATE: ".fstemplate",
    THEME: ".fstheme"
}

export function startExport(_e: Electron.IpcMainEvent, msg: Message) {
    if (!msg.data) return

    if (msg.channel === "TEMPLATE") {
        exportTemplate(msg.data)
        return
    }

    const customExt = customJSONExtensions[msg.channel as keyof typeof customJSONExtensions]
    if (customExt) {
        const exportFolder = getDataFolderPath("exports")
        exportJSON(msg.data.content, customExt, exportFolder)
        return
    }

    if (msg.channel === "USAGE") {
        const usageFolder = getDataFolderPath("exports", "Usage")
        exportJSONFile(msg.data.content, usageFolder, getTimePointString())
        return
    }

    if (msg.channel === "ALL_SHOWS") {
        exportAllShows(msg.data)
        return
    }

    if (msg.channel !== "GENERATE") return

    if (msg.data.showIds) {
        // load shows
        msg.data.shows = getShowsFromIds(msg.data.showIds)
    }

    if (msg.data.type === "project") exportProject(msg.data)
    else if (msg.data.type === "pdf") createPDFWindow(msg.data)

    const exportFolder = getDataFolderPath("exports")
    const showNames: string[] = msg.data.showNames || []
    const shows = getShowContent(showNames.map(name => name + ".show"))

    if (msg.data.type === "show") exportShow({ shows, path: exportFolder })
    else if (msg.data.type === "txt") exportTXT({ shows, path: exportFolder })
}

// only open once per session
let systemOpened = false
function doneWritingFile(err: NodeJS.ErrnoException | null, exportFolder: string, toMain = true) {
    let msg = "export.exported"

    // open export location in system when completed
    if (!err && !systemOpened) {
        openInSystem(exportFolder, true)
        systemOpened = true
    } else if (err) msg = err.toString()

    if (toMain) sendToMain(ToMain.ALERT, msg)
}

// ----- PDF -----

const PDFOptions = {
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    pageSize: "A4" as const,
    printBackground: true,
    landscape: false
}

export function generatePDF(path: string) {
    exportWindow?.webContents.printToPDF(PDFOptions).then(savePdf).catch(exportMessage)

    function savePdf(data: Buffer) {
        writeFile(path, ".pdf", data, undefined, doneWritingPDF)
    }

    function doneWritingPDF(err: NodeJS.ErrnoException | null) {
        if (err) return exportMessage(err.toString())

        exportWindow?.webContents.send(EXPORT, { channel: "NEXT" })
    }
}

function exportMessage(message = "") {
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
    const exportFolderPath = getDataFolderPath("exports")

    if (msg.channel === "DONE") {
        doneWritingFile(null, exportFolderPath)
        return
    }
    if (msg.channel !== "EXPORT") return

    if (!msg.data?.name) return
    sendToMain(ToMain.ALERT, msg.data.name)
    if (msg.data.type === "pdf") generatePDF(join(exportFolderPath, msg.data.name))
})

// ----- JSON -----

export function exportJSON(content: any, extension: string, path: string, name = "") {
    writeFile(join(path, name || content.name || "Unnamed"), extension, JSON.stringify(content, null, 4), "utf-8", err => doneWritingFile(err, path))
}

export function exportJSONFile(content: any, path: string, name: string) {
    writeFile(join(path, name), ".json", JSON.stringify(content, null, 4), "utf-8", err => doneWritingFile(err, path))
}

// ----- SHOW -----

export function exportShow(data: { path: string; shows: Show[] }) {
    console.log(data.path, data.shows.length)
    data.shows.forEach((show, i) => {
        const id = show.id
        delete show.id

        writeFile(join(data.path, show.name || id!), ".show", JSON.stringify([id, show]), "utf-8", err => doneWritingFile(err, data.path, i >= data.shows.length - 1))
    })
}

// ----- TXT -----

export function exportTXT(data: { path: string; shows: Show[] }) {
    data.shows.forEach((show, i) => {
        writeFile(join(data.path, show.name || show.id!), ".txt", getSlidesText(show), "utf-8", err => doneWritingFile(err, data.path, i >= data.shows.length - 1))
    })
}

// WIP do this in frontend
function getSlidesText(show: Show) {
    let text = ""

    const slides: Slide[] = []
    show.layouts?.[show.settings?.activeLayout].slides.forEach(layoutSlide => {
        const slide = show.slides[layoutSlide.id]
        if (!slide) return

        slides.push(slide)
        if (!slide.children) return

        slide.children.forEach((childId: string) => {
            const childSlide = show.slides[childId]
            slides.push(childSlide)
        })
    })

    slides.forEach(slide => {
        if (slide.group) text += "[" + slide.group + "]\n"

        slide.items.forEach(item => {
            if (!item.lines) return

            item.lines.forEach(line => {
                if (!Array.isArray(line?.text)) return

                line.text.forEach(txt => {
                    text += txt.value
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

function getShowContent(showNames: string[]) {
    const showsData: Show[] = []
    const showsPath = getDataFolderPath("shows")

    for (const showName of showNames) {
        const showFilePath = join(showsPath, showName)
        const showContent = parseShow(readFile(showFilePath))

        if (showContent?.[1]) showsData.push({ ...showContent[1], id: showContent[0] })
    }

    return showsData
}

function exportAllShows(data: { type: string }) {
    const type = data.type

    const supportedTypes = ["txt", "show"]
    if (!supportedTypes.includes(type)) return

    const shows = getShowContent(getAllShows())
    if (shows.length) {
        const exportFolder = getDataFolderPath("exports")
        // create custom folder to organize the amount of files
        const showsExportFolder = join(exportFolder, getTimePointString())
        makeDir(showsExportFolder)

        if (type === "show") exportShow({ shows, path: showsExportFolder })
        else if (type === "txt") exportTXT({ shows, path: showsExportFolder })
    } else {
        sendToMain(ToMain.ALERT, "Exported 0 shows!")
    }
}

// ----- PROJECT -----

export function exportProject(data: { type: "project"; name: string; file: any }) {
    sendToMain(ToMain.ALERT, "export.exporting")
    const exportFolder = getDataFolderPath("exports")

    const files: string[] = data.file.files || []
    if (!files.length) {
        // export as plain JSON
        writeFile(join(exportFolder, data.name), ".project", JSON.stringify(data.file), "utf-8", err => doneWritingFile(err, exportFolder))
        return
    }

    // create archive
    const zip = new AdmZip()

    // copy files
    files.forEach(path => {
        try {
            // file might not exist
            const extension = extname(path)
            const hashedFileName = `${basename(path, extension)}__${filePathHashCode(path)}${extension}`
            zip.addLocalFile(path, "", hashedFileName)
        } catch (err) {
            console.error("Could not add a file to project:", err)
        }
    })

    // add project file
    zip.addFile("data.json", Buffer.from(JSON.stringify(data.file)))

    const outputPath = join(exportFolder, data.name)
    const filePath = getUniquePath(outputPath, ".project")
    zip.writeZip(filePath, err => doneWritingFile(err, exportFolder))
}

// ----- TEMPLATE -----

export function exportTemplate(data: { file: { template: Template; files?: string[] }; name: string }) {
    sendToMain(ToMain.ALERT, "export.exporting")
    const exportFolder = getDataFolderPath("exports")

    const files: string[] = data.file.files || []
    if (!files.length) {
        // export as plain JSON
        delete data.file.files
        exportJSON(data.file, customJSONExtensions.TEMPLATE, exportFolder, data.name)
        return
    }

    // create archive
    const zip = new AdmZip()

    // copy files
    files.forEach(path => {
        try {
            // file might not exist
            zip.addLocalFile(path)
        } catch (err) {
            console.error("Could not add a file to project:", err)
        }
    })

    // add project file
    zip.addFile("data.json", Buffer.from(JSON.stringify(data.file)))

    const outputPath = join(exportFolder, data.name)
    const filePath = getUniquePath(outputPath, customJSONExtensions.TEMPLATE)
    zip.writeZip(filePath, err => doneWritingFile(err, exportFolder))
}

// ----- HELPERS -----

function writeFile(path: string, extension: string, data: string | Buffer, options: WriteFileOptions = {}, callback: (err: NodeJS.ErrnoException | null) => void) {
    const filePath = getUniquePath(path, extension)
    fs.writeFile(filePath, data, options, callback)
}

function getUniquePath(path: string, extension: string) {
    let num = -1
    let filePath: string = path

    do {
        num++
        filePath = path + (num ? "_" + num.toString() : "") + extension
    } while (doesPathExist(filePath))

    return filePath
}
