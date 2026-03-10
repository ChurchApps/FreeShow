import type { NativeImage, ResizeOptions } from "electron"
import { app, BrowserWindow, nativeImage } from "electron"
import fs from "fs"
import path from "path"
import { loadWindowContent } from ".."
import { OUTPUT } from "../../types/Channels"
import { ToMain } from "../../types/IPC/ToMain"
import type { Output } from "../../types/Output"
import type { Resolution } from "../../types/Settings"
import { requestToMain, sendToMain } from "../IPC/main"
import { OutputHelper } from "../output/OutputHelper"
import { createFolder, deleteFile, doesPathExist, doesPathExistAsync, getDataFolderPath, getFileStatsAsync, makeDir } from "../utils/files"
import { waitUntilValueIsDefined } from "../utils/helpers"
import { captureOptions } from "../utils/windowOptions"
import { imageExtensions, videoExtensions } from "./media"
import { appDataPath } from "./store"

export async function doesMediaExist(data: { path: string; creationTime?: number; noCache?: boolean }) {
    if (!(await doesPathExistAsync(data.path))) {
        deleteThumbnails(data.path)
        return { path: data.path, exists: false }
    }

    if (data.noCache) {
        return { path: data.path, exists: true }
    }

    // if it exists, get the creation date
    const stats = await getFileStatsAsync(data.path)
    const creationTime = Math.floor(stats?.ctimeMs || 0)
    if (data.creationTime && creationTime !== data.creationTime) {
        deleteThumbnails(data.path)
        return { path: data.path, exists: false }
    }

    return { path: data.path, exists: true, creationTime }
}

// delete thumbnail cache
const sizes = [900, 500, 250, 100]
function deleteThumbnails(filePath: string) {
    sizes.forEach((size) => {
        const outputPath = getThumbnailPath(filePath, size)
        if (doesPathExist(outputPath)) deleteFile(outputPath)
    })
}

let currentlyGenerating = new Set<string>()
export async function getThumbnail(data: { input: string; size: number }) {
    console.log("[getThumbnail] START - input:", data.input, "size:", data.size)
    
    if (!(await doesPathExistAsync(data.input))) {
        console.error("[getThumbnail] File does not exist:", data.input)
        return { ...data, output: "" }
    }

    const mediaId = `${data.input}-${data.size}`
    console.log("[getThumbnail] mediaId:", mediaId)
    
    if (currentlyGenerating.has(mediaId)) {
        console.log("[getThumbnail] Already generating, waiting...")
        await waitUntilValueIsDefined(() => !currentlyGenerating.has(mediaId), 50, 10000)
        console.log("[getThumbnail] Finished waiting, returning cached path")
        return finish(getThumbnailPath(data.input, data.size))
    }
    
    currentlyGenerating.add(mediaId)
    console.log("[getThumbnail] Added to queue, currently generating:", currentlyGenerating.size)

    const outputPath = getThumbnailPath(data.input, data.size || 500)
    console.log("[getThumbnail] Output path:", outputPath)
    
    if (await doesPathExistAsync(outputPath)) {
        console.log("[getThumbnail] Cache exists, returning")
        currentlyGenerating.delete(mediaId)
        return finish(outputPath)
    }

    console.log("[getThumbnail] Cache miss, creating thumbnail...")
    createThumbnail(data.input, data.size || 500)
    console.log("[getThumbnail] Thumbnail queued, waiting for generation...")

    const waitStart = Date.now()
    await waitUntilValueIsDefined(() => !currentlyGenerating.has(mediaId), 50, 10000)
    console.log("[getThumbnail] Generation complete in", Date.now() - waitStart, "ms")

    return finish(outputPath)

    function finish(output: string) {
        console.log("[getThumbnail] finish() - output:", output, "failedPaths:", failedPaths)
        if (failedPaths.includes(mediaId)) {
            console.error("[getThumbnail] FAILED - removing from failedPaths")
            failedPaths.splice(failedPaths.indexOf(mediaId), 1)
            return { ...data, output: "" }
        }

        console.log("[getThumbnail] SUCCESS - returning", { ...data, output })
        return { ...data, output }
    }
}

