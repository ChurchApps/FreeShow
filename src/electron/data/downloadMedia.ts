import { https } from "follow-redirects"
import fs from "fs"
import path from "path"
import { ToMain } from "../../types/IPC/ToMain"
import type { LessonFile, LessonsData } from "../../types/Main"
import { sendToMain } from "../IPC/main"
import { doesPathExist, getDataFolderPath, getValidFileName, makeDir } from "../utils/files"
import { waitUntilValueIsDefined } from "../utils/helpers"
import { decryptFile, encryptFile, getProtectedPath } from "./protected"
import { filePathHashCode } from "./thumbnails"
import { ContentProviderFactory } from "../contentProviders/base/ContentProvider"

export function downloadLessonsMedia(lessons: LessonsData[]) {
    const replace = lessons.map(checkLesson)

    sendToMain(ToMain.REPLACE_MEDIA_PATHS, replace.flat())
}

function checkLesson(lesson: LessonsData) {
    const type = lesson.type || "lessons"

    downloadCount = 0
    failedDownloads = 0
    sendToMain(ToMain.LESSONS_DONE, { showId: lesson.showId, status: { finished: 0, failed: 0 } })

    const folderName = getValidFileName(lesson.name)
    const lessonFolder = getDataFolderPath("lessons", folderName)
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
function startDownload(data: DownloadFile) {
    // download the media
    const file = data.file
    const url = file.url

    if (!url) return next()

    makeDir(path.dirname(data.path))
    const fileStream = fs.createWriteStream(data.path)
    console.info(`Downloading lessons media: ${file.name}`)
    console.info(url)
    https
        .get(url, (res) => {
            if (res.statusCode !== 200) {
                fileStream.close()
                fs.unlink(data.path, (err) => console.error(err))

                console.error(`Failed to download file, status code: ${String(res.statusCode)}`)
                failedDownloads++
                sendToMain(ToMain.LESSONS_DONE, { showId: data.showId, status: { finished: downloadCount, failed: failedDownloads } })

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
                fs.unlink(data.path, (err2) => console.error(err2))
                console.error(`File error: ${err1.message}`)

                retry()
            })

            fileStream.on("finish", () => {
                fileStream.close()
                downloadCount++
                console.error(`Finished downloading file: ${file.name}`)
                sendToMain(ToMain.LESSONS_DONE, { showId: data.showId, status: { finished: downloadCount, failed: failedDownloads } })

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
            sendToMain(ToMain.LESSONS_DONE, { showId: data.showId, status: { finished: downloadCount, failed: failedDownloads } })

            next()
            return
        }
        errorCount++

        addToDownloadQueue(data)
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

/// //

const downloading: string[] = []
export function downloadMedia({ url, contentFile }: { url: string; contentFile?: any }) {
    if (!url?.includes("http") || url?.includes("blob:")) return

    if (downloading.includes(url)) return
    downloading.push(url)

    console.info("Downloading online media: " + url)

    const outputPath = getMediaThumbnailPath(url, contentFile)

    // Check if provider-based encryption is needed
    if (contentFile?.providerId) {
        const provider = ContentProviderFactory.getProvider(contentFile.providerId as any)
        if (provider?.shouldEncrypt?.(url, contentFile.pingbackUrl)) {
            const encryptionKey = provider.getEncryptionKey?.()
            if (!encryptionKey) {
                console.error(`Provider ${contentFile.providerId} requires encryption but did not provide an encryption key`)
                return
            }
            encryptFile(url, outputPath, encryptionKey)
            return
        }
    }

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

export async function checkIfMediaDownloaded({ url, contentFile }: { url: string; contentFile?: any }) {
    if (!url?.includes("http")) return null

    const outputPath = getMediaThumbnailPath(url, contentFile)
    if (!doesPathExist(outputPath)) return null

    // Check if provider-based encryption is needed
    if (contentFile?.providerId) {
        const provider = ContentProviderFactory.getProvider(contentFile.providerId as any)
        if (provider?.shouldEncrypt?.(url, contentFile.pingbackUrl)) {
            try {
                const encryptionKey = provider.getEncryptionKey?.()
                if (!encryptionKey) {
                    console.error(`Provider ${contentFile.providerId} requires encryption but did not provide an encryption key`)
                    return null
                }
                const decryptedData = await decryptFile(outputPath, encryptionKey)
                return { path: outputPath, buffer: decryptedData }
            } catch (err) {
                console.error(`Failed to decrypt file: ${url}`, err)
                // this response will request a re-download, and replace the file
                // important in case the key has changed or file is corrupted
                return null
            }
        }
    }

    return { path: outputPath, buffer: null }
}

function getMediaThumbnailPath(url: string, contentFile?: any) {
    // Check if provider-based encryption is needed
    if (contentFile?.providerId) {
        const provider = ContentProviderFactory.getProvider(contentFile.providerId as any)
        if (provider?.shouldEncrypt?.(url, contentFile.pingbackUrl)) {
            return getProtectedPath(url)
        }
    }

    const urlWithoutQuery = url.split('?')[0]
    const extension = path.extname(urlWithoutQuery)
    const fileName = `${filePathHashCode(url)}${extension}`
    const outputFolder = getDataFolderPath("onlineMedia")

    return path.join(outputFolder, fileName)
}