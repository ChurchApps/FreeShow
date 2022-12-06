import path from "path"
import { readdir, readFileSync } from "fs"
import { toApp } from ".."
import { IMPORT } from "./../../types/Channels"
import PPTX2Json from "pptx2json"
import SqliteToJson from "sqlite-to-json"
import sqlite3 from "sqlite3"
import { app } from "electron"
import { getDocumentsFolder } from "./files"

export async function importShow(id: any, files: string[] | null) {
  if (!files?.length) return

  let data: any[] = []
  if (id === "powerpoint") {
    for await (const filePath of files) {
      const pptx2json = new PPTX2Json()
      const json = await pptx2json.toJson(filePath)
      data.push({ name: getFileName(filePath), content: json })
    }
  } else if (id === "pdf") {
    let opts: any = {
      format: "png",
      scale: 1920,
      out_prefix: "img",
      page: null,
    }

    // TODO: linux don't support pdf-poppler!
    const pdf = require("pdf-poppler")

    await Promise.all(
      files.map((filePath: string) => {
        let name = getFileName(filePath)
        let output = getDocumentsFolder(path.resolve(app.getPath("documents"), "FreeShow", "Imports", name))
        opts.out_dir = output
        return new Promise((resolve, error) => {
          pdf
            .convert(filePath, opts)
            .then(() => {
              readdir(output, (err: any, files: any) => {
                if (err) return console.error("Could not read directory:", err)
                data.push({ name, path: output, pages: files.length })
                resolve(true)
              })
            })
            .catch((err: any) => {
              console.error(err)
              error(err)
            })
        })
      })
    )
  } else if (id === "easyworship") {
    await Promise.all(
      files.map((filePath: string) => {
        const exporter = new SqliteToJson({
          client: new sqlite3.Database(filePath),
        })

        return new Promise((resolve, error) => {
          exporter.all((err: any, all: any) => {
            if (err) {
              error(err)
              return
            }

            data.push({ content: all })
            resolve(true)
          })
        })
      })
    )
  } else {
    // TXT | FreeShow | ProPresenter | VidoePsalm | OpenLP | OpenSong | XML Bible
    files.forEach((filePath: string) => {
      data.push(readFile(filePath))
    })
  }

  if (data.length) toApp(IMPORT, { channel: id, data })
}

function readFile(filePath: string) {
  let content: string = ""
  let name: string = ""
  try {
    content = readFileSync(filePath, "utf8").toString()
    name = getFileName(filePath) || ""
  } catch (err) {
    console.error("Error reading file:", err.stack)
  }
  return { content, name }
}

const getFileName = (filePath: string) => path.basename(filePath).slice(0, path.basename(filePath).lastIndexOf("."))
