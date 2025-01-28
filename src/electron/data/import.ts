import path, { join } from "path";
import PPTX2Json from "pptx2json";
import protobufjs from "protobufjs";
import SqliteToJson from "sqlite-to-json";
import sqlite3 from "sqlite3";
import WordExtractor from "word-extractor";
import { toApp } from "..";
import { IMPORT, MAIN } from "../../types/Channels";
import { dataFolderNames, doesPathExist, getDataFolder, getExtension, makeDir, readFileAsync, readFileBufferAsync, writeFile } from "../utils/files";
import { detectFileType } from "./bibleDetecter";
import { decompress, isZip } from "./zip";

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
    powerkey: (files: string[]) => files,
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
        let fileContents = await Promise.all(files.map(async (file) => await readFile(file, encoding)))
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
    let data: any[] = []

    let sqliteFile = id === "openlp" && files.find((a) => a.endsWith(".sqlite"))
    if (sqliteFile) files = files.filter((a) => a.endsWith(".sqlite"))
    if (id === "easyworship" || id === "softprojector" || sqliteFile) importId = "sqlite"

    if (id === "freeshow_project") {
        importProject(files, importSettings.path)
        return
    }

    const zip = ["zip", "probundle", "vpc", "qsp"]
    let zipFiles = files.filter((a) => zip.includes(a.slice(a.lastIndexOf(".") + 1).toLowerCase()))
    if (zipFiles.length) {
        data = decompress(zipFiles)
        if (data.length) {
            for (let i = 0; i < data.length; i++) {
                const customContent = await checkSpecial(data[i])
                if (customContent) data[i].content = customContent
            }
            toApp(IMPORT, { channel: id, data })
        }
        return
    }

    if (specialImports[importId]) data = await specialImports[importId](files, importSettings)
    else {
        // TXT | FreeShow | ProPresenter | VidoePsalm | OpenLP | OpenSong | XML Bible | Lessons.church
        data = await Promise.all(files.map(async (file) => await readFile(file)))
    }

    if (!data.length) return

    // auto detect version
    if (id === "BIBLE") {
        data = data.map((file) => ({ ...file, type: detectFileType(file.content) }))
    }

    toApp(IMPORT, { channel: id, data })
}

async function readFile(filePath: string, encoding: BufferEncoding = "utf8") {
    let content: string = ""

    let name: string = getFileName(filePath) || ""
    let extension: string = getExtension(filePath)

    try {
        if (extension === "pro") content = await decodeProto(filePath)
        else content = await readFileAsync(filePath, encoding)
    } catch (err) {
        console.error("Error reading file:", err.stack)
    }

    return { content, name, extension }
}

const getFileName = (filePath: string) => path.basename(filePath).slice(0, path.basename(filePath).lastIndexOf("."))

// PROJECT

async function importProject(files: string[], dataPath: string) {
    toApp(MAIN, { channel: "ALERT", data: "popup.importing" })

    // some .project files are plain JSON and others are zip
    const zipFiles: string[] = []
    const jsonFiles: string[] = []
    await Promise.all(
        files.map(async (file) => {
            const zip = await isZip(file)
            if (zip) zipFiles.push(file)
            else jsonFiles.push(file)
        })
    )

    const data = await Promise.all(jsonFiles.map(async (file) => await readFile(file)))

    const importDataPath = getDataFolder(dataPath, dataFolderNames.imports)

    // We want to store the new media files in the import folder under a subdirectory
    // with the current date and time to avoid conflicts with existing files
    const currentDate = new Date().toISOString().replace(/:/g, "-")
    const importPath = path.join(importDataPath, `import-${currentDate}`)
    if (!doesPathExist(importPath)) {
        makeDir(importPath)
    }

    zipFiles.forEach((zipFile) => {
        let zipData = decompress([zipFile], true)
        const dataFile = zipData.find((a) => a.name === "data.json")
        const dataContent = JSON.parse(dataFile.content)

        // write files
        let replacedMedia: { [key: string]: string } = {}
        dataContent.files?.forEach((filePath: string) => {
            // check if path already exists on the system
            if (doesPathExist(filePath)) return

            // TODO: taking the basename of the file path means that if there
            // are multiple files with the same name that were originally in
            // different directories, they will be overwritten. This needs to
            // be fixed on the exporter side first.
            const fileName = path.basename(filePath)
            const file = zipData.find((a) => a.name === fileName)?.content
            const newMediaPath = path.join(importPath, fileName)

            if (!file) return
            replacedMedia[filePath] = newMediaPath
            writeFile(newMediaPath, file)
        })

        // replace files
        Object.entries(replacedMedia).forEach(([oldPath, newPath]) => {
            oldPath = oldPath.replace(/\\/g, "\\\\")
            newPath = newPath.replace(/\\/g, "\\\\")
            dataFile.content = dataFile.content.replaceAll(oldPath, newPath)
        })

        data.push(dataFile)
    })

    toApp(IMPORT, { channel: "freeshow_project", data })
}

// PROTO
// https://greyshirtguy.com/blog/propresenter-7-file-format-part-2/
// https://github.com/greyshirtguy/ProPresenter7-Proto
// https://www.npmjs.com/package/protobufjs

async function decodeProto(filePath: string, fileContent: Buffer | null = null) {
    const dir = join(__dirname, "..", "..", "..", "public", "proto", "presentation.proto")
    const root = await protobufjs.load(dir)

    const Presentation = root.lookupType("Presentation")

    const buffer = fileContent || (await readFileBufferAsync(filePath))
    const message = Presentation.decode(buffer)

    return JSON.stringify(message)
}

async function checkSpecial(file: any) {
    if (file.extension === "pro") return await decodeProto("", file.content)
    return
}
