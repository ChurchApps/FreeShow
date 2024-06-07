import { https } from "follow-redirects"
import fs from "fs"
import path from "path"
import { toApp } from ".."
import { MAIN } from "../../types/Channels"
import { dataFolderNames, doesPathExist, getDataFolder } from "../utils/files"

export function downloadMedia(lessons: any[]) {
    let replace = lessons.map(checkLesson)

    toApp(MAIN, { channel: "REPLACE_MEDIA_PATHS", data: replace.flat() })
}

function checkLesson(lesson: any) {
    const lessonsFolder = getDataFolder(lesson.path, dataFolderNames.lessons)
    const lessonFolder = path.join(lessonsFolder, lesson.name)
    fs.mkdirSync(lessonFolder, { recursive: true })

    return lesson.files
        .map((file: any) => {
            let filePath = getFilePath(file)
            if (!filePath) return

            return downloadFile(filePath, file)
        })
        .filter((a: any) => a)

    function getFilePath(file: any) {
        if (file.streamUrl) file.fileType = "video/mp4"
        let extension = getFileExtension(file.url, file.fileType)
        if (!extension) return

        let fileName = file.name
        if (!fileName.includes("." + extension)) fileName += "." + extension

        return path.join(lessonFolder, fileName)
    }
}

function getFileExtension(url: string, fileType: string = "") {
    if (fileType.includes("mp4") || url.includes(".mp4")) return "mp4"
    if (fileType.includes("jpg") || fileType.includes("jpeg") || url.includes(".jpg") || url.includes(".jpeg")) return "jpg"
    if (fileType.includes("png") || url.includes(".png")) return "png"

    return ""
}

function downloadFile(filePath: string, file: any) {
    let fileRef = { from: file.url, to: filePath, type: file.type }

    if (doesPathExist(filePath)) {
        // console.log(filePath + " exists!")
        return fileRef
    }

    addToDownloadQueue({ path: filePath, file })

    return fileRef
}

let downloadQueue: any[] = []
function addToDownloadQueue(file: any) {
    downloadQueue.push(file)
    startDownload()
}

let downloading: any = null
let downloadCount: number = 0
let errorCount: number = 0
async function startDownload() {
    if (downloading) return
    if (!downloadQueue.length) {
        if (downloadCount) console.log(`${downloadCount} file(s) downloaded!`)
        return
    }

    let timeout = true
    setTimeout(() => {
        if (!timeout) return
        next()
    }, 8000)

    downloading = downloadQueue.shift()

    // download the media
    const fileStream = fs.createWriteStream(downloading.path)
    const file = downloading.file
    let url = file.url

    if (!url) return next()

    console.log(`Downloading lessons media: ${file.name}`)
    https
        .get(url, (res) => {
            if (res.statusCode !== 200) {
                console.error(`Failed to download file, status code: ${res.statusCode}`)
                fs.unlink(downloading.path, () => {})
                next()
                return
            }

            res.pipe(fileStream)

            res.on("error", (err) => {
                console.log(`Response error: ${err.message}`)
                retry()
            })

            fileStream.on("error", (err) => {
                fs.unlink(downloading.path, () => {})
                console.error(`File error: ${err.message}`)
                retry()
            })

            fileStream.on("finish", () => {
                fileStream.close()
                downloadCount++

                next()
            })
        })
        .on("error", (err) => {
            fs.unlink(downloading.path, () => {})
            console.error(`Request error: ${err.message}`)
            retry()
        })

    function next() {
        if (!timeout) return

        timeout = false
        downloading = null
        startDownload()
    }

    function retry() {
        if (errorCount > 5) return
        errorCount++

        next()
        addToDownloadQueue(downloading)
    }
}
