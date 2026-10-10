import Database from "better-sqlite3"
import path, { join } from "path"
import protobufjs from "protobufjs"
import upath from "upath"
// @ts-ignore (strange Rollup TS build problem, suddenly not realizing that the decleration exists)
import MDBReader from "mdb-reader"
// @ts-ignore
import WordExtractor from "word-extractor"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { pptToShow } from "../output/ppt/pptToShow"
import { asyncPool, doesPathExist, getDataFolderPath, getExtension, readFileAsync, readFileBufferAsync } from "../utils/files"
import { detectFileType } from "./bibleDetecter"
import { filePathHashCode } from "./thumbnails"
import { decompressZip, decompressZipStream, isZip } from "./zip"

type FileData = { content: Buffer | string | object; path?: string; name?: string; extension?: string }
type SongbeamerReadResult = { content: string; encoding: BufferEncoding }

// Legacy SongBeamer files are often exported as Windows-1252 even when users select
// Latin-1, so we remap the 0x80-0x9F range to preserve punctuation/symbols.
const WIN1252: Record<number, string> = {
    0x80: "\u20AC", 0x82: "\u201A", 0x83: "\u0192", 0x84: "\u201E", 0x85: "\u2026",
    0x86: "\u2020", 0x87: "\u2021", 0x88: "\u02C6", 0x89: "\u2030", 0x8A: "\u0160",
    0x8B: "\u2039", 0x8C: "\u0152", 0x8E: "\u017D", 0x91: "\u2018", 0x92: "\u2019",
    0x93: "\u201C", 0x94: "\u201D", 0x95: "\u2022", 0x96: "\u2013", 0x97: "\u2014",
    0x98: "\u02DC", 0x99: "\u2122", 0x9A: "\u0161", 0x9B: "\u203A", 0x9C: "\u0153",
    0x9E: "\u017E", 0x9F: "\u0178"
}

