import { app } from "electron"
import fs from "fs"
import path from "path"
// import ffmpeg from 'ffmpeg-static'
import ffmpegPath from "ffmpeg-static"
import SimpleThumbnail from "simple-thumbnail-ts"
import { doesPathExist } from "../utils/files"

export function createThumbnail(filePath: string, size: number = 250) {
    if (!filePath) return ""

    let outputPath = getThumbnailPath(filePath)

    console.log(filePath, outputPath)
    generateThumbnail(filePath, outputPath, size)

    return outputPath
}

const s = new SimpleThumbnail()
async function generateThumbnail(filePath: string, outputPath: string, size: number = 250) {
    if (doesPathExist(outputPath)) return

    try {
        await s.generate(filePath, outputPath, size + "x?", { path: ffmpegPath || "", seek: "00:00:10" })
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
    console.log("TEMP", p)

    return p
}

export function getThumbnailPath(filePath: string) {
    let folderPath = thumbnailFolderPath || getThumbnailFolderPath()
    return path.join(folderPath, hashCode(filePath) + ".jpg")
}

function hashCode(str: string) {
    let hash = 0

    for (let i = 0; i < str.length; i++) {
        let chr = str.charCodeAt(i)
        hash = (hash << 5) - hash + chr // bit shift
        hash |= 0 // convert to 32bit integer
    }

    if (hash < 0) return "i1" + hash.toString().slice(1)

    return "a1" + hash.toString()
}
