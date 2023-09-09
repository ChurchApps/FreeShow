import type { BrowserWindow, NativeImage, Size } from "electron"
import electron from "electron"
import os from "os"
import { toApp } from ".."
import { OUTPUT, OUTPUT_STREAM } from "../../types/Channels"
import { toServer } from "../servers"
import { outputWindows } from "../utils/output"
import { NDI, sendVideoBufferNDI } from "./ndi"
import util from "./vingester-util"

type CaptureOptions = {
    window: BrowserWindow
    subscribed: boolean
    displayFrequency: number
    options: any
    framerates: any
    framesToSkip: any
}

export let captures: { [key: string]: CaptureOptions } = {}

export const framerates: any = {
    preview: 20,
    server: 20,
    unconnected: 1,
    connected: 30,
}
export let customFramerates: any = {}

// START

let storedFrames: any = {}
let cpuInterval: any = null
export function startCapture(id: string, toggle: any = {}, rate: any = {}) {
    let window = outputWindows[id]
    if (!window || window.isDestroyed()) {
        delete captures[id]
        return
    }

    if (!captures[id]) {
        let screen = getWindowScreen(window)

        captures[id] = {
            window,
            subscribed: false,
            displayFrequency: screen.displayFrequency || 60,
            options: { server: false, ndi: false },
            framerates: {
                preview: framerates.preview,
                server: framerates.server,
                ndi: framerates.connected,
            },
            framesToSkip: {},
        }
    }

    Object.keys(toggle).map((key) => {
        captures[id].options[key] = toggle[key]
    })

    updateFramerate(id)

    if (captures[id].subscribed) return

    console.log("Capture - starting: " + id)
    captures[id].window.webContents.beginFrameSubscription(false, processFrame)
    captures[id].subscribed = true

    // optimize cpu on low end devices
    if (cpuInterval) clearInterval(cpuInterval)
    let captureCount = 20
    if (rate !== "full") cpuInterval = setInterval(cpuCapture, 3000)
    async function cpuCapture() {
        if (!captures[id] || captures[id].window.isDestroyed() || captures[id].window.webContents.isBeingCaptured()) return

        let usage = process.getCPUUsage()

        if (rate === "optimized" || usage.percentCPUUsage > 9.5 || captureCount < 10) {
            if (captureCount === 20) captureCount = 0
            // limit frames
            captures[id].window.webContents.endFrameSubscription()
            let image = await captures[id].window.webContents.capturePage()
            processFrame(image)

            // capture for 60 seconds then get cpu again
            captureCount++
        } else {
            captureCount = 20
            captures[id].window.webContents.beginFrameSubscription(false, processFrame)
        }
    }

    let currentFrames: any = JSON.parse(JSON.stringify(captures[id].framesToSkip))
    let currentImage: number = 0
    let timeout: any = null
    function processFrame(image: NativeImage) {
        storedFrames[id] = image

        let previewFrame = !checkRate("preview")
        let serverFrame = !checkRate("server")
        let ndiFrame = !checkRate("ndi")

        if (checkRate("max")) {
            let imageIndex = ++currentImage
            clearTimeout(timeout)

            timeout = setTimeout(() => {
                if (imageIndex !== currentImage) return

                // update if last skipped frame is not a sent frame
                sendFrames(id, storedFrames[id], { previewFrame: true, serverFrame: true, ndiFrame: true })
                currentImage = 0
            }, 80)

            return
        }

        sendFrames(id, image, { previewFrame, serverFrame, ndiFrame })
    }

    function checkRate(key: string) {
        if (currentFrames[key]++ < captures[id].framesToSkip[key]) return true
        currentFrames[key] = 0
        return false
    }
}

