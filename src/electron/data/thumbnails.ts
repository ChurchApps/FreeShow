import { app } from "electron"
import ffmpegPath from "ffmpeg-static"
import fs from "fs"
import path from "path"
import SimpleThumbnail from "simple-thumbnail-ts"
import { doesPathExist } from "../utils/files"

export function createThumbnail(filePath: string, size: number = 250) {
    if (!filePath) return ""

    let outputPath = getThumbnailPath(filePath, size)

    generateThumbnail(filePath, outputPath, size)

    return outputPath
}

const s = new SimpleThumbnail()
async function generateThumbnail(filePath: string, outputPath: string, size: number = 250) {
    if (doesPathExist(outputPath)) return

    // let ext = path.extname(filePath).slice(1)
    // let isImage = defaultSettings.imageExtensions.includes(ext)

    try {
        await s.generate(filePath, outputPath, size + "x?", { path: ffmpegPath || "", seek: "00:00:05" }) // might not work if video is shorter!!
        // if (isImage) await s.generate(filePath, outputPath, size + "x?", { path: ffmpegPath || "" })
        // else await s.generate(filePath, outputPath, size + "x?", { path: ffmpegPath || "", seek: "00:00:10" }) // WIP test video length shorter
    } catch (err) {
        console.error(err)
    }
}

let thumbnailFolderPath: string = ""
function getThumbnailFolderPath() {
    if (thumbnailFolderPath) return thumbnailFolderPath

    let p: string = path.join(app.getPath("temp"), "freeshow-cache")
    if (!doesPathExist(p)) fs.mkdirSync(p, { recursive: true })
    thumbnailFolderPath = p

    return p
}

function getThumbnailPath(filePath: string, size: number = 250) {
    let folderPath = thumbnailFolderPath || getThumbnailFolderPath()
    return path.join(folderPath, `${hashCode(filePath)}-${size}.jpg`)
}

function hashCode(str: string) {
    let hash = 0

    for (let i = 0; i < str.length; i++) {
        let chr = str.charCodeAt(i)
        hash = (hash << 5) - hash + chr // bit shift
        hash |= 0 // convert to 32bit integer
    }

    if (hash < 0) return "i" + hash.toString().slice(1)
    return "a" + hash.toString()
}
