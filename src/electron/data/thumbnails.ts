import { BrowserWindow, NativeImage, ResizeOptions, app, nativeImage } from "electron"
import fs from "fs"
import path from "path"
import { doesPathExist } from "../utils/files"
import { captureOptions } from "./../utils/windowOptions"
import { defaultSettings } from "./defaults"
import { waitUntilValueIsDefined } from "../utils/helpers"

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
    if (working) return
    if (!thumbnailQueue[0]) return removeCaptureWindow()

    working = true
    generateThumbnail(thumbnailQueue.shift()!)
}

function generationFinished() {
    working = false
    nextInQueue()
}

let exists: string[] = []
async function generateThumbnail(data: Thumbnail) {
    if (exists.includes(data.output) || doesPathExist(data.output)) {
        exists.push(data.output)
        generationFinished()
        return
    }

    try {
        // seek might not work if video is shorter than 3 seconds (but original video will then get rendered instead of thumbnail)
        await generate(data.input, data.output, data.size + "x?", { seek: 0.5 })
        exists.push(data.output)
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

const JS_VIDEO = 'document.querySelector("video")'
const JS_GET_READY = JS_VIDEO + "?.readyState"
const JS_GET_DURATION = JS_VIDEO + ".duration"
const JS_PAUSE_VIDEO = JS_VIDEO + ".pause()"
const JS_REMOVE_CONTROLS = JS_VIDEO + '.removeAttribute("controls")'
const JS_SET_TIME = JS_VIDEO + ".currentTime="

let captureWindow: BrowserWindow | null = null
async function createCaptureWindow(data: any) {
    const ratio = 1.778 // 16 / 9
    let width = data.size.width
    let height = data.size.height
    if (!width) width = height ? Math.floor(height * ratio) : 1920
    if (!height) height = Math.floor(width / ratio)

    if (!captureWindow) {
        console.log(data.size, width, height)
        captureWindow = new BrowserWindow({ ...captureOptions, width, height })
        captureWindow.loadFile(data.input)

        let hasLoaded: boolean = false
        captureWindow?.once("ready-to-show", () => {
            hasLoaded = true
        })

        await waitUntilValueIsDefined(() => hasLoaded)
    } else {
        captureWindow.setSize(width, height)
        captureWindow.loadFile(data.input)
    }

    let hasLoaded: any = await waitUntilValueIsDefined(checkIfVideoHasLoaded, 20)
    if (!hasLoaded) return exit()

    let videoDuration = await captureWindow?.webContents.executeJavaScript(JS_GET_DURATION)
    console.log("DURATION", videoDuration)
    if (!videoDuration) return exit()

    let seekTo = Math.floor(videoDuration) * (data.seek ?? 0.5)

    captureWindow?.webContents.executeJavaScript(JS_PAUSE_VIDEO)
    captureWindow?.webContents.executeJavaScript(JS_REMOVE_CONTROLS)
    captureWindow?.webContents.executeJavaScript(JS_SET_TIME + seekTo)

    // TODO: get video aspect ratio and set window size based on that

    // check if video seek has loaded properly
    await waitUntilValueIsDefined(checkIfVideoHasLoaded, 20)

    captureContent()

    async function checkIfVideoHasLoaded() {
        let readyState = await captureWindow?.webContents.executeJavaScript(JS_GET_READY)
        return readyState === 4
    }

    async function captureContent() {
        let image = await captureWindow?.webContents.capturePage()
        if (!image) return exit()

        removeCaptureWindow()
        saveToDisk(data.output, image)
    }

    function exit() {
        // removeCaptureWindow()
        generationFinished()
    }
}
function removeCaptureWindow() {
    if (!captureWindow) return
    if (captureWindow.isDestroyed()) {
        captureWindow = null
        return
    }

    captureWindow.on("closed", () => (captureWindow = null))
    captureWindow.destroy()
}

///// GENERATE /////

interface Config {
    seek?: number // 0-1
    // format?: "jpg" | "jpeg" | "png"
    // quality?: number // 0-100
}
async function generate(input: string, output: string, size: string, config: Config = {}) {
    if (!input || !output) {
        generationFinished()
        return
    }

    const parsedSize = parseSize(size)

    let extension = path.extname(input).slice(1)
    if (defaultSettings.imageExtensions.includes(extension)) return captureImage(input, output, parsedSize)

    createCaptureWindow({ input, output, size: parsedSize, config })
}

// https://www.electronjs.org/docs/latest/api/native-image
function captureImage(input: string, output: string, size: ResizeOptions) {
    // TODO: capture images! (only works for first one for some reason..)

    let outputImage = nativeImage.createFromPath(input)

    outputImage.resize(size)

    // save outputImage
    console.log(outputImage)
    console.log("OUTPUT PATH", output)
    saveToDisk(output, outputImage)
}

function parseSize(sizeStr: string): ResizeOptions {
    const size: ResizeOptions = {}

    // const percentRegex = /(\d+)%/g
    // const percentResult = percentRegex.exec(sizeStr)
    // if (percentResult) {
    //     let percentage = Number.parseInt(percentResult[1])

    //     size.width = 0
    //     size.height = 0

    //     return size
    // }

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
function saveToDisk(savePath: string, image: NativeImage) {
    let jpgImage = image.toJPEG(jpegQuality)
    fs.writeFile(savePath, jpgImage, () => {
        generationFinished()
    })
}
