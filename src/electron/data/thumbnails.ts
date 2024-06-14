import { app } from "electron"
import ffmpegPath from "ffmpeg-static"
import fs from "fs"
import path from "path"
// import SimpleThumbnail from "simple-thumbnail-ts"
import SimpleThumbnail from "./ffmpegtest"
import { doesPathExist } from "../utils/files"

export function getThumbnail(data: any) {
    let output = createThumbnail(data.input, data.size || 500)

    return { ...data, output }
}

export function createThumbnail(filePath: string, size: number = 250) {
    if (!filePath) return ""

    let outputPath = getThumbnailPath(filePath, size)

    addToGenerateQueue({ input: filePath, output: outputPath, size })

    return outputPath
}

type Thumbnail = { input: string; output: string; size: number }
let thumbnailQueue: Thumbnail[] = []
function addToGenerateQueue(data: Thumbnail) {
    thumbnailQueue.push(data)
    nextInQueue()
}

let working = false
async function nextInQueue() {
    if (working || !thumbnailQueue[0]) return

    working = true
    await generateThumbnail(thumbnailQueue.shift()!)

    working = false
    nextInQueue()
}

let exists: string[] = []
const s = new SimpleThumbnail()
async function generateThumbnail(data: Thumbnail) {
    if (exists.includes(data.output) || doesPathExist(data.output)) {
        exists.push(data.output)
        return
    }

    try {
        // seek might not work if video is shorter than 3 seconds (but original video will then get rendered instead of thumbnail)
        await s.generate(data.input, data.output, data.size + "x?", { path: ffmpegPath || "", seek: "00:00:03" })
        exists.push(data.output)
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