export function createThumbnail(filePath: string, size = 250) {
    if (!filePath) {
        console.error("[createThumbnail] No filepath provided")
        return ""
    }

    console.log("[createThumbnail] Creating thumbnail for:", filePath, "size:", size)
    const outputPath = getThumbnailPath(filePath, size)
    console.log("[createThumbnail] Output path:", outputPath)

    addToGenerateQueue({ input: filePath, output: outputPath, size })

    return outputPath
}

type Thumbnail = { input: string; output: string; size: number }
const thumbnailQueue: Thumbnail[] = []
function addToGenerateQueue(data: Thumbnail) {
    thumbnailQueue.push(data)
    nextInQueue()
}

// let working = false
function nextInQueue() {
    // if (working) return
    if (!thumbnailQueue[0]) return

    // working = true
    generateThumbnail(thumbnailQueue.shift()!)
}

function generationFinished(mediaId: string) {
    // working = false
    nextInQueue()

    if (currentlyGenerating.has(mediaId)) currentlyGenerating.delete(mediaId)
}

async function generateThumbnail(data: Thumbnail) {
    const mediaId = `${data.input}-${data.size}`
    console.log("[generateThumbnail] START - input:", data.input, "output:", data.output)
    
    const ext = getExtension(data.input)
    const isValidMedia = [...imageExtensions, ...videoExtensions].includes(ext)
    console.log("[generateThumbnail] Extension:", ext, "isValidMedia:", isValidMedia)
    
    if (!isValidMedia) {
        console.log("[generateThumbnail] Not a valid media type, skipping")
        return generationFinished(mediaId)
    }
    
    if (await doesPathExistAsync(data.output)) {
        console.log("[generateThumbnail] Output already exists, skipping")
        generationFinished(mediaId)
        return
    }

    try {
        console.log("[generateThumbnail] Calling generate()...")
        await generate(data.input, data.output, String(data.size) + "x?", { seek: 0.5 }, mediaId)
        console.log("[generateThumbnail] generate() completed")
    } catch (err) {
        console.error("[generateThumbnail] ERROR in generate():", err)
        generationFinished(mediaId)
    }
}
let thumbnailFolderPath = ""
export function getThumbnailFolderPath() {
    if (thumbnailFolderPath) return thumbnailFolderPath

    // use app data path for cache, fallback to temp if appData is not available
    let folderPath: string
    try {
        folderPath = path.join(appDataPath, "media-cache")
        if (!doesPathExist(folderPath)) makeDir(folderPath)
    } catch (err) {
        // fallback to temp directory if app data path is not accessible
        // temp folder is periodically deleted on macOS
        folderPath = path.join(app.getPath("temp"), "freeshow-cache")
        if (!doesPathExist(folderPath)) makeDir(folderPath)
    }

    thumbnailFolderPath = folderPath
    return folderPath
}

function getThumbnailPath(filePath: string, size = 250) {
    const folderPath = thumbnailFolderPath || getThumbnailFolderPath()
    return path.join(folderPath, `${filePathHashCode(filePath)}-${size}.png`)
}

export function filePathHashCode(str: string) {
    let hash = 0

    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i)
        hash = (hash << 5) - hash + chr // bit shift
        hash |= 0 // convert to 32bit integer
    }

    if (hash < 0) return "i" + hash.toString().slice(1)
    return "a" + hash.toString()
}

/// // GENERATE /////

interface Config {
    seek?: number // 0-1
    // format?: "jpg" | "jpeg" | "png"
    // quality?: number // 0-100
}
// const customImageCapture = ["gif", "webp"]
async function generate(input: string, output: string, size: string, config: Config = {}, mediaId: string) {
    if (!input || !output) {
        generationFinished(mediaId)
        return
    }

    const parsedSize = parseSize(size)
    // let extension = getExtension(input)

    // capture images directly from electron nativeImage (fastest)
    // WIP this was unreliable
    // if (!customImageCapture.includes(extension) && defaultSettings.imageExtensions.includes(extension)) return captureImage(input, output, parsedSize)

    // capture other media with canvas in main window
    await captureWithCanvas({ input, output, size: parsedSize, extension: getExtension(input), config, id: mediaId })
}

