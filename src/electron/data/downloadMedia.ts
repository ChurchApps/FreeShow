import { https } from "follow-redirects"
import fs from "fs"
import path from "path"
import { toApp } from ".."
import { MAIN } from "../../types/Channels"
import { dataFolderNames, doesPathExist, getDataFolder, makeDir } from "../utils/files"
import { waitUntilValueIsDefined } from "../utils/helpers"

export function downloadMedia(lessons: any[]) {
    let replace = lessons.map(checkLesson)

    toApp(MAIN, { channel: "REPLACE_MEDIA_PATHS", data: replace.flat() })
}

function checkLesson(lesson: any) {
    downloadCount = 0
    failedDownloads = 0
    toApp(MAIN, { channel: "LESSONS_DONE", data: { showId: lesson.showId, status: { finished: 0, failed: 0 } } })

    const lessonsFolder = getDataFolder(lesson.path, dataFolderNames.lessons)
    const lessonFolder = path.join(lessonsFolder, lesson.name)
    makeDir(lessonFolder)

    return lesson.files
        .map((file: any) => {
            let filePath = getFilePath(file)
            if (!filePath) return

            return downloadFile(filePath, file, lesson.showId)
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

function downloadFile(filePath: string, file: any, showId: string) {
    let fileRef = { from: file.url, to: filePath, type: file.type }

    if (doesPathExist(filePath)) {
        // console.log(filePath + " exists!")
        downloadCount++
        toApp(MAIN, { channel: "LESSONS_DONE", data: { showId, status: { finished: downloadCount, failed: failedDownloads } } })
        return fileRef
    }

    addToDownloadQueue({ path: filePath, file, showId })

    return fileRef
}

let downloadQueue: any[] = []
function addToDownloadQueue(file: any) {
    let alreadyInQueue = downloadQueue.find((a) => a.path === file.path)
    if (alreadyInQueue) {
        downloadCount++
        return
    }

    downloadQueue.push(file)
    initDownload()
}

let currentlyDownloading: number = 0
const maxAmount = 5
const refillMargin = maxAmount * 0.6
let waiting: boolean = false
async function initDownload() {
    if (waiting) return

    if (!downloadQueue.length) {
        if (currentlyDownloading < 1 && downloadCount) {
            console.log(`${downloadCount} file(s) downloaded!`)
            downloadCount = 0
            failedDownloads = 0

            return
        }

        // return setTimeout(initDownload, 500)
        return
    }

    // generate a max amount at the same time
    if (currentlyDownloading > maxAmount) {
        waiting = true
        await waitUntilValueIsDefined(() => currentlyDownloading < refillMargin)
        waiting = false
    }

    if (!downloadQueue[0]) {
        downloadQueue.shift()
        initDownload()
        return
    }

    currentlyDownloading++
    startDownload(downloadQueue.shift())
}

let downloadCount: number = 0
let failedDownloads: number = 0
let errorCount: number = 0
async function startDownload(downloading: any) {
    // download the media
    const file = downloading.file
    let url = file.url

    if (!url) return next()

    const fileStream = fs.createWriteStream(downloading.path)
    console.log(`Downloading lessons media: ${file.name}`)
    https
        .get(url, (res) => {
            if (res.statusCode !== 200) {
                fileStream.close()
                fs.unlink(downloading.path, () => {})

                console.error(`Failed to download file, status code: ${res.statusCode}`)
                failedDownloads++
                toApp(MAIN, { channel: "LESSONS_DONE", data: { showId: downloading.showId, status: { finished: downloadCount, failed: failedDownloads } } })

                next()
                return
            }

            res.pipe(fileStream)

            res.on("error", (err) => {
                fileStream.close()
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
                console.error(`Finished downloading file: ${file.name}`)
                toApp(MAIN, { channel: "LESSONS_DONE", data: { showId: downloading.showId, status: { finished: downloadCount, failed: failedDownloads } } })

                next()
            })
        })
        .on("error", (err) => {
            fileStream.close()
            console.error(`Request error: ${err.message}`)

            retry()
        })

    function next() {
        clearTimeout(timeout)
        currentlyDownloading--
        initDownload()
    }

    function retry() {
        if (errorCount > 5) {
            failedDownloads++
            toApp(MAIN, { channel: "LESSONS_DONE", data: { showId: downloading.showId, status: { finished: downloadCount, failed: failedDownloads } } })

            next()
            return
        }
        errorCount++

        addToDownloadQueue(downloading)
        next()
    }

    let timeout = setTimeout(() => {
        fileStream.close()
        console.error(`File timed out: ${file.name}`)
        next()
    }, 60 * 8 * 1000) // 8 minutes timeout
}
