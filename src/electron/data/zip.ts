import fs from "fs"
import path from "path"
import type { Readable } from "stream"
import yauzl from "yauzl"
import yazl from "yazl"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { createFolder, getExtension } from "../utils/files"

// https://www.npmjs.com/package/yazl (compression)
// https://www.npmjs.com/package/yauzl (decompression)

export function compressToZip(entries: { name: string; content?: Buffer | string; filePath?: string }[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const zipfile = new yazl.ZipFile()
        const writeStream = fs.createWriteStream(outputPath)
        let settled = false

        zipfile.outputStream.pipe(writeStream)

        // "close" instead of "finish" so the file is fully closed before the caller uploads/opens it
        writeStream.on("close", () => {
            if (settled) return
            settled = true
            resolve()
        })

        writeStream.on("error", (err) => {
            sendToMain(ToMain.ALERT, `Failed to create zip file: ${outputPath}`)
            fail(err)
        })

        // yazl reads added files lazily and reports failures on the ZipFile itself.
        zipfile.on("error", (err: Error) => fail(err))

        entries.forEach((entry) => {
            try {
                if (entry.filePath) {
                    // one unreadable file should not fail the entire zip,
                    // this also catches folders, which yazl refuses to add
                    const stats = fs.statSync(entry.filePath, { throwIfNoEntry: false })
                    if (!stats?.isFile()) {
                        console.error(`Skipped file in zip: ${entry.name} (${entry.filePath})`)
                        return
                    }

                    zipfile.addFile(entry.filePath, entry.name)
                    return
                }

                if (entry.content !== undefined && entry.content !== null) {
                    const buffer = typeof entry.content === "string" ? Buffer.from(entry.content, "utf-8") : entry.content
                    zipfile.addBuffer(buffer, entry.name)
                    return
                }

                console.error(`Skipped empty zip entry: ${entry.name}`)
            } catch (err) {
                console.error(`Error adding to zip: ${entry.name}`, err)
            }
        })

        zipfile.end()

        function fail(err: Error) {
            if (settled) return
            settled = true
            console.error(err)

            // stop yazl from pumping remaining entries
            zipfile.outputStream.unpipe(writeStream)
            ;(zipfile.outputStream as Readable).destroy()

            // clean up output file and reject promise
            fs.rmSync(outputPath, { force: true })
            reject(err)
        }
    })
}

export interface DecompressStreamOptions {
    // Return output path to write to disk, or undefined to buffer in memory
    getOutputPath?: (fileName: string) => string | undefined
}

function getZipErrorAlert(file: string, error: unknown) {
    const message = (error as Error)?.message?.toLowerCase() || ""
    if (message.includes("encrypted")) return "Can't decompress, this file is password protected!"
    return `Failed to open zip file: ${file}`
}

export async function decompressZip(files: string[], asBuffer = false, options?: DecompressStreamOptions) {
    const data: { content: Buffer | string; name: string; extension: string }[] = []

    for (const file of files) {
        try {
            const fileData = await decompressZipStream(file, asBuffer, options)
            data.push(...fileData)
        } catch (err) {
            sendToMain(ToMain.ALERT, getZipErrorAlert(file, err))
            console.error("Could not decompress zip file:", file, err)
        }
    }

    return data
}

export async function decompressZipStream(file: string, asBuffer = false, options?: DecompressStreamOptions): Promise<{ content: Buffer | string; name: string; extension: string }[]> {
    return new Promise((resolve, reject) => {
        const data: { content: Buffer | string; name: string; extension: string }[] = []
        let hasFinished = false

        const rejectOnce = (error: unknown, zipfile?: yauzl.ZipFile) => {
            if (hasFinished) return
            hasFinished = true

            if (zipfile) {
                try {
                    zipfile.close()
                } catch {
                    // ignore close errors during error cleanup
                }
            }

            reject(error instanceof Error ? error : new Error(String(error)))
        }

        const resolveOnce = () => {
            if (hasFinished) return
            hasFinished = true
            resolve(data)
        }

        yauzl.open(file, { lazyEntries: true, decodeStrings: false } as any, (err, zipfile) => {
            if (err) {
                rejectOnce(err)
                return
            }

            if (!zipfile) {
                rejectOnce(new Error("Failed to open zipfile"))
                return
            }

            zipfile.on("entry", (entry: yauzl.Entry) => {
                if (hasFinished) return

                const fileName = (entry.fileName as any as Buffer).toString("utf8")

                // Skip directories
                if (/\/$/.test(fileName)) {
                    zipfile.readEntry()
                    return
                }

                processEntry(entry, zipfile, data, asBuffer, options, fileName)
            })

            zipfile.on("end", resolveOnce)
            zipfile.on("error", (zipErr) => rejectOnce(zipErr, zipfile))

            zipfile.readEntry()
        })
    })
}

