import fs from "fs"
import path from "path"
import { Readable } from "stream"
import { ToMain } from "../../types/IPC/ToMain"
import type { LessonFile, LessonsData } from "../../types/Main"
import { ContentProviderFactory } from "../contentProviders/base/ContentProvider"
import { sendToMain } from "../IPC/main"
import { doesPathExist, getDataFolderPath, getMimeType, getValidFileName, makeDir } from "../utils/files"
import { waitUntilValueIsDefined } from "../utils/helpers"
import { encryptFile, getProtectedPath, registerProtectedMediaFile } from "./protected"
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

// Shared streaming downloader
async function streamDownload(url: string, outputPath: string, onData?: (chunk: any) => void) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Status code: ${response.status}`)
    if (!response.body) throw new Error("Response body is empty")

    const fileStream = fs.createWriteStream(outputPath)
    const body = Readable.fromWeb(response.body as any)

    if (onData) body.on("data", onData)
    body.pipe(fileStream)

    return new Promise<void>((resolve, reject) => {
        body.on("error", (err) => {
            fileStream.close()
            reject(err)
        })
        fileStream.on("error", (err) => {
            fs.unlink(outputPath, () => {})
            reject(err)
        })
        fileStream.on("finish", () => {
            fileStream.close()
            resolve()
        })
    })
}

async function startDownload(data: DownloadFile) {
    const file = data.file
    const url = file.url

    if (!url) {
        currentlyDownloading--
        initDownload()
        return
    }

    makeDir(path.dirname(data.path))
    console.info(`Downloading lessons media: ${file.name}\n${url}`)

    try {
        await streamDownload(url, data.path)
        downloadCount++
        console.info(`Finished downloading file: ${file.name}`)
        sendToMain(ToMain.LESSONS_DONE, { showId: data.showId, status: { finished: downloadCount, failed: failedDownloads } })
        next()
    } catch (err: any) {
        console.error(`Request error: ${err.message}`)
        retry()
    }

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
            console.error(`File timed out: ${file.name}`)
            next()
        },
        60 * 8 * 1000
    ) // 8 minutes timeout
}

/// //

const downloading = new Set<string>()
export async function downloadMedia({ url, contentFile }: { url: string; contentFile?: any }) {
    if (!url?.startsWith("http") || url?.startsWith("blob:")) return

    if (downloading.has(url)) return
    downloading.add(url)

    const removeFromDownloading = () => downloading.delete(url)

    console.info("Downloading online media: " + url)

    const outputPath = getMediaThumbnailPath(url, contentFile)

    // Check if provider-based encryption is needed
    if (contentFile?.providerId) {
        const provider = ContentProviderFactory.getProvider(contentFile.providerId)
        if (provider?.shouldEncrypt?.(url, contentFile.pingbackUrl)) {
            const encryptionKey = provider.getEncryptionKey?.()
            if (!encryptionKey) {
                console.error(`Provider ${contentFile.providerId} requires encryption but did not provide an encryption key`)
                removeFromDownloading()
                return
            }
            encryptFile(url, outputPath, encryptionKey).finally(removeFromDownloading)
            return
        }
    }

    try {
        let downloadedSize = 0
        const totalSize = 0

        await streamDownload(url, outputPath, (chunk) => {
            downloadedSize += chunk.length
            if (totalSize > 0) sendToMain(ToMain.MEDIA_DOWNLOAD_PROGRESS, { url, progress: downloadedSize, total: totalSize, status: "downloading" })
        })

        removeFromDownloading()
        console.info(`Finished downloading file: ${url}`)
        sendToMain(ToMain.MEDIA_DOWNLOAD_PROGRESS, { url, progress: totalSize, total: totalSize, status: "complete" })
    } catch (err: any) {
        console.error(`Request error: ${err.message}`)
        sendToMain(ToMain.MEDIA_DOWNLOAD_PROGRESS, { url, progress: 0, total: 0, status: "error" })
        removeFromDownloading()
    }
}

export async function checkIfMediaDownloaded({ url, contentFile }: { url: string; contentFile?: any }) {
    if (!url?.startsWith("http")) return null
    if (downloading.has(url)) return { path: url, buffer: null, isDownloading: true }

    const outputPath = getMediaThumbnailPath(url, contentFile)
    if (!doesPathExist(outputPath)) return null

    if (contentFile?.providerId) {
        const provider = ContentProviderFactory.getProvider(contentFile.providerId)
        if (provider?.shouldEncrypt?.(url, contentFile.pingbackUrl)) {
            try {
                const protectedUrl = registerProtectedMediaFile({
                    filePath: outputPath,
                    providerId: contentFile.providerId,
                    mimeType: getMimeTypeFromContentFile(contentFile, outputPath)
                })
                return protectedUrl ? { path: outputPath, buffer: null, protectedUrl } : null
            } catch (err) {
                console.error(`Failed to prepare protected media: ${url}`, err)
                return null
            }
        }
    }

    return { path: outputPath, buffer: null }
}

function getMediaThumbnailPath(url: string, contentFile?: any) {
    // Check if provider-based encryption is needed
    if (contentFile?.providerId) {
        const provider = ContentProviderFactory.getProvider(contentFile.providerId)
        if (provider?.shouldEncrypt?.(url, contentFile.pingbackUrl)) return getProtectedPath(url)
    }

    const urlWithoutQuery = url.split("?")[0]
    const extension = path.extname(urlWithoutQuery)
    const fileName = `${filePathHashCode(url)}${extension}`
    const outputFolder = getDataFolderPath("onlineMedia")

    return path.join(outputFolder, fileName)
}

function getMimeTypeFromContentFile(contentFile: any, fallbackPath: string) {
    if (typeof contentFile?.mimeType === "string") return contentFile.mimeType
    if (contentFile?.type === "image") return "image/jpeg"
    if (contentFile?.type === "video") return "video/mp4"
    return getMimeType(fallbackPath) || "application/octet-stream"
}