function sendFrames(id: string, image: NativeImage, rates: any) {
    if (!captures[id]) return

    const size = image.getSize()

    if (rates.previewFrame) sendBufferToPreview(id, image, { size })

    if (rates.serverFrame && captures[id].options.server) sendBufferToServer(id, image)

    if (rates.ndiFrame && captures[id].options.ndi) {
        const buffer = image.getBitmap()
        const ratio = image.getAspectRatio()

        // WIP refresh on enable?
        sendVideoBufferNDI(id, buffer, { size, ratio, framerate: captures[id].framerates.ndi })
    }
}

export function updateFramerate(id: string) {
    if (!captures[id]) return

    if (NDI[id]) {
        let ndiFramerate = framerates.unconnected
        if (NDI[id].status === "connected") ndiFramerate = customFramerates[id]?.ndi || framerates.connected

        captures[id].framerates.ndi = parseInt(ndiFramerate)
    }

    // highest framerate
    let allRates = [captures[id].framerates.preview]
    if (captures[id].options.ndi) allRates.push(captures[id].framerates.ndi)
    if (captures[id].options.server) allRates.push(captures[id].framerates.server)
    let highestFramerate = Math.max(...allRates)

    captures[id].framesToSkip = {
        max: getFramesToSkip(captures[id].displayFrequency, highestFramerate),
        preview: getFramesToSkip(captures[id].displayFrequency, captures[id].framerates.preview),
        server: getFramesToSkip(captures[id].displayFrequency, captures[id].framerates.server),
        ndi: getFramesToSkip(captures[id].displayFrequency, captures[id].framerates.ndi),
    }
}

function getFramesToSkip(initialFramerate: number, newFramerate: number) {
    return newFramerate ? Math.trunc(initialFramerate / newFramerate - 1) : 0
}

function getWindowScreen(window: BrowserWindow) {
    return electron.screen.getDisplayMatching({
        x: window.getBounds().x,
        y: window.getBounds().y,
        width: window.getBounds().width,
        height: window.getBounds().height,
    })
}

// PREVIEW

let previewSize: Size = { width: 320, height: 180 }
function sendBufferToPreview(id: string, image: NativeImage, options: any) {
    image = resizeImage(image, options.size, previewSize)

    const buffer = image.getBitmap()
    const size = image.getSize()

    /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
    if (os.endianness() === "BE") util.ImageBufferAdjustment.ARGBtoRGBA(buffer)
    else util.ImageBufferAdjustment.BGRAtoRGBA(buffer)

    toApp(OUTPUT, { channel: "PREVIEW", data: { id, buffer, size, originalSize: options.size } })
}

export function updatePreviewResolution(data: any) {
    previewSize = data.size

    if (data.id) sendFrames(data.id, storedFrames[data.id], { previewFrame: true })
}

function resizeImage(image: NativeImage, initialSize: Size, newSize: Size) {
    if (initialSize.width / initialSize.height >= newSize.width / newSize.height) image = image.resize({ width: newSize.width })
    else image = image.resize({ height: newSize.height })

    return image
}

// SERVER

// const outputServerSize: Size = { width: 1280, height: 720 }
function sendBufferToServer(id: string, image: NativeImage) {
    // send output image size
    // image = resizeImage(image, options.size, outputServerSize)

    const buffer = image.getBitmap()
    const size = image.getSize()

    /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
    if (os.endianness() === "BE") util.ImageBufferAdjustment.ARGBtoRGBA(buffer)
    else util.ImageBufferAdjustment.BGRAtoRGBA(buffer)

    toServer(OUTPUT_STREAM, { channel: "STREAM", data: { id, buffer, size } })
}

// STOP

export function stopAllCaptures() {
    Object.keys(captures).forEach(stopCapture)
}

export function stopCapture(id: string) {
    if (!captures[id]) return

    if (!captures[id].window || captures[id].window.isDestroyed()) {
        delete captures[id]
        return
    }

    console.log("Capture - stopping: " + id)

    if (captures[id].subscribed) {
        captures[id].window.webContents.endFrameSubscription()
        captures[id].subscribed = false
    }

    captures[id].window.removeAllListeners()
    captures[id].window.webContents.removeAllListeners()

    delete captures[id]
}