let mediaBeingCaptured = 0
const captureTimeouts = new Map<string, NodeJS.Timeout>()
const CAPTURE_TIMEOUT = 15000
const maxAmount = 20
const refillMargin = maxAmount * 0.6
async function captureWithCanvas(data: { input: string; output: string; size: ResizeOptions; extension: string; config: Config; id: string }) {
    if (!(await doesPathExistAsync(data.input))) {
        generationFinished(data.id)
        return
    }

    mediaBeingCaptured++

    const timeout = setTimeout(() => {
        mediaBeingCaptured = Math.max(0, mediaBeingCaptured - 1)
        captureTimeouts.delete(data.id)
        failedPaths.push(data.id)
        generationFinished(data.id)
    }, CAPTURE_TIMEOUT)
    captureTimeouts.set(data.id, timeout)

    sendToMain(ToMain.CAPTURE_CANVAS, data)

    // let captureIndex = mediaBeingCaptured
    // console.time("CAPTURING: " + captureIndex + " - " + data.input)

    // generate a max amount at the same time
    if (mediaBeingCaptured > maxAmount) await waitUntilValueIsDefined(() => mediaBeingCaptured < refillMargin)
    // while (mediaBeingCaptured >= maxAmount)

    // console.timeEnd("CAPTURING: " + captureIndex + " - " + data.input)
    // generationFinished(mediaId)
}

let failedPaths: string[] = []
export function saveImage(data: { id?: string; path?: string; base64?: string; buffer?: ArrayBuffer; filePath?: string[]; format?: "png" | "jpg" }) {
    const dataURL = data.base64
    const buffer = data.buffer
    let savePath = data.path || ""

    if (data.id && captureTimeouts.has(data.id)) {
        clearTimeout(captureTimeouts.get(data.id)!)
        captureTimeouts.delete(data.id)
    }

    if (data.filePath?.length) {
        const fileName = data.filePath.pop()!
        const exportFolder = getDataFolderPath("exports")
        const folderPath = path.join(exportFolder, ...data.filePath)
        createFolder(folderPath)
        savePath = path.join(folderPath, fileName)
    } else {
        mediaBeingCaptured = Math.max(0, mediaBeingCaptured - 1)
        if (mediaBeingCaptured === 0) currentlyGenerating.clear()
    }

    if ((!dataURL && !buffer) || !savePath) {
        if (!data.id) return
        failedPaths.push(data.id)
        setTimeout(() => generationFinished(data.id!))
        return
    }
    if (data.id && failedPaths.includes(data.id)) failedPaths.splice(failedPaths.indexOf(data.id), 1)

    const image = buffer ? nativeImage.createFromBuffer(Buffer.from(buffer)) : nativeImage.createFromDataURL(dataURL!)
    saveToDisk(savePath, image, data.format || "png", data.id)
}

