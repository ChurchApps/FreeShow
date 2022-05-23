import path from "path"
import { readdir, readFileSync } from "fs"
import { toApp } from ".."
import { IMPORT } from "./../../types/Channels"
import PPTX2Json from "pptx2json"
import SqliteToJson from "sqlite-to-json"
import sqlite3 from "sqlite3"

export async function importShow(id: any, name: string, files: string[] | null, output: string | undefined) {
  if (!files?.length) return
  if (id === "txt") {
    try {
      var data = readFileSync(files[0], "utf8")
      toApp(IMPORT, { channel: id, data: { name, text: data.toString() } })
    } catch (err) {
      console.log("Error:", err.stack)
    }
  } else if (id === "powerpoint") {
    const pptx2json = new PPTX2Json()
    const json = await pptx2json.toJson(files[0])
    toApp(IMPORT, { channel: id, data: { name, content: json } })
  } else if (id === "pdf") {
    if (output) {
      console.log(output)
      let opts = {
        format: "png",
        scale: 1920,
        out_dir: output,
        out_prefix: "img",
        page: null,
      }

      // TODO: linux don't support pdf-poppler!
      const pdf = require("pdf-poppler")

      pdf
        .convert(files[0], opts)
        .then(() => {
          readdir(output, (err: any, files: any) => {
            //handling error
            if (err) {
              return console.log("Unable to scan directory: " + err)
            }

            toApp(IMPORT, { channel: "pdf", data: { name, path: output, pages: files.length } })
          })
        })
        .catch((err: any) => {
          console.error(err)
        })
    }
  } else if (id === "easyworship") {
    let data: any[] = []
    files.forEach((filePath) => {
      const exporter = new SqliteToJson({
        client: new sqlite3.Database(filePath),
      })
      exporter.all((err: any, all: any) => {
        if (!err) data.push({ content: all })
      })
    })
    setTimeout(() => {
      toApp(IMPORT, { channel: id, data: data })
    }, 100)
  } else {
    // FreeShow | ProPresenter | VidoePsalm | OpenLP | OpenSong
    let data: any[] = []
    files.forEach((filePath) => {
      let content = readFileSync(filePath, "utf8").toString()
      let name = files ? path.basename(filePath).slice(0, path.basename(filePath).lastIndexOf(".")) : ""
      data.push({ content, name })
    })
    toApp(IMPORT, { channel: id, data: data })
  }
}
