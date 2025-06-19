import path, { join } from "path"
// @ts-ignore (strange Rollup TS build problem, suddenly not realizing that the decleration exists)
import PPTX2Json from "pptx2json"
import protobufjs from "protobufjs"
// @ts-ignore
import SqliteToJson from "sqlite-to-json"
import sqlite3 from "sqlite3"
// @ts-ignore
import WordExtractor from "word-extractor"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { dataFolderNames, doesPathExist, getDataFolder, getExtension, makeDir, readFileAsync, readFileBufferAsync, writeFile } from "../utils/files"
import { detectFileType } from "./bibleDetecter"
import { filePathHashCode } from "./thumbnails"
import { decompress, isZip } from "./zip"
import MDBReader from "mdb-reader"

type FileData = { content: Buffer | string | object; name?: string; extension?: string }

const specialImports = {
    powerpoint: async (files: string[]) => {
        const data: FileData[] = []

        // https://www.npmjs.com/package/pptx2json
        const pptx2json = new PPTX2Json()
        for await (const filePath of files) {
            const json = await pptx2json.toJson(filePath)
            data.push({ name: getFileName(filePath), content: json })
        }

        return data
    },
    word: async (files: string[]) => {
        const data: FileData[] = []

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
        const data: FileData[] = []

        await Promise.all(files.map(sqlToFile))

        function sqlToFile(filePath: string) {
            const exporter = new SqliteToJson({
                client: new sqlite3.Database(filePath)
            })

            return new Promise((resolve) => {
                exporter.all((err: Error, all: any) => {
                    if (err) {
                        console.error(err)
                        return
                    }

                    data.push({ content: all })
                    resolve(true)
                })
            })
        }

        return data
    },
    mdb: async (files: string[]) => {
        const data: FileData[] = []

        await Promise.all(files.map(async (filePath) => await mdbToFile(filePath)))

        async function mdbToFile(filePath: string) {
            const buffer = await readFileBufferAsync(filePath)
            const reader = new MDBReader(buffer)
            const tableNames = reader.getTableNames()

            const dbData: any = {}
            for (const tableName of tableNames) {
                dbData[tableName] = reader.getTable(tableName).getData()
            }

            data.push({ content: dbData })
        }

        return data
    }
}

// protobufjs (.pro) import can't handle close to 1000 files at once
const BATCH_SIZE = 500

export async function importShow(id: string, files: string[] | null, importSettings: any) {
    if (!files?.length) return

    let importId = id
    let data: (FileData | string)[] = []

    const sqliteFile = id === "openlp" && files.find((a) => a.endsWith(".sqlite"))
    if (sqliteFile) files = files.filter((a) => a.endsWith(".sqlite"))
    if (id === "easyworship" || id === "softprojector" || sqliteFile) importId = "sqlite"
    const mdbFile = id === "mediashout" && files.find((a) => a.endsWith(".mdb"))
    if (mdbFile) files = files.filter((a) => a.endsWith(".mdb"))
    if (mdbFile) importId = "mdb"

    if (id === "freeshow_project") {
        await importProject(files, importSettings.path)
        return
    }
    if (id === "freeshow_template") {
        await importTemplate(files, importSettings.path)
        return
    }

    if (id === "songbeamer") {
        const encoding = importSettings.encoding.id
        const fileContents = await Promise.all(files.map(async (file) => await readFile(file, encoding)))
        const custom = {
            files: fileContents,
            length: fileContents.length,
            encoding,
            category: importSettings.category.id,
            translationMethod: importSettings.translation
        }

        sendToMain(ToMain.IMPORT2, { channel: id, data: [], custom })
        return
    }

    const zip = ["zip", "probundle", "vpc", "qsp"]
    const zipFiles = files.filter((a) => zip.includes(a.slice(a.lastIndexOf(".") + 1).toLowerCase()))
    if (zipFiles.length) {
        data = decompress(zipFiles)
        if (data.length) {
            for (const fileData of data) {
                const customContent = await checkSpecial(fileData as FileData)
                if (customContent) (fileData as FileData).content = customContent
            }
            sendToMain(ToMain.IMPORT2, { channel: id, data })
        }
        return
    }

    if (importId in specialImports) data = await specialImports[importId as keyof typeof specialImports](files)
    else {
        // TXT | FreeShow | ProPresenter | VidoePsalm | OpenLP | OpenSong | XML Bible | Lessons.church
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE)
            const batchData = await Promise.all(batch.map((file) => readFile(file)))
            data.push(...batchData)
        }
    }

    if (!data.length) return

    // auto detect version
    if (id === "BIBLE") {
        data = (data as FileData[]).map((file) => ({ ...file, type: detectFileType(file.content as string) }))
    }

    sendToMain(ToMain.IMPORT2, { channel: id, data })
}

