import { app } from "electron"
import { readFileSync } from "fs"
import path, { join } from "path"
import PPTX2Json from "pptx2json"
import protobufjs from "protobufjs"
import SqliteToJson from "sqlite-to-json"
import sqlite3 from "sqlite3"
import WordExtractor from "word-extractor"
import { toApp } from ".."
import { IMPORT } from "./../../types/Channels"
import { getDocumentsFolder, readFolder } from "./files"

const specialImports: any = {
    powerpoint: async (files: string[]) => {
        let data: any[] = []

        // https://www.npmjs.com/package/pptx2json
        const pptx2json = new PPTX2Json()
        for await (const filePath of files) {
            const json = await pptx2json.toJson(filePath)
            data.push({ name: getFileName(filePath), content: json })
        }

        return data
    },
    word: async (files: string[]) => {
        let data: any[] = []

        // https://www.npmjs.com/package/word-extractor
        const extractor = new WordExtractor()
        for await (const filePath of files) {
            const extracted = await extractor.extract(filePath)
            data.push({ name: getFileName(filePath), content: extracted.getBody() })
        }

        return data
    },
    pdf: async (files: string[]) => {
        let data: any[] = []

        // TODO: linux don't support pdf-poppler!
        const pdf = require("pdf-poppler")

        let opts: any = { format: "png", scale: 1920, out_prefix: "img", page: null }

        await Promise.all(files.map(pdfToImages))

        async function pdfToImages(filePath: string) {
            let name = getFileName(filePath)
            let output = getDocumentsFolder(path.resolve(app.getPath("documents"), "FreeShow", "Imports", name))
            opts.out_dir = output

            try {
                await pdf.convert(filePath, opts)

                let files = readFolder(output)
                if (files.length) data.push({ name, path: output, pages: files.length })
            } catch (err) {
                console.error(err)
            }
        }

        return data
    },
    sqlite: async (files: string[]) => {
        let data: any[] = []

        await Promise.all(files.map(sqlToFile))

        function sqlToFile(filePath: string) {
            const exporter = new SqliteToJson({
                client: new sqlite3.Database(filePath),
            })

            return new Promise((resolve) => {
                exporter.all((err: any, all: any) => {
                    if (err) {
                        console.log(err)
                        return
                    }

                    data.push({ content: all })
                    resolve(true)
                })
            })
        }

        return data
    },
}

export async function importShow(id: any, files: string[] | null) {
    if (!files?.length) return

    let importId = id
    let sqliteFile = id === "openlp" && files.find((a) => a.includes(".sqlite"))
    if (sqliteFile) files = files.filter((a) => a.includes(".sqlite"))
    if (id === "easyworship" || sqliteFile) importId = "sqlite"

    let data: any[] = []
    if (specialImports[importId]) data = await specialImports[importId](files)
    else {
        // TXT | FreeShow | ProPresenter | VidoePsalm | OpenLP | OpenSong | XML Bible | Lessons.church
        data = await Promise.all(files.map(readFile))
    }

    if (!data.length) return

    toApp(IMPORT, { channel: id, data })
}

async function readFile(filePath: string) {
    let content: string = ""

    let name: string = getFileName(filePath) || ""
    let extension: string = path.extname(filePath).substring(1).toLowerCase()

    try {
        if (extension === "pro") content = await decodeProto(filePath)
        else content = readFileSync(filePath, "utf8").toString()
    } catch (err) {
        console.error("Error reading file:", err.stack)
    }

    return { content, name, extension }
}

const getFileName = (filePath: string) => path.basename(filePath).slice(0, path.basename(filePath).lastIndexOf("."))

// PROTO
// https://greyshirtguy.com/blog/propresenter-7-file-format-part-2/
// https://github.com/greyshirtguy/ProPresenter7-Proto
// https://www.npmjs.com/package/protobufjs

async function decodeProto(filePath: string) {
    const dir = join(__dirname, "..", "..", "..", "public", "proto", "presentation.proto")
    const root = await protobufjs.load(dir)

    const Presentation = root.lookupType("Presentation")

    const fileContent = readFileSync(filePath)
    const buffer = Buffer.from(fileContent)
    const message = Presentation.decode(buffer)

    return JSON.stringify(message)
}
