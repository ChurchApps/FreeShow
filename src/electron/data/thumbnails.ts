import { NativeImage, ResizeOptions, app, nativeImage } from "electron"
import fs from "fs"
import path from "path"
import { isProd, toApp } from ".."
import { MAIN } from "../../types/Channels"
import { doesPathExist } from "../utils/files"
import { waitUntilValueIsDefined } from "../utils/helpers"
import { defaultSettings } from "./defaults"

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

let exists: string[] = []
async function generateThumbnail(data: Thumbnail) {
    if (isProd && exists.includes(data.output)) return generationFinished()
    if (doesPathExist(data.output)) {
        exists.push(data.output)
        generationFinished()
        return
    }

    try {
        await generate(data.input, data.output, data.size + "x?", { seek: 0.5 })
    } catch (err) {
        console.error(err)
        generationFinished()
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

///// CUSTOM WINDOW /////

// const JS_IMAGE = 'document.querySelector("img")'
// const JS_IMAGE_LOADED = JS_IMAGE + "?.complete"
// const JS_IMAGE_WIDTH = JS_IMAGE + ".naturalWidth"
// const JS_IMAGE_HEIGHT = JS_IMAGE + ".naturalHeight"

// const JS_VIDEO = 'document.querySelector("video")'
// const JS_VIDEO_READY = JS_VIDEO + "?.readyState"
// const JS_GET_DURATION = JS_VIDEO + ".duration"
// const JS_PAUSE_VIDEO = JS_VIDEO + ".pause()"
// const JS_REMOVE_CONTROLS = JS_VIDEO + '.removeAttribute("controls")'
// const JS_SET_TIME = JS_VIDEO + ".currentTime="
// const JS_VIDEO_WIDTH = JS_VIDEO + ".videoWidth"
// const JS_VIDEO_HEIGHT = JS_VIDEO + ".videoHeight"

// let captureWindow: BrowserWindow | null = null
// async function createCaptureWindow(data: any) {
//     if (!captureWindow) captureWindow = new BrowserWindow(captureOptions)

//     captureWindow?.loadFile(data.input)

//     // wait until loaded
//     let contentLoaded: boolean = false
//     captureWindow?.once("ready-to-show", () => {
//         contentLoaded = true
//     })
//     await waitUntilValueIsDefined(() => contentLoaded, 20, 1000)
//     if (!contentLoaded) return exit()

//     let extension = getExtension(data.input)
//     if (customImageCapture.includes(extension)) return checkImage()

//     let videoLoaded: any = await waitUntilValueIsDefined(checkIfVideoHasLoaded, 20, 2000)
//     if (!videoLoaded) {
//         // probably unsupported codec
//         if (extension === "mp4") return exit()
//         return checkImage()
//     }

//     let videoDuration = await captureWindow?.webContents.executeJavaScript(JS_GET_DURATION)
//     if (!videoDuration) return exit()

//     let seekTo = Math.floor(videoDuration) * (data.seek ?? 0.5)

//     captureWindow?.webContents.executeJavaScript(JS_PAUSE_VIDEO)
//     captureWindow?.webContents.executeJavaScript(JS_REMOVE_CONTROLS)
//     captureWindow?.webContents.executeJavaScript(JS_SET_TIME + seekTo)

//     // check if video seek has loaded properly
//     await waitUntilValueIsDefined(checkIfVideoHasLoaded, 20)

//     let videoWidth = await captureWindow?.webContents.executeJavaScript(JS_VIDEO_WIDTH)
//     let videoHeight = await captureWindow?.webContents.executeJavaScript(JS_VIDEO_HEIGHT)

//     await setWindowSize(videoWidth, videoHeight)

//     captureContent()

//     async function checkImage() {
//         let hasLoaded: any = await waitUntilValueIsDefined(checkIfImageHasLoaded, 20, 2000)
//         if (!hasLoaded) return exit()

//         let imageWidth = await captureWindow?.webContents.executeJavaScript(JS_IMAGE_WIDTH)
//         let imageHeight = await captureWindow?.webContents.executeJavaScript(JS_IMAGE_HEIGHT)

//         await setWindowSize(imageWidth, imageHeight)

//         captureContent()
//         return
//     }

//     async function setWindowSize(contentWidth: number, contentHeight: number) {
//         if (!contentWidth) contentWidth = 1920
//         if (!contentHeight) contentHeight = 1080

//         const ratio = contentWidth / contentHeight
//         let width = data.size?.width
//         let height = data.size?.height
//         if (!width) width = height ? Math.floor(height * ratio) : contentWidth
//         if (!height) height = data.size?.width ? Math.floor(width / ratio) : contentHeight

//         captureWindow?.setSize(width, height)

//         // wait for window and content to get resized
//         await wait(50)
//     }

//     async function checkIfImageHasLoaded() {
//         let imageComplete = await captureWindow?.webContents.executeJavaScript(JS_IMAGE_LOADED)
//         return imageComplete
//     }

//     async function checkIfVideoHasLoaded() {
//         let readyState = await captureWindow?.webContents.executeJavaScript(JS_VIDEO_READY)
//         return readyState === 4
//     }

//     async function captureContent() {
//         let image = await captureWindow?.webContents.capturePage()
//         if (!image) return exit()

//         removeCaptureWindow()
//         saveToDisk(data.output, image)
//     }

//     function exit() {
//         generationFinished()
//     }
// }
// function removeCaptureWindow() {
//     if (!captureWindow) return
//     if (captureWindow.isDestroyed()) {
//         captureWindow = null
//         return
//     }

//     captureWindow.on("closed", () => (captureWindow = null))
//     captureWindow.destroy()
// }

///// GENERATE /////

interface Config {
    seek?: number // 0-1
    // format?: "jpg" | "jpeg" | "png"
    // quality?: number // 0-100
}
const customImageCapture = ["gif", "webp"]
async function generate(input: string, output: string, size: string, config: Config = {}) {
    if (!input || !output) {
        generationFinished()
        return
    }

    const parsedSize = parseSize(size)
    let extension = getExtension(input)

    // // mov files can't be opened directly, but can be played as video elem
    // if (extension === "mov") return captureWithCanvas({ input, output, size: parsedSize, config })
    // // capture images directly from electron nativeImage (fastest)
    // if (!customImageCapture.includes(extension) && defaultSettings.imageExtensions.includes(extension)) return captureImage(input, output, parsedSize)
    // // capture videos in custom window (to reduce load on main window)
    // createCaptureWindow({ input, output, size: parsedSize, config }) // WIP this would many times create a save dialog window in some cases

    // capture images directly from electron nativeImage (fastest)
    if (!customImageCapture.includes(extension) && defaultSettings.imageExtensions.includes(extension)) return captureImage(input, output, parsedSize)

    // capture other media with canvas in main window
    await captureWithCanvas({ input, output, size: parsedSize, extension: getExtension(input), config })
}

let mediaBeingCaptured: number = 0
const maxAmount = 30
const refillMargin = maxAmount * 0.6
async function captureWithCanvas(data: any) {
    mediaBeingCaptured++
    toApp(MAIN, { channel: "CAPTURE_CANVAS", data })

    // generate a max amount at the same time
    if (mediaBeingCaptured > maxAmount) await waitUntilValueIsDefined(() => mediaBeingCaptured < refillMargin)

    generationFinished()
}

export function saveImage(data: any) {
    mediaBeingCaptured--
    if (!data.base64) return

    let dataURL = data.base64
    let image = nativeImage.createFromDataURL(dataURL)
    saveToDisk(data.path, image, false)
}

// https://www.electronjs.org/docs/latest/api/native-image
function captureImage(input: string, output: string, size: ResizeOptions) {
    let outputImage = nativeImage.createFromPath(input)
    outputImage = outputImage.resize(size)

    saveToDisk(output, outputImage)
}

function getExtension(filePath: string) {
    return path.extname(filePath).slice(1).toLowerCase()
}

function parseSize(sizeStr: string): ResizeOptions {
    const size: ResizeOptions = {}

    const sizeRegex = /(\d+|\?)x(\d+|\?)/g
    const sizeResult = sizeRegex.exec(sizeStr)
    if (sizeResult) {
        const sizeValues = sizeResult.map((x) => (x === "?" ? null : Number.parseInt(x)))

        if (sizeValues[1]) size.width = sizeValues[1] || 0
        if (sizeValues[2]) size.height = sizeValues[2] || 0

        return size
    }

    throw new Error("Invalid size string")
}

///// SAVE /////

const jpegQuality = 90 // 0-100
function saveToDisk(savePath: string, image: NativeImage, nextOnFinished: boolean = true) {
    let jpgImage = image.toJPEG(jpegQuality)
    fs.writeFile(savePath, jpgImage, () => {
        exists.push(savePath)
        if (nextOnFinished) generationFinished()
    })
}