async function readFile(filePath: string, encoding: BufferEncoding = "utf8") {
    let content = ""

    const name: string = getFileName(filePath) || ""
    const extension: string = getExtension(filePath)

    try {
        if (extension === "pro") content = await decodeProto(filePath)
        else content = await readFileAsync(filePath, encoding)
    } catch (err) {
        console.error("Error reading file:", (err as Error).stack)
    }

    return { content, name, extension }
}

const getFileName = (filePath: string) => path.basename(filePath).slice(0, path.basename(filePath).lastIndexOf("."))

// PROJECT

async function importProject(files: string[], dataPath: string) {
    sendToMain(ToMain.ALERT, "popup.importing")

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

    const data: FileData[] = await Promise.all(jsonFiles.map(async (file) => await readFile(file)))

    const importDataPath = getDataFolder(dataPath, dataFolderNames.imports)
    const importFolder = path.join(importDataPath, "Projects")

    // we can store the new media files under a subdirectory with the current date/time
    // to avoid conflicts with same file name, but this does not work for all scenarios
    // const importFolder = path.join(importDataPath, `project-${getTimePointString()}`)
    if (!doesPathExist(importFolder)) makeDir(importFolder)

    zipFiles.forEach((zipFile) => {
        const dataFile = extractZipDataAndMedia(zipFile, importFolder)
        if (dataFile) data.push(dataFile)
    })

    // remove folder if no files stored
    // if (!readFolder(importFolder).length) deleteFolder(importFolder)

    sendToMain(ToMain.IMPORT2, { channel: "freeshow_project", data })
}

// TEMPLATE

async function importTemplate(files: string[], dataPath: string) {
    sendToMain(ToMain.ALERT, "popup.importing")

    // some .fstemplate files are plain JSON and others are zip
    const zipFiles: string[] = []
    const jsonFiles: string[] = []
    await Promise.all(
        files.map(async (file) => {
            const zip = await isZip(file)
            if (zip) zipFiles.push(file)
            else jsonFiles.push(file)
        })
    )

    const data: FileData[] = await Promise.all(jsonFiles.map(async (file) => await readFile(file)))

    const importDataPath = getDataFolder(dataPath, dataFolderNames.imports)
    const importFolder = path.join(importDataPath, "Templates")

    if (!doesPathExist(importFolder)) makeDir(importFolder)

    zipFiles.forEach((zipFile) => {
        const dataFile = extractZipDataAndMedia(zipFile, importFolder)
        if (dataFile) data.push(dataFile)
    })

    sendToMain(ToMain.IMPORT2, { channel: "freeshow_template", data })
}

/// ZIP ///

function extractZipDataAndMedia(filePath: string, importFolder: string) {
    const zipData: FileData[] = decompress([filePath], true)
    const dataFile = zipData.find((a) => a.name === "data.json")
    if (!dataFile) return

    let content = dataFile.content as string
    const dataContent = JSON.parse(content)

    // write files
    const replacedMedia: { [key: string]: string } = {}
    dataContent.files?.forEach((rawPath: string) => {
        const currentPath = path.normalize(rawPath)

        // check if path already exists on the system
        if (doesPathExist(currentPath)) return

        const fileName = path.basename(currentPath)
        const file = zipData.find((a) => a.name === fileName)?.content

        // get file path hash to prevent the same file importing multiple times
        // this also ensures files with the same name don't get overwritten
        const ext = path.extname(fileName)
        const pathHash = `${path.basename(currentPath, ext)}_${filePathHashCode(currentPath)}${ext}`
        const newMediaPath = path.join(importFolder, pathHash)

        if (!file) return
        replacedMedia[rawPath] = newMediaPath

        if (doesPathExist(newMediaPath)) return
        // @ts-ignore
        writeFile(newMediaPath, file)
    })

    // replace files
    const escapeJSON = (value: string) => value.replace(/\\/g, "\\\\")
    Object.entries(replacedMedia).forEach(([oldPath, newPath]) => {
        const windowsPath = oldPath.replace(/\//g, "\\")
        const unixPath = oldPath.replace(/\\/g, "/")
        const escapedWindowsPath = escapeJSON(windowsPath)

        const pathVariants = [oldPath, windowsPath, unixPath, escapedWindowsPath]

        pathVariants.forEach((variant) => {
            // convert \ to \\
            const escapedPattern = variant.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")
            const replacementPath = escapeJSON(newPath)
            const regex = new RegExp(escapedPattern, "g")
            content = content.replace(regex, replacementPath)
        })
    })

    dataFile.content = content
    return dataFile
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

async function checkSpecial(file: FileData) {
    if (file.extension === "pro" && Buffer.isBuffer(file.content)) return await decodeProto("", file.content)
    return
}
