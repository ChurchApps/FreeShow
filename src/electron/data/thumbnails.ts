import type { NativeImage, ResizeOptions } from "electron"
import { app, BrowserWindow, nativeImage } from "electron"
import fs from "fs"
import path from "path"
import { isProd, loadWindowContent } from ".."
import { OUTPUT } from "../../types/Channels"
import { ToMain } from "../../types/IPC/ToMain"
import type { Output } from "../../types/Output"
import type { Resolution } from "../../types/Settings"
import { requestToMain, sendToMain } from "../IPC/main"
import { OutputHelper } from "../output/OutputHelper"
import { createFolder, deleteFile, doesPathExist, doesPathExistAsync, getDataFolderPath, getFileStatsAsync, makeDir } from "../utils/files"
import { appDataPath } from "./store"
import { waitUntilValueIsDefined } from "../utils/helpers"
import { captureOptions } from "../utils/windowOptions"
import { imageExtensions, videoExtensions } from "./media"

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

export function getThumbnail(data: { input: string; size: number }) {
    const output = createThumbnail(data.input, data.size || 500)

    return { ...data, output }
}

export function createThumbnail(filePath: string, size = 250) {
    if (!filePath) return ""

    const outputPath = getThumbnailPath(filePath, size)

    addToGenerateQueue({ input: filePath, output: outputPath, size })

    return outputPath
}

type Thumbnail = { input: string; output: string; size: number }
const thumbnailQueue: Thumbnail[] = []
function addToGenerateQueue(data: Thumbnail) {
    thumbnailQueue.push(data)
    nextInQueue()
}

let working = false
function nextInQueue() {
    if (working || !thumbnailQueue[0]) return
    // if (!thumbnailQueue[0]) return removeCaptureWindow()

    working = true
    generateThumbnail(thumbnailQueue.shift()!)
}

function generationFinished() {
    working = false
    nextInQueue()
}

const exists: string[] = []
async function generateThumbnail(data: Thumbnail) {
    if (![...imageExtensions, ...videoExtensions].includes(getExtension(data.input))) return generationFinished()
    if (isProd && exists.includes(data.output)) return generationFinished()
    if (await doesPathExistAsync(data.output)) {
        exists.push(data.output)
        generationFinished()
        return
    }

    try {
        await generate(data.input, data.output, String(data.size) + "x?", { seek: 0.5 })
    } catch (err) {
        console.error(err)
        generationFinished()
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
async function generate(input: string, output: string, size: string, config: Config = {}) {
    if (!input || !output) {
        generationFinished()
        return
    }

    const parsedSize = parseSize(size)
    // let extension = getExtension(input)

    // capture images directly from electron nativeImage (fastest)
    // WIP this was unreliable
    // if (!customImageCapture.includes(extension) && defaultSettings.imageExtensions.includes(extension)) return captureImage(input, output, parsedSize)

    // capture other media with canvas in main window
    await captureWithCanvas({ input, output, size: parsedSize, extension: getExtension(input), config })
}

let mediaBeingCaptured = 0
const maxAmount = 20
const refillMargin = maxAmount * 0.6
async function captureWithCanvas(data: { input: string; output: string; size: ResizeOptions; extension: string; config: Config }) {
    if (!(await doesPathExistAsync(data.input))) {
        generationFinished()
        return
    }

    mediaBeingCaptured++
    sendToMain(ToMain.CAPTURE_CANVAS, data)

    // let captureIndex = mediaBeingCaptured
    // console.time("CAPTURING: " + captureIndex + " - " + data.input)

    // generate a max amount at the same time
    if (mediaBeingCaptured > maxAmount) await waitUntilValueIsDefined(() => mediaBeingCaptured < refillMargin)

    // console.timeEnd("CAPTURING: " + captureIndex + " - " + data.input)
    generationFinished()
}

export function saveImage(data: { path?: string; base64?: string; filePath?: string[]; format?: "png" | "jpg" }) {
    const dataURL = data.base64
    let savePath = data.path || ""

    if (data.filePath?.length) {
        const fileName = data.filePath.pop()!
        const exportFolder = getDataFolderPath("exports")
        const folderPath = path.join(exportFolder, ...data.filePath)
        createFolder(folderPath)
        savePath = path.join(folderPath, fileName)
    } else {
        mediaBeingCaptured = Math.max(0, mediaBeingCaptured - 1)
    }

    if (!dataURL || !savePath) return

    const image = nativeImage.createFromDataURL(dataURL)
    saveToDisk(savePath, image, false, data.format || "png")
}

export async function pdfToImage({ filePath }: { filePath: string }) {
    const pdfName = path.basename(filePath, path.extname(filePath))
    const pdfImportPath = getDataFolderPath("imports", "PDF")
    const pathName = createFolder(path.join(pdfImportPath, pdfName))

    const { pages: pdfImages }: { pages: string[] } = (await requestToMain(ToMain.API, { action: "get_pdf_thumbnails", data: { path: filePath } })) || { pages: [] }
    if (!Array.isArray(pdfImages)) return

    const images: string[] = []
    for (let i = 0; i < pdfImages.length; i++) {
        const base64 = pdfImages[i]
        const image = nativeImage.createFromDataURL(base64)
        const imagePath = path.join(pathName, `${i + 1}.jpg`)

        saveToDisk(imagePath, image, false, "jpg")
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
        const sizeValues = sizeResult.map((x) => (x === "?" ? null : Number.parseInt(x, 10)))

        if (sizeValues[1]) size.width = sizeValues[1] || 0
        if (sizeValues[2]) size.height = sizeValues[2] || 0

        return size
    }

    throw new Error("Invalid size string")
}

/// // SAVE /////

const jpegQuality = 90 // 0-100
function saveToDisk(savePath: string, image: NativeImage, nextOnFinished = true, format: "png" | "jpg") {
    let img
    if (format === "jpg") img = image.toJPEG(jpegQuality)
    else img = image.toPNG() // higher file size, but supports transparent images

    fs.writeFile(savePath, img, (err) => {
        if (!err) exists.push(savePath)
        if (nextOnFinished) generationFinished()
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