export async function pdfToImage({ filePath }: { filePath: string }) {
    console.log("[pdfToImage] Starting PDF conversion for:", filePath)
    const startTime = Date.now()
    const pdfName = path.basename(filePath, path.extname(filePath))
    const pdfImportPath = getDataFolderPath("imports", "PDF")
    const pathName = createFolder(path.join(pdfImportPath, pdfName))

    console.log("[pdfToImage] Requesting thumbnails from API...")
    const { pages: pdfImages }: { pages: string[] } = (await requestToMain(ToMain.API, { action: "get_pdf_thumbnails", data: { path: filePath } })) || { pages: [] }
    console.log("[pdfToImage] Got response in", Date.now() - startTime, "ms, pages:", pdfImages?.length)
    if (!Array.isArray(pdfImages)) {
        console.error("[pdfToImage] ERROR: pdfImages is not an array!", typeof pdfImages, pdfImages)
        return
    }

    const images: string[] = []
    for (let i = 0; i < pdfImages.length; i++) {
        const base64 = pdfImages[i]
        const image = nativeImage.createFromDataURL(base64)
        const imagePath = path.join(pathName, `${i + 1}.jpg`)

        saveToDisk(imagePath, image, "jpg")
        images.push(imagePath)
    }

    if (images.length) sendToMain(ToMain.IMAGES_TO_SHOW, { images, name: pdfName })

    // const loadingTask = getDocument(filePath)
    // const pdfDoc = await loadingTask.promise
    // const pageCount = pdfDoc.numPages

    // let images: string[] = []
    // for (let i = 0; i < pageCount; i++) {
    //     const pdfPage = await pdfDoc.getPage(i + 1)
    //     const operatorList = await pdfPage.getOperatorList()

    //     const imgIndex = operatorList.fnArray.indexOf(OPS.paintImageXObject)
    //     const imgArgs = operatorList.argsArray[imgIndex]
    //     const { data } = pdfPage.objs.get(imgArgs[0])

    //     const imagePath = path.join(pathName, `${i + 1}.jpg`)

    //     // let image = nativeImage.createFromDataURL(data)
    //     let image = nativeImage.createFromBuffer(data)
    //     saveToDisk(imagePath, image, false, "jpg")

    //     images.push(imagePath)
    // }

    // await loadingTask.destroy()

    // return images
}

// https://www.electronjs.org/docs/latest/api/native-image
// function captureImage(input: string, output: string, size: ResizeOptions) {
//     let outputImage = nativeImage.createFromPath(input)
//     outputImage = outputImage.resize(size)

//     saveToDisk(output, outputImage)
// }

function getExtension(filePath: string) {
    return path.extname(filePath).slice(1).toLowerCase()
}

function parseSize(sizeStr: string): ResizeOptions {
    const size: ResizeOptions = {}

    const sizeRegex = /(\d+|\?)x(\d+|\?)/g
    const sizeResult = sizeRegex.exec(sizeStr)
    if (sizeResult) {
        const [, w, h] = sizeResult
        if (w !== "?") size.width = parseInt(w, 10)
        if (h !== "?") size.height = parseInt(h, 10)

        return size
    }

    throw new Error("Invalid size string")
}

/// // SAVE /////

const jpegQuality = 90 // 0-100
function saveToDisk(savePath: string, image: NativeImage, format: "png" | "jpg", id?: string) {
    let img
    if (format === "jpg") img = image.toJPEG(jpegQuality)
    else img = image.toPNG() // higher file size, but supports transparent images

    fs.writeFile(savePath, img, (err) => {
        if (!id) return
        if (err) failedPaths.push(id)
        generationFinished(id)
    })
}

/// // CAPTURE SLIDE /////

export function captureSlide(data: { output: { [key: string]: Output }; resolution: Resolution }): Promise<{ base64: string } | null> {
    return new Promise((resolve) => {
        const outSlide = Object.values(data.output)[0].out?.slide
        const OUTPUT_ID = "capture" + String(outSlide?.id) + String(outSlide?.layout) + String(outSlide?.index)
        if (OutputHelper.getOutput(OUTPUT_ID)) return

        const window = new BrowserWindow({ ...captureOptions, width: data.resolution?.width, height: data.resolution?.height })
        loadWindowContent(window, "output")

        OutputHelper.setOutput(OUTPUT_ID, { window })

        window.on("ready-to-show", () => {
            // send correct output data after load
            setTimeout(() => {
                if (window.isDestroyed()) return resolve(null)

                window.webContents.send(OUTPUT, { channel: "OUTPUTS", data: data.output })
                // WIP mute videos

                // wait for content load
                setTimeout(async () => {
                    if (window.isDestroyed()) return resolve(null)

                    const page = await window.capturePage()
                    const base64 = page.toDataURL({ scaleFactor: 1 })
                    resolve({ base64 })

                    window.destroy()
                    OutputHelper.deleteOutput(OUTPUT_ID)
                }, 3000)
            }, 3000)
        })
    })
}
