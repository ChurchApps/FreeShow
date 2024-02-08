import type { BrowserWindow, Display, NativeImage, Size } from "electron"
import electron from "electron"
import os from "os"
import { toApp } from ".."
import { OUTPUT, OUTPUT_STREAM } from "../../types/Channels"
import { toServer } from "../servers"
import { outputWindows, sendToStageOutputs } from "../utils/output"
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

function getDefaultCapture(window: BrowserWindow): CaptureOptions {
    let screen: Display = getWindowScreen(window)
    let defaultFramerates = {
        preview: framerates.preview,
        server: framerates.server,
        ndi: framerates.connected,
    }

    return {
        window,
        subscribed: false,
        displayFrequency: screen.displayFrequency || 60,
        options: { server: false, ndi: false },
        framerates: defaultFramerates,
        framesToSkip: {},
    }
}

// START

let storedFrames: any = {}
export function startCapture(id: string, toggle: any = {}, rate: any = {}) {
    let window = outputWindows[id]
    let windowIsRemoved = !window || window.isDestroyed()
    if (windowIsRemoved) {
        delete captures[id]
        return
    }

    if (!captures[id]) captures[id] = getDefaultCapture(window)

    Object.keys(toggle).map((key) => {
        captures[id].options[key] = toggle[key]
    })

    updateFramerate(id)

    if (captures[id].subscribed) return

    console.log("Capture - starting: " + id)

    if (rate !== "optimized") captures[id].window.webContents.beginFrameSubscription(false, processFrame)
    captures[id].subscribed = true

    // optimize cpu on low end devices
    const autoOptimizePercentageCPU = 95 / 10 // % / 10
    const captureAmount = 50
    let captureCount = captureAmount

    if (rate !== "full" && (rate === "optimized" || !captures[id].options.ndi)) cpuCapture()

    async function cpuCapture() {
        if (!captures[id] || captures[id].window.isDestroyed()) return

        let usage = process.getCPUUsage()

        let isOptimizedOrLagging = rate === "optimized" || usage.percentCPUUsage > autoOptimizePercentageCPU || captureCount < captureAmount
        if (isOptimizedOrLagging) {
            if (captureCount > captureAmount) captureCount = 0
            // limit frames
            if (captures[id].window.webContents.isBeingCaptured()) captures[id].window.webContents.endFrameSubscription()
            let image = await captures[id].window.webContents.capturePage()
            sendFrames(id, image, { previewFrame: true, serverFrame: true, ndiFrame: true })

            // capture for 60 seconds then get cpu again
            captureCount++
            setTimeout(cpuCapture, rate === "optimized" ? 300 : 100)
        } else {
            captureCount = captureAmount
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

        if (checkRate("max")) return sendFrame()

        sendFrames(id, image, { previewFrame, serverFrame, ndiFrame })
    }

    function sendFrame() {
        let imageIndex = ++currentImage
        clearTimeout(timeout)
        timeout = setTimeout(timeoutEnded, 80)

        function timeoutEnded() {
            if (imageIndex !== currentImage) return

            // update if last skipped frame is not a sent frame
            sendFrames(id, storedFrames[id], { previewFrame: true, serverFrame: true, ndiFrame: true })
            currentImage = 0
        }
    }

    function checkRate(key: string) {
        if (currentFrames[key]++ < captures[id].framesToSkip[key]) return true
        currentFrames[key] = 0
        return false
    }
}

function sendFrames(id: string, image: NativeImage, rates: any) {
    if (!captures[id] || !image) return

    const size = image.getSize()

    if (rates.previewFrame) sendBufferToPreview(id, image, { size })
    if (rates.serverFrame && captures[id].options.server) sendBufferToServer(id, image)
    if (rates.ndiFrame && captures[id].options.ndi) sendBufferToNdi(id, image, { size })
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

// NDI

function sendBufferToNdi(id: string, image: NativeImage, { size }: any) {
    const buffer = image.getBitmap()
    const ratio = image.getAspectRatio()

    // WIP refresh on enable?
    sendVideoBufferNDI(id, buffer, { size, ratio, framerate: captures[id].framerates.ndi })
}

// PREVIEW

let previewSize: Size = { width: 320, height: 180 }
function sendBufferToPreview(id: string, image: NativeImage, options: any) {
    if (!image) return

    image = resizeImage(image, options.size, previewSize)

    const buffer = image.getBitmap()
    const size = image.getSize()

    /*  convert from ARGB/BGRA (Electron/Chromium capture output) to RGBA (Web canvas)  */
    if (os.endianness() === "BE") util.ImageBufferAdjustment.ARGBtoRGBA(buffer)
    else util.ImageBufferAdjustment.BGRAtoRGBA(buffer)

    let msg = { channel: "PREVIEW", data: { id, buffer, size, originalSize: options.size } }
    toApp(OUTPUT, msg)
    sendToStageOutputs(msg)
}

export function updatePreviewResolution(data: any) {
    previewSize = data.size

    if (data.id) sendFrames(data.id, storedFrames[data.id], { previewFrame: true })
}

export function resizeImage(image: NativeImage, initialSize: Size, newSize: Size) {
    if (initialSize.width / initialSize.height >= newSize.width / newSize.height) image = image.resize({ width: newSize.width })
    else image = image.resize({ height: newSize.height })

    return image
}

// SERVER

// const outputServerSize: Size = { width: 1280, height: 720 }
function sendBufferToServer(id: string, image: NativeImage) {
    if (!image) return

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
    return new Promise((resolve) => {
        if (!captures[id]) return resolve(true)

        let windowIsRemoved = !captures[id].window || captures[id].window.isDestroyed()
        if (windowIsRemoved) return deleteAndResolve()

        console.log("Capture - stopping: " + id)

        endSubscription()
        removeListeners()
        deleteAndResolve()

        function deleteAndResolve() {
            delete captures[id]
            resolve(true)
        }
    })

    function endSubscription() {
        if (!captures[id].subscribed) return

        captures[id].window.webContents.endFrameSubscription()
        captures[id].subscribed = false
    }

    function removeListeners() {
        captures[id].window.removeAllListeners()
        captures[id].window.webContents.removeAllListeners()
    }
}
