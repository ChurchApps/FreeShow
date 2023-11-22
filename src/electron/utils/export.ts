// ----- FreeShow -----
// Export as TXT or PDF
// When exporting as PDF we create a new window and capture its content

import { isProd, toApp } from "../index"
import { join } from "path"
import { BrowserWindow, ipcMain } from "electron"
import fs from "fs"
import { MAIN, EXPORT, STARTUP } from "../../types/Channels"
import { exportOptions } from "./windowOptions"
import { doesPathExist } from "./files"

// ----- PDF -----

const options: any = {
    marginsType: 1,
    pageSize: "A4",
    printBackground: true,
    // printSelectionOnly: false,
    landscape: false,
}

export function generatePDF(path: string) {
    exportWindow?.webContents
        .printToPDF(options)
        .then((data: any) => {
            writeFile(path, ".pdf", data, undefined, (err: any) => {
                if (err) exportMessage(err)
                else exportWindow.webContents.send(EXPORT, { channel: "NEXT" })
            })
        })
        .catch(exportMessage)
}

function exportMessage(message: string = "") {
    toApp(MAIN, { channel: "ALERT", data: message })
    exportWindow?.close()
    exportWindow = null
}

let exportWindow: any = null
export function createPDFWindow(data: any) {
    exportWindow = new BrowserWindow(exportOptions)

    // load path
    if (isProd) exportWindow.loadFile("public/index.html")
    else exportWindow.loadURL("http://localhost:3000")

    exportWindow.webContents.once("did-finish-load", () => {
        exportWindow.webContents.send(STARTUP, { channel: "TYPE", data: "pdf" })
        exportWindow.webContents.send(EXPORT, { channel: "PDF", data })
    })
}

ipcMain.on(EXPORT, (_e, msg: any) => {
    if (msg.channel === "DONE") return exportMessage("export.exported")
    if (msg.channel !== "EXPORT") return

    toApp(MAIN, { channel: "ALERT", data: msg.data.name })
    if (msg.data.type === "pdf") generatePDF(join(msg.data.path, msg.data.name))
})

// ----- TXT -----

export function exportTXT(data: any) {
    let msg: string = "export.exported"
    data.shows.forEach((show: any) => {
        writeFile(join(data.path, show.name), ".txt", getSlidesText(show), "utf-8", (err: any) => {
            if (err) msg = err
        })
    })
    toApp(MAIN, { channel: "ALERT", data: msg })
}

function getSlidesText(show: any) {
    let text: string = ""

    let slides: any[] = []
    show.layouts?.[show.settings?.activeLayout].slides.forEach((layoutSlide: any) => {
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

// ----- PROJECT -----

export function exportProject(data: any) {
    let msg: string = "export.exported"
    writeFile(join(data.path, data.name), ".project", JSON.stringify(data.file), "utf-8", (err: any) => {
        if (err) msg = err
    })
    toApp(MAIN, { channel: "ALERT", data: msg })
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
