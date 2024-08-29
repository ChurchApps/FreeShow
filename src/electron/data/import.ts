import { readFileSync } from "fs"
import path, { join } from "path"
// import { pdf } from "pdf-to-img"
import PPTX2Json from "pptx2json"
import protobufjs from "protobufjs"
import SqliteToJson from "sqlite-to-json"
import sqlite3 from "sqlite3"
import WordExtractor from "word-extractor"
import { toApp } from ".."
import { IMPORT } from "../../types/Channels"

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
    pdf: (files: string[]) => files,
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
    songbeamer: async (files: string[], data: any) => {
        let encoding = data.encoding.id
        let fileContents = await Promise.all(files.map((file) => readFile(file, encoding)))
        return {
            files: fileContents,
            length: fileContents.length,
            encoding,
            category: data.category.id,
            translationMethod: data.translation,
        }
    },
}

export async function importShow(id: any, files: string[] | null, importSettings: any) {
    if (!files?.length) return

    let importId = id
    let sqliteFile = id === "openlp" && files.find((a) => a.includes(".sqlite"))
    if (sqliteFile) files = files.filter((a) => a.includes(".sqlite"))
    if (id === "easyworship" || id === "softprojector" || sqliteFile) importId = "sqlite"

    let data: any[] = []
    if (specialImports[importId]) data = await specialImports[importId](files, importSettings)
    else {
        // TXT | FreeShow | ProPresenter | VidoePsalm | OpenLP | OpenSong | XML Bible | Lessons.church
        data = await Promise.all(files.map((file) => readFile(file)))
    }

    if (!data.length) return

    toApp(IMPORT, { channel: id, data })
}

async function readFile(filePath: string, encoding: BufferEncoding | null = "utf8") {
    let content: string = ""

    let name: string = getFileName(filePath) || ""
    let extension: string = path.extname(filePath).substring(1).toLowerCase()

    try {
        if (extension === "pro") content = await decodeProto(filePath)
        else content = readFileSync(filePath, encoding).toString()
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
