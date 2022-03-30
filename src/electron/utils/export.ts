import { toApp } from "../index"
import { join } from "path"
import { BrowserWindow, ipcMain } from "electron"
import fs from "fs"
import { MAIN, EXPORT } from "../../types/Channels"

const options: any = {
  marginsType: 1,
  pageSize: "A4",
  printBackground: true,
  // printSelectionOnly: false,
  landscape: false,
}

export async function generatePDF(path: string) {
  exportWindow?.webContents
    .printToPDF(options)
    .then((data: any) => {
      writeFile(path, ".pdf", data, undefined, (err: any) => {
        if (err) exportError(err)
        else exportWindow.webContents.send(EXPORT, { channel: "NEXT" })
      })
    })
    .catch(exportError)
}

function exportError(error: string[]) {
  console.log(error)
  toApp(MAIN, { channel: "ALERT", data: error })
  exportWindow?.close()
  exportWindow = null
}

const isProd: boolean = process.env.NODE_ENV === "production" || !/[\\/]electron/.exec(process.execPath)

let exportWindow: any = null
export function createPDFWindow(data: any) {
  exportWindow = new BrowserWindow({
    // show: !isProd,
    modal: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      // contextIsolation: true,
      // enableRemoteModule: false,
      preload: join(__dirname, "..", "preload"), // use a preload script
    },
  })

  const url: string = isProd ? `file://${join(__dirname, "..", "..", "public", "index.html")}` : "http://localhost:3000"
  exportWindow.loadURL(url)

  exportWindow.webContents.on("did-finish-load", () => {
    exportWindow.webContents.send(MAIN, { channel: "OUTPUT", data: "pdf" })
    exportWindow.webContents.send(EXPORT, { channel: "PDF", data })
  })
}

ipcMain.on(EXPORT, (_e, msg: any) => {
  if (msg.channel === "DONE") {
    toApp(MAIN, { channel: "ALERT", data: "export.exported" })
    exportWindow?.close()
    exportWindow = null
  } else if (msg.channel === "EXPORT") {
    toApp(MAIN, { channel: "ALERT", data: msg.data.name })
    if (msg.data.type === "pdf") generatePDF(join(msg.data.path, msg.data.name))
  }
})

function writeFile(path: string, extension: string, data: any, options: any = undefined, callback: any) {
  let number = 0
  console.log(path + (number ? "_" + number : "") + extension)
  while (fs.existsSync(path + (number ? "_" + number : "") + extension)) number++
  fs.writeFile(path + (number ? "_" + number : "") + extension, data, options, callback)
}

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
    slides.push(slide)
    if (slide.children) {
      slide.children.forEach((childId: string) => {
        slides.push(show.slides[childId])
      })
    }
  })

  slides.forEach((slide) => {
    slide.items.forEach((item: any) => {
      if (item.lines) {
        item.lines.forEach((line: any) => {
          line.text.forEach((t: any) => {
            text += t.value
          })
          text += "\n"
        })
      }
      text += "\n"
    })
  })
  return text
}
