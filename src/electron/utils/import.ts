import path from "path"
import { readdir, readFileSync } from "fs"
import { toApp, updateOutputPath } from ".."
import { IMPORT } from "./../../types/Channels"
import PPTX2Json from "pptx2json"
import SqliteToJson from "sqlite-to-json"
import sqlite3 from "sqlite3"
import { app } from "electron"

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
        let output = updateOutputPath(path.resolve(app.getPath("documents"), "Imports", name))
        opts.out_dir = output
        return new Promise((resolve) => {
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
              resolve(err)
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

        exporter.all((err: any, all: any) => {
          if (!err) data.push({ content: all })
        })
      })
    )

    // setTimeout(() => {
    //   if (data.find((a) => a.content.word)) toApp(IMPORT, { channel: id, data })
    //   else
    //     setTimeout(() => {
    //       // wait a second longer just in case
    //       toApp(IMPORT, { channel: id, data })
    //     }, 1000)
    // }, 500)
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