// neutralise path-traversal/absolute segments so a crafted archive can't write outside the extraction directory (zip-slip)
// legitimate nested names (e.g. "ppt/media/img.png") are left unchanged
function sanitizeZipPath(name: string): string {
    return name
        .replace(/\\/g, "/")
        .replace(/^([a-zA-Z]:|\/)/, "") // strip leading C: or /
        .split("/")
        .filter((segment) => segment && segment !== "." && segment !== "..")
        .join("/")
}

function processEntry(entry: yauzl.Entry, zipfile: yauzl.ZipFile, data: { content: Buffer | string; name: string; extension: string }[], asBuffer: boolean, options: DecompressStreamOptions | undefined, fileName: string) {
    const name = fileName
    const safeName = sanitizeZipPath(name)
    const extension = getExtension(name)
    // pass the sanitized name to callers that build a destination path, so "../" entries can't escape the target folder
    const outputPath = options?.getOutputPath?.(safeName)

    zipfile.openReadStream(entry, (err, readStream) => {
        if (err || !readStream) {
            if (err) {
                const errorMsg = err.message.toLowerCase()
                if (errorMsg.includes("encrypted")) {
                    sendToMain(ToMain.ALERT, "Can't decompress, this file is password protected!")
                }
                console.error("Failed to open zip entry stream:", name, err)
            }

            zipfile.readEntry()
            return
        }

        if (outputPath) {
            streamToDisk(readStream, outputPath, safeName, extension, data, zipfile)
        } else {
            bufferInMemory(readStream, safeName, extension, asBuffer, data, zipfile)
        }
    })
}

function streamToDisk(readStream: NodeJS.ReadableStream, outputPath: string, name: string, extension: string, data: { content: Buffer | string; name: string; extension: string }[], zipfile: yauzl.ZipFile) {
    let hasAdvanced = false
    const readNextEntry = () => {
        if (hasAdvanced) return
        hasAdvanced = true
        zipfile.readEntry()
    }

    try {
        createFolder(path.dirname(outputPath))
    } catch (err) {
        console.error("Failed to create parent directory for extraction:", outputPath, err)
    }

    const writeStream = fs.createWriteStream(outputPath)
    readStream.pipe(writeStream)

    writeStream.on("finish", () => {
        data.push({ content: outputPath, name, extension })
        readNextEntry()
    })

    writeStream.on("error", (err) => {
        console.error("Failed to write file to disk:", outputPath, err)
        readNextEntry()
    })

    readStream.on("error", (err) => {
        console.error("Failed to read zip entry stream:", name, err)
        writeStream.destroy()
        readNextEntry()
    })
}

const STRING_CONVERT_LIMIT = 50 * 1024 * 1024 // 50 MB
function bufferInMemory(readStream: NodeJS.ReadableStream, name: string, extension: string, asBuffer: boolean, data: { content: Buffer | string; name: string; extension: string }[], zipfile: yauzl.ZipFile) {
    const chunks: Buffer[] = []

    readStream.on("data", (chunk: Buffer) => chunks.push(chunk))

    readStream.on("end", () => {
        let content: Buffer | string = Buffer.concat(chunks)

        // import as string unless asBuffer is true, or it's a .pro file
        const stringType = extension !== "pro" && (!asBuffer || extension === "json")
        if (stringType) {
            if (content.length > STRING_CONVERT_LIMIT) {
                console.warn(`Skipped converting large file to string: ${name} (${content.length} bytes)`)
                zipfile.readEntry()
                return
            }

            content = content.toString("utf8")
        }

        data.push({ content, name, extension })
        zipfile.readEntry()
    })

    readStream.on("error", (err) => {
        console.error("Failed to read zip entry stream:", name, err)
        zipfile.readEntry()
    })
}

export function getZipModifiedDates(filePath: string): Promise<{ [key: string]: Date }> {
    return new Promise((resolve) => {
        yauzl.open(filePath, { lazyEntries: true, decodeStrings: false } as any, (err, zipfile) => {
            if (err || !zipfile) return resolve({})

            const modified: { [key: string]: Date } = {}

            zipfile.on("entry", (entry: yauzl.Entry) => {
                const fileName = (entry.fileName as any as Buffer).toString("utf8")
                modified[sanitizeZipPath(fileName)] = entry.getLastModDate()
                zipfile.readEntry()
            })

            zipfile.on("close", () => resolve(modified))
            zipfile.on("error", () => resolve({}))

            zipfile.readEntry()
        })
    })
}

export function isZip(path: string): Promise<boolean> {
    const initialBuffer = Buffer.alloc(4)

    return new Promise((resolve) => {
        fs.open(path, "r", (openError, fd) => {
            if (openError) {
                console.error(openError)
                resolve(false)
                return
            }

            fs.read(fd, initialBuffer, 0, 4, 0, (readError, _bytesRead, buffer) => {
                fs.close(fd, (closeError) => {
                    if (closeError) console.error(closeError)
                })

                if (readError) {
                    console.error(readError)
                    resolve(false)
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
