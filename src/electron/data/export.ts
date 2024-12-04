// ----- FreeShow -----
// Export as TXT or PDF
// When exporting as PDF we create a new window and capture its content

import fs from "fs"
import { join } from "path"
import AdmZip from "adm-zip"
import { BrowserWindow, ipcMain } from "electron"
import { EXPORT, MAIN, STARTUP } from "../../types/Channels"
import type { Message } from "../../types/Socket"
import { isProd, toApp } from "../index"
import { createFolder, dataFolderNames, doesPathExist, getDataFolder, getShowsFromIds, getTimePointString, makeDir, openSystemFolder, parseShow, readFile, selectFolderDialog } from "../utils/files"
import { getAllShows } from "../utils/shows"
import { exportOptions } from "../utils/windowOptions"

// SHOW: .show, PROJECT: .project, BIBLE: .fsb
const customJSONExtensions: any = {
    TEMPLATE: ".fstemplate",
    THEME: ".fstheme",
}

export function startExport(_e: any, msg: Message) {
    if (!msg.data) return
    let dataPath: string = msg.data.path

    if (!dataPath) {
        dataPath = selectFolderDialog()
        if (!dataPath) return

        toApp(MAIN, { channel: "DATA_PATH", data: dataPath })
    }

    msg.data.path = getDataFolder(dataPath, dataFolderNames.exports)

    const customExt = customJSONExtensions[msg.channel]
    if (customExt) {
        exportJSON(msg.data.content, customExt, msg.data.path)
        return
    }

    if (msg.channel === "USAGE") {
        const path = createFolder(join(msg.data.path, "Usage"))
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
let systemOpened = false
function doneWritingFile(err: any, exportFolder: string, toMain = true) {
    let msg = "export.exported"

    // open export location in system when completed
    if (!err && !systemOpened) {
        openSystemFolder(exportFolder)
        systemOpened = true
    } else if (err) msg = err

    if (toMain) toApp(MAIN, { channel: "ALERT", data: msg })
}

// ----- PDF -----

const options: any = {
    marginsType: 1,
    pageSize: "A4",
    printBackground: true,
    landscape: false,
}

export function generatePDF(path: string) {
    exportWindow?.webContents.printToPDF(options).then(savePdf).catch(exportMessage)

    function savePdf(data: any) {
        writeFile(path, ".pdf", data, undefined, doneWritingFile)
    }

    function doneWritingFile(err: any) {
        if (err) return exportMessage(err)

        exportWindow.webContents.send(EXPORT, { channel: "NEXT" })
    }
}

function exportMessage(message = "") {
    toApp(MAIN, { channel: "ALERT", data: message })

    exportWindow?.on("closed", () => (exportWindow = null))
    exportWindow?.close()
}

let exportWindow: any = null
export function createPDFWindow(data: any) {
    exportWindow = new BrowserWindow(exportOptions)

    // load path
    if (isProd) exportWindow.loadFile("public/index.html")
    else exportWindow.loadURL("http://localhost:3000")

    exportWindow.webContents.once("did-finish-load", windowLoaded)
    function windowLoaded() {
        exportWindow.webContents.send(STARTUP, { channel: "TYPE", data: "pdf" })
        exportWindow.webContents.send(EXPORT, { channel: "PDF", data })
    }
}

ipcMain.on(EXPORT, (_e, msg: any) => {
    if (!msg.data?.path) return

    if (msg.channel === "DONE") {
        doneWritingFile(false, msg.data.path)
        return
    }
    if (msg.channel !== "EXPORT") return

    if (!msg.data?.name) return
    toApp(MAIN, { channel: "ALERT", data: msg.data.name })
    if (msg.data.type === "pdf") generatePDF(join(msg.data.path, msg.data.name))
})

// ----- JSON -----

export function exportJSON(content: any, extension: string, path: string) {
    writeFile(join(path, content.name || "Unnamed"), extension, JSON.stringify(content, null, 4), "utf-8", (err: any) => doneWritingFile(err, path))
}

export function exportJSONFile(content: any, path: string, name: string) {
    writeFile(join(path, name), ".json", JSON.stringify(content, null, 4), "utf-8", (err: any) => doneWritingFile(err, path))
}

// ----- SHOW -----

export function exportShow(data: any) {
    data.shows.forEach((show: any, i: number) => {
        const id = show.id
        delete show.id

        writeFile(join(data.path, show.name || id), ".show", JSON.stringify([id, show]), "utf-8", (err: any) => doneWritingFile(err, data.path, i >= data.shows.length - 1))
    })
}

// ----- TXT -----

export function exportTXT(data: any) {
    data.shows.forEach((show: any, i: number) => {
        writeFile(join(data.path, show.name || show.id), ".txt", getSlidesText(show), "utf-8", (err: any) => doneWritingFile(err, data.path, i >= data.shows.length - 1))
    })
}

// WIP do this in frontend
function getSlidesText(show: any) {
    let text = ""

    const slides: any[] = []
    show.layouts?.[show.settings?.activeLayout].slides.forEach((layoutSlide: any) => {
        const slide = show.slides[layoutSlide.id]
        if (!slide) return

        slides.push(slide)
        if (!slide.children) return

        slide.children.forEach((childId: string) => {
            const slide = show.slides[childId]
            slides.push(slide)
        })
    })

    slides.forEach((slide) => {
        if (slide.group) text += "[" + slide.group + "]\n"

        slide.items.forEach((item: any) => {
            if (!item.lines) return

            item.lines.forEach((line: any) => {
                if (!line.text) return

                line.text.forEach((t: any) => {
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

function exportAllShows(data: any) {
    const type = data.type

    const supportedTypes = ["txt", "show"]
    if (!supportedTypes.includes(type)) return

    const allShows: string[] = getAllShows({ path: data.showsPath })
    const shows: any[] = []
    for (let i = 0; i < allShows.length; i++) {
        const showName: string = allShows[i]
        const showFilePath = join(data.showsPath, showName)
        // WIP override existing instead of creating new?
        const showContent: any = parseShow(readFile(showFilePath))

        if (showContent?.[1]) shows.push({ ...showContent[1], id: showContent[0] })
    }

    if (shows.length) {
        // create custom folder to organize the amount of files
        data.path = join(data.path, getTimePointString())
        makeDir(data.path)

        if (type === "show") exportShow({ ...data, shows })
        else if (type === "txt") exportTXT({ ...data, shows })
    } else {
        toApp(MAIN, { channel: "ALERT", data: "Exported 0 shows!" })
    }
}

// ----- PROJECT -----

export function exportProject(data: any) {
    toApp(MAIN, { channel: "ALERT", data: "export.exporting" })

    // create archive
    const zip = new AdmZip()

    // copy files
    const files = data.file.files || []
    files.forEach((path: string) => {
        zip.addLocalFile(path)
    })

    // add project file
    zip.addFile("data.json", Buffer.from(JSON.stringify(data.file)))

    const outputPath = join(data.path, data.name + ".project")
    zip.writeZip(outputPath, (err: any) => doneWritingFile(err, data.path))

    // plain JSON
    // writeFile(join(data.path, data.name), ".project", JSON.stringify(data.file), "utf-8", (err: any) => doneWritingFile(err, data.path))
}

// ----- HELPERS -----

function writeFile(path: string, extension: string, data: any, options: any = undefined, callback: any) {
    let number = -1
    let tempPath: string = path

    do {
        number++
        tempPath = path + (number ? "_" + number : "") + extension
    } while (doesPathExist(tempPath))

    fs.writeFile(tempPath, data, options, callback)
}
