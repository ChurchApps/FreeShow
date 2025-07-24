import { https } from "follow-redirects"
import fs from "fs"
import path from "path"
import { ToMain } from "../../types/IPC/ToMain"
import type { LessonFile, LessonsData } from "../../types/Main"
import { sendToMain } from "../IPC/main"
import { createFolder, dataFolderNames, doesPathExist, getDataFolder, makeDir } from "../utils/files"
import { waitUntilValueIsDefined } from "../utils/helpers"
import { filePathHashCode } from "./thumbnails"

export function downloadLessonsMedia(lessons: LessonsData[]) {
    const replace = lessons.map(checkLesson)

    sendToMain(ToMain.REPLACE_MEDIA_PATHS, replace.flat())
}

function checkLesson(lesson: LessonsData) {
    const type = lesson.type || "lessons"

    downloadCount = 0
    failedDownloads = 0
    sendToMain(ToMain.LESSONS_DONE, { showId: lesson.showId, status: { finished: 0, failed: 0 } })

    const lessonsFolder = getDataFolder(lesson.path, dataFolderNames[type])
    const lessonFolder = path.join(lessonsFolder, lesson.name)
    makeDir(lessonFolder)

    return lesson.files
        .map((file) => {
            const filePath = getFilePath(file)
            if (!filePath) return

            return downloadFile(filePath, file, lesson.showId)
        })
        .filter((a) => a)

    function getFilePath(file: LessonFile) {
        if (type === "planningcenter") return path.join(lessonFolder, file.name)

        if (file.streamUrl) file.fileType = "video/mp4"
        const extension = getFileExtension(file.url, file.fileType)
        if (!extension) return

        let fileName = file.name
        if (!fileName.includes("." + extension)) fileName += "." + extension

        return path.join(lessonFolder, fileName)
    }
}

function getFileExtension(url: string, fileType = "") {
    if (fileType.includes("mp4") || url.includes(".mp4")) return "mp4"
    if (fileType.includes("jpg") || fileType.includes("jpeg") || url.includes(".jpg") || url.includes(".jpeg")) return "jpg"
    if (fileType.includes("png") || url.includes(".png")) return "png"

    return ""
}

function downloadFile(filePath: string, file: LessonFile, showId: string) {
    const fileRef = { from: file.url, to: filePath, type: file.type }

    if (doesPathExist(filePath)) {
        // console.log(filePath + " exists!")
        downloadCount++
        sendToMain(ToMain.LESSONS_DONE, { showId, status: { finished: downloadCount, failed: failedDownloads } })
        return fileRef
    }

    addToDownloadQueue({ path: filePath, file, showId })

    return fileRef
}

type DownloadFile = { path: string; file: LessonFile; showId: string }
const downloadQueue: DownloadFile[] = []
function addToDownloadQueue(file: DownloadFile) {
    const alreadyInQueue = downloadQueue.find((a) => a.path === file.path)
    if (alreadyInQueue) {
        downloadCount++
        return
    }

    downloadQueue.push(file)
    initDownload()
}

let currentlyDownloading = 0
const maxAmount = 5
const refillMargin = maxAmount * 0.6
let waiting = false
async function initDownload() {
    if (waiting) return

    if (!downloadQueue.length) {
        if (currentlyDownloading < 1 && downloadCount) {
            console.info(`${downloadCount} file(s) downloaded!`)
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
    startDownload(downloadQueue.shift()!)
}

let downloadCount = 0
let failedDownloads = 0
let errorCount = 0
function startDownload(downloading: DownloadFile) {
    // download the media
    const file = downloading.file
    const url = file.url

    if (!url) return next()

    const fileStream = fs.createWriteStream(downloading.path)
    console.info(`Downloading lessons media: ${file.name}`)
    console.info(url)
    https
        .get(url, (res) => {
            if (res.statusCode !== 200) {
                fileStream.close()
                fs.unlink(downloading.path, (err) => console.error(err))

                console.error(`Failed to download file, status code: ${String(res.statusCode)}`)
                failedDownloads++
                sendToMain(ToMain.LESSONS_DONE, { showId: downloading.showId, status: { finished: downloadCount, failed: failedDownloads } })

                next()
                return
            }

            res.pipe(fileStream)

            res.on("error", (err) => {
                fileStream.close()
                console.error(`Response error: ${err.message}`)

                retry()
            })

            fileStream.on("error", (err1) => {
                fs.unlink(downloading.path, (err2) => console.error(err2))
                console.error(`File error: ${err1.message}`)

                retry()
            })

            fileStream.on("finish", () => {
                fileStream.close()
                downloadCount++
                console.error(`Finished downloading file: ${file.name}`)
                sendToMain(ToMain.LESSONS_DONE, { showId: downloading.showId, status: { finished: downloadCount, failed: failedDownloads } })

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
            sendToMain(ToMain.LESSONS_DONE, { showId: downloading.showId, status: { finished: downloadCount, failed: failedDownloads } })

            next()
            return
        }
        errorCount++

        addToDownloadQueue(downloading)
        next()
    }

    const timeout = setTimeout(
        () => {
            fileStream.close()
            console.error(`File timed out: ${file.name}`)
            next()
        },
        60 * 8 * 1000
    ) // 8 minutes timeout
}

/////

let downloading: string[] = []
export async function downloadMedia({ url, dataPath }: { url: string; dataPath: string }) {
    if (!url?.includes("http")) return

    if (downloading.includes(url)) return
    downloading.push(url)

    const extension = path.extname(url)
    const fileName = `${filePathHashCode(url)}${extension}`
    const outputFolder = getDataFolder(dataPath, dataFolderNames.onlineMedia)
    const outputPath = path.join(outputFolder, fileName)
    createFolder(outputFolder)

    const fileStream = fs.createWriteStream(outputPath)
    https
        .get(url, (res) => {
            if (res.statusCode !== 200) {
                fileStream.close()
                fs.unlink(outputPath, (err) => console.error(err))

                console.error(`Failed to download file, status code: ${String(res.statusCode)}`)
                return
            }

            res.pipe(fileStream)

            res.on("error", (err) => {
                fileStream.close()
                console.error(`Response error: ${err.message}`)

                retry()
            })

            fileStream.on("error", (err1) => {
                fs.unlink(outputPath, (err2) => console.error(err2))
                console.error(`File error: ${err1.message}`)

                retry()
            })

            fileStream.on("finish", () => {
                fileStream.close()
                downloadCount++
                console.error(`Finished downloading file: ${url}`)
            })
        })
        .on("error", (err) => {
            fileStream.close()
            console.error(`Request error: ${err.message}`)

            retry()
        })

    let errorCount2 = 0
    function retry() {
        if (errorCount2 > 5) {
            return
        }
        errorCount2++
    }

    // const timeout = setTimeout(
    //     () => {
    //         fileStream.close()
    //         console.error(`File timed out: ${url}`)
    //     },
    //     60 * 8 * 1000
    // ) // 8 minutes timeout
}

export async function checkIfMediaDownloaded({ url, dataPath }: { url: string; dataPath: string }) {
    if (!url?.includes("http")) return null

    const extension = path.extname(url)
    const fileName = `${filePathHashCode(url)}${extension}`
    const outputFolder = getDataFolder(dataPath, dataFolderNames.onlineMedia)
    const outputPath = path.join(outputFolder, fileName)

    if (!doesPathExist(outputPath)) return null
    return outputPath
}
