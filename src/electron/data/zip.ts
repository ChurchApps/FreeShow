import fs from "fs"
import yauzl from "yauzl"
import yazl from "yazl"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { getExtension } from "../utils/files"

// https://www.npmjs.com/package/yazl (compression)
// https://www.npmjs.com/package/yauzl (decompression)

export function compressToZip(entries: { name: string; content?: Buffer | string; filePath?: string }[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const zipfile = new yazl.ZipFile()

        entries.forEach(entry => {
            try {
                if (entry.filePath) {
                    zipfile.addFile(entry.filePath, entry.name)
                } else if (entry.content) {
                    const buffer = typeof entry.content === "string" ? Buffer.from(entry.content, "utf-8") : entry.content
                    zipfile.addBuffer(buffer, entry.name)
                }
            } catch (err) {
                console.error(`Error adding to zip: ${entry.name}`, err)
            }
        })

        zipfile.end()

        const writeStream = fs.createWriteStream(outputPath)

        zipfile.outputStream.pipe(writeStream)

        writeStream.on("finish", () => {
            resolve()
        })

        writeStream.on("error", err => {
            console.error(err)
            sendToMain(ToMain.ALERT, `Failed to create zip file: ${outputPath}`)
            reject(err)
        })

        zipfile.outputStream.on("error", err => {
            console.error(err)
            reject(err)
        })
    })
}

export interface DecompressStreamOptions {
    // Return output path to write to disk, or undefined to buffer in memory
    getOutputPath?: (fileName: string) => string | undefined
}

export async function decompressZip(files: string[], asBuffer = false, options?: DecompressStreamOptions) {
    const data: { content: Buffer | string; name: string; extension: string }[] = []

    for (const file of files) {
        try {
            const fileData = await decompressZipStream(file, asBuffer, options)
            data.push(...fileData)
        } catch (err) {
            console.error("Could not decompress zip file:", file, err)
        }
    }

    return data
}

export async function decompressZipStream(file: string, asBuffer = false, options?: DecompressStreamOptions): Promise<{ content: Buffer | string; name: string; extension: string }[]> {
    return new Promise((resolve, reject) => {
        const data: { content: Buffer | string; name: string; extension: string }[] = []

        yauzl.open(file, { lazyEntries: true }, (err, zipfile) => {
            if (err) {
                const errorMsg = (err as Error).message
                if (errorMsg.includes("Incompatible password parameter") || errorMsg.includes("encrypted")) {
                    sendToMain(ToMain.ALERT, "Can't decompress, this file is password protected!")
                } else {
                    sendToMain(ToMain.ALERT, `Failed to open zip file: ${file}`)
                }
                reject(err)
                return
            }

            if (!zipfile) {
                reject(new Error("Failed to open zipfile"))
                return
            }

            zipfile.on("entry", (entry: yauzl.Entry) => {
                // Skip directories
                if (/\/$/.test(entry.fileName)) {
                    zipfile.readEntry()
                    return
                }

                processEntry(entry, zipfile, data, asBuffer, options)
            })

            zipfile.on("end", () => resolve(data))
            zipfile.on("error", reject)

            zipfile.readEntry()
        })
    })
}

function processEntry(entry: yauzl.Entry, zipfile: yauzl.ZipFile, data: { content: Buffer | string; name: string; extension: string }[], asBuffer: boolean, options?: DecompressStreamOptions) {
    const name = entry.fileName
    const extension = getExtension(name)
    const outputPath = options?.getOutputPath?.(name)

    zipfile.openReadStream(entry, (err, readStream) => {
        if (err || !readStream) {
            if (err) console.error(err)
            zipfile.readEntry()
            return
        }

        if (outputPath) {
            streamToDisk(readStream, outputPath, name, extension, data, zipfile)
        } else {
            bufferInMemory(readStream, name, extension, asBuffer, data, zipfile)
        }
    })
}

function streamToDisk(readStream: NodeJS.ReadableStream, outputPath: string, name: string, extension: string, data: { content: Buffer | string; name: string; extension: string }[], zipfile: yauzl.ZipFile) {
    const writeStream = fs.createWriteStream(outputPath)
    readStream.pipe(writeStream)

    writeStream.on("finish", () => {
        data.push({ content: outputPath, name, extension })
        zipfile.readEntry()
    })

    writeStream.on("error", err => {
        console.error("Failed to write file to disk:", outputPath, err)
        zipfile.readEntry()
    })
}

function bufferInMemory(readStream: NodeJS.ReadableStream, name: string, extension: string, asBuffer: boolean, data: { content: Buffer | string; name: string; extension: string }[], zipfile: yauzl.ZipFile) {
    const chunks: Buffer[] = []

    readStream.on("data", (chunk: Buffer) => chunks.push(chunk))

    readStream.on("end", () => {
        let content: Buffer | string = Buffer.concat(chunks)

        // import as string unless asBuffer is true, or it's a .pro file
        if (extension !== "pro" && (!asBuffer || extension === "json")) {
            content = content.toString("utf8")
        }

        data.push({ content, name, extension })
        zipfile.readEntry()
    })

    readStream.on("error", err => {
        console.error(err)
        zipfile.readEntry()
    })
}

export function isZip(path: string): Promise<boolean> {
    const initialBuffer = Buffer.alloc(4)

    return new Promise(resolve => {
        fs.open(path, "r", (openError, fd) => {
            if (openError) {
                console.error(openError)
                resolve(false)
            }

            fs.read(fd, initialBuffer, 0, 4, 0, (readError, _bytesRead, buffer) => {
                if (readError) {
                    fs.close(fd, closeError => {
                        console.error(closeError || readError)
                        resolve(false)
                    })
                    return
                }

                if (buffer && buffer.length === 4) {
                    resolve(buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) && (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08))
                } else {
                    resolve(false)
                }
            })
        })
    })
}
