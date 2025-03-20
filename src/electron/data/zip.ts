import AdmZip from "adm-zip"
import fs from "fs"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { getExtension } from "../utils/files"

// https://www.npmjs.com/package/adm-zip

export function decompress(files: string[], asBuffer: boolean = false) {
    let data: any[] = []

    files.forEach((file) => {
        const zip = new AdmZip(file)
        const zipEntries = zip.getEntries()

        zipEntries.forEach((zipEntry) => {
            let content: Buffer | string
            try {
                content = zipEntry.getData()
            } catch (err) {
                console.error(err)
                if (err.message.includes("Incompatible password parameter")) {
                    sendToMain(ToMain.ALERT, "Can't decompress, this file is password protected!")
                }
                return
            }

            const name = zipEntry.entryName
            const extension = getExtension(name)

            if (extension !== "pro" && (!asBuffer || extension === "json")) content = content.toString("utf8")

            data.push({ content, name, extension })
        })
    })

    return data
}

export function isZip(path: string): Promise<boolean> {
    const buffer = Buffer.alloc(4)

    return new Promise((resolve) => {
        fs.open(path, "r", (err, fd) => {
            if (err) {
                console.error(err)
                resolve(false)
            }

            fs.read(fd, buffer, 0, 4, 0, (err, _bytesRead, buffer) => {
                if (err) {
                    fs.close(fd, (err1) => {
                        console.error(err1 || err)
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