function stripBom(text: string): string {
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function decodeSongbeamerLatin1(buffer: Buffer): string {
    const latin1Text = buffer.toString("latin1")
    return stripBom(latin1Text.replace(/[\x80-\x9F]/g, (char) => WIN1252[char.charCodeAt(0)] ?? char))
}

function parseDeclaredSongbeamerEncoding(buffer: Buffer): BufferEncoding | null {
    const header = buffer.slice(0, 512).toString("latin1")
    const declared = header.match(/^#Encoding=(.+)$/im)?.[1]?.trim().toLowerCase() ?? ""
    if (!declared) return null

    if (declared === "utf8" || declared === "utf-8") return "utf8"
    if (["latin1", "iso-8859-1", "cp1252", "windows-1252", "ansi"].includes(declared)) return "latin1"
    return null
}

function isValidUtf8(buffer: Buffer): boolean {
    try {
        new TextDecoder("utf-8", { fatal: true }).decode(buffer)
        return true
    } catch {
        return false
    }
}

function decodeSongbeamerBuffer(buffer: Buffer): SongbeamerReadResult {
    if (!buffer.length) return { content: "", encoding: "utf8" as BufferEncoding } as SongbeamerReadResult

    // Handle UTF-8 BOM first so conversion is deterministic regardless of selected import mode.
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
        return { content: stripBom(buffer.slice(3).toString("utf-8")), encoding: "utf8" }
    }

    const declaredEncoding = parseDeclaredSongbeamerEncoding(buffer)
    if (declaredEncoding === "utf8") {
        return { content: stripBom(buffer.toString("utf-8")), encoding: "utf8" }
    }
    if (declaredEncoding === "latin1") {
        return { content: decodeSongbeamerLatin1(buffer), encoding: "latin1" }
    }

    if (isValidUtf8(buffer)) {
        return { content: stripBom(buffer.toString("utf-8")), encoding: "utf8" }
    }

    return { content: decodeSongbeamerLatin1(buffer), encoding: "latin1" }
}

async function readSongbeamerFile(filePath: string): Promise<SongbeamerReadResult> {
    const buffer = await readFileBufferAsync(filePath)
    return decodeSongbeamerBuffer(buffer)
}
const specialImports = {
    powerpoint: async (files: string[]) => {
        sendToMain(ToMain.ALERT, "popup.importing")

        const data: FileData[] = []
        for await (const filePath of files) {
            const json = await pptToShow(filePath)
            if (json) data.push({ name: getFileName(filePath), content: json })
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

        for (const filePath of files) {
            try {
                const db = new Database(filePath, { readonly: true })
                const tables: { [key: string]: any[] } = {}

                // Get all table names
                const tableNames = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]

                // Get all data from each table
                for (const { name } of tableNames) {
                    tables[name] = db.prepare(`SELECT * FROM \`${name}\``).all()
                }

                db.close()
                data.push({ content: tables })
            } catch (err) {
                console.error(err)
            }
        }

        return data
    },
    mdb: async (files: string[]) => {
        const data: FileData[] = []

        await asyncPool(50, files, async (filePath) => await mdbToFile(filePath))

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

export async function importShow(id: string, files: string[] | null) {
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
        await importProject(files)
        return
    }
    if (id === "freeshow_template") {
        await importTemplate(files)
        return
    }
    if (id === "freeshow_overlay") {
        await importOverlay(files)
        return
    }

    if (id === "songbeamer") {
        const fileContents: { name: string; content: string; encoding: BufferEncoding }[] = []
        await asyncPool(20, files, async (file) => {
            const decoded = await readSongbeamerFile(file)
            fileContents.push({
                name: getFileName(file),
                content: decoded.content,
                encoding: decoded.encoding
            })
        })

        // Keep IMPORT2 payload as the legacy array contract while preserving per-file encoding metadata.
        sendToMain(ToMain.IMPORT2, { channel: id, data: fileContents })
        return
    }
    const zip = ["zip", "probundle", "vpc", "qsp"]
    const zipFiles = files.filter((a) => zip.includes(a.slice(a.lastIndexOf(".") + 1).toLowerCase()))
    if (zipFiles.length) {
        data = await decompressZip(zipFiles)
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
        await asyncPool(20, files, async (file) => {
            const batchData = await readFile(file, "utf8", id)
            data.push(batchData)
        })
    }

    if (!data.length) return

    // auto detect version
    if (id === "BIBLE") {
        data = (data as FileData[]).map((file) => ({ ...file, type: detectFileType(file.content as string) }))
    }

    sendToMain(ToMain.IMPORT2, { channel: id, data })
}

async function readFile(filePath: string, encoding: BufferEncoding = "utf8", id?: string) {
    let content = ""

    const name: string = getFileName(filePath) || ""
    const extension: string = getExtension(filePath)

    try {
        if (id === "propresenter" && extension === "pro") content = await decodeProto(filePath)
        else content = await readFileAsync(filePath, encoding)
    } catch (err) {
        console.error("Error reading file:", (err as Error).stack)
    }

    return { content, path: filePath, name, extension }
}

const getFileName = (filePath: string) => path.basename(filePath).slice(0, path.basename(filePath).lastIndexOf("."))

// PROJECT

async function importProject(files: string[]) {
    sendToMain(ToMain.ALERT, "popup.importing")

    // some .project files are plain JSON and others are zip
    const zipFiles: string[] = []
    const jsonFiles: string[] = []
    await asyncPool(20, files, async (file) => {
        const zip = await isZip(file)
        if (zip) zipFiles.push(file)
        else jsonFiles.push(file)
    })

    const data: FileData[] = []
    await asyncPool(20, jsonFiles, async (file) => {
        data.push(await readFile(file))
    })

    const importFolder = getDataFolderPath("imports", "Projects")

    for (const zipFile of zipFiles) {
        const dataFile = await extractZipDataAndMedia(zipFile, importFolder)
        if (dataFile) data.push(dataFile)
    }

    // remove folder if no files stored
    // if (!readFolder(importFolder).length) deleteFolder(importFolder)

    // might have alerted an error, so just return if there is no data
    if (!data.length) return

    sendToMain(ToMain.IMPORT2, { channel: "freeshow_project", data })
}

// TEMPLATE

async function importTemplate(files: string[]) {
    sendToMain(ToMain.ALERT, "popup.importing")

    // some .fstemplate files are plain JSON and others are zip
    const zipFiles: string[] = []
    const jsonFiles: string[] = []
    await asyncPool(20, files, async (file) => {
        const zip = await isZip(file)
        if (zip) zipFiles.push(file)
        else jsonFiles.push(file)
    })

    const data: FileData[] = []
    await asyncPool(20, jsonFiles, async (file) => {
        data.push(await readFile(file))
    })

    const importFolder = getDataFolderPath("imports", "Templates")

    for (const zipFile of zipFiles) {
        const dataFile = await extractZipDataAndMedia(zipFile, importFolder)
        if (dataFile) data.push(dataFile)
    }

    sendToMain(ToMain.IMPORT2, { channel: "freeshow_template", data })
}

// OVERLAY

async function importOverlay(files: string[]) {
    sendToMain(ToMain.ALERT, "popup.importing")

    // some .fsoverlay files are plain JSON and others are zip
    const zipFiles: string[] = []
    const jsonFiles: string[] = []
    await asyncPool(20, files, async (file) => {
        const zip = await isZip(file)
        if (zip) zipFiles.push(file)
        else jsonFiles.push(file)
    })

    const data: FileData[] = []
    await asyncPool(20, jsonFiles, async (file) => {
        data.push(await readFile(file))
    })

    const importFolder = getDataFolderPath("imports", "Overlays")

    for (const zipFile of zipFiles) {
        const dataFile = await extractZipDataAndMedia(zipFile, importFolder)
        if (dataFile) data.push(dataFile)
    }

    sendToMain(ToMain.IMPORT2, { channel: "freeshow_overlay", data })
}

/// ZIP ///

async function extractZipDataAndMedia(filePath: string, importFolder: string) {
    const initialData = await decompressZip([filePath])
    const dataFile = initialData.find((a) => a.name === "data.json")
    if (!dataFile) return

    let content = dataFile.content as string
    const dataContent = JSON.parse(content)

    const filePathMap = new Map<string, string>()
    const replacedMedia: { [key: string]: string } = {}

    dataContent.files?.forEach((rawPath: string) => {
        // check if path already exists on the system
        if (doesPathExist(rawPath)) return

        const extension = upath.extname(rawPath)
        const fileName = upath.basename(rawPath)
        const hashedFileName = `${upath.basename(rawPath, extension)}__${filePathHashCode(rawPath)}${extension}`

        // get file path hash to prevent the same file importing multiple times
        // this also ensures files with the same name don't get overwritten
        const ext = upath.extname(fileName)
        const pathHash = `${upath.basename(rawPath, ext)}_${filePathHashCode(upath.toUnix(rawPath))}${ext}`
        const newMediaPath = upath.join(importFolder, pathHash)

        replacedMedia[rawPath] = newMediaPath

        if (doesPathExist(newMediaPath)) return

        // map input name to output path for file extraction
        filePathMap.set(hashedFileName, newMediaPath)
        filePathMap.set(fileName, newMediaPath)
    })

    // extract files directly to their final paths
    await decompressZipStream(filePath, true, {
        getOutputPath: (fileName: string) => filePathMap.get(fileName)
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
