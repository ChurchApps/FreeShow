import type { BrowserWindow, Display, NativeImage, Size } from "electron"
import electron from "electron"
import { outputWindows } from "./output"
import { NdiSender } from "../ndi/NdiSender"
import { CaptureTransmitter } from "./CaptureTransmitter"

export type CaptureOptions = {
    id: string
    window: BrowserWindow
    subscribed: boolean
    displayFrequency: number
    options: any
    framerates: any
    frameTiming: any
}

export let captures: { [key: string]: CaptureOptions } = {}

export const framerates: any = {
    preview: 30,
    server: 30,
    unconnected: 1,
    connected: 30,
}
export let customFramerates: any = {}

function getDefaultCapture(window: BrowserWindow, id:string): CaptureOptions {
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
        frameTiming: {},
        id
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

    

    if (!captures[id]) captures[id] = getDefaultCapture(window, id)

    Object.keys(toggle).map((key) => {
        captures[id].options[key] = toggle[key]
    })

    updateFramerate(id)

    if (captures[id].subscribed) return

    //ENABLE TO TRACK NDI FRAME RATES
    /*
    console.log("SETTING INTERVAL");
    setInterval(() => {
        console.log("NDI FRAMES:", CaptureTransmitter.ndiFrameCount, " - ", id);
        CaptureTransmitter.ndiFrameCount = 0
    },1000);
    */

    framerates.preview = rate === "full" ? 60 : 30
    if (rate !== "optimized") captures[id].window.webContents.beginFrameSubscription(true, processFrame)
    captures[id].subscribed = true

    // optimize cpu on low end devices
    const autoOptimizePercentageCPU = 95 / 10 // % / 10
    const captureAmount = 4 * 60
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
            CaptureTransmitter.sendFrames(captures[id], image, { previewFrame: true, serverFrame: true, ndiFrame: true })

            // capture for 60 seconds then get cpu again
            captureCount++
            setTimeout(cpuCapture, rate === "optimized" ? 2000 : 250)
        } else {
            captureCount = captureAmount
            if (!captures[id].window.webContents.isBeingCaptured()) captures[id].window.webContents.beginFrameSubscription(true, processFrame)
        }
    }

    let currentImage: number = 0
    let timeout: any = null

    //this is firing 6-7 times per second when not "dirty". It's 12-15 allowing dirty on beginFrameSubscription
    //Upping NDI framerate to 60 gets 25 NDI frames per second.  I think the browser capture is slowing us down.
    function processFrame(image: NativeImage) {
        
        storedFrames[id] = image

        let previewFrame = !checkRate("preview")
        let serverFrame = !checkRate("server")
        let ndiFrame = !checkRate("ndi")

        //console.log("SKIP NDI FRAME?", !ndiFrame);
        ndiFrame = true;

        if (checkRate("max")) return sendFrame()

        //if (id.toString()=="16f5e84cf0a") console.log("NDI FRAME?", ndiFrame)
        CaptureTransmitter.sendFrames(captures[id], image, { previewFrame, serverFrame, ndiFrame })
    }

    function sendFrame() {
        let imageIndex = ++currentImage
        clearTimeout(timeout)
        timeout = setTimeout(timeoutEnded, 80)

        function timeoutEnded() {
            if (imageIndex !== currentImage) return

            // update if last skipped frame is not a sent frame
            CaptureTransmitter.sendFrames(captures[id], storedFrames[id], { previewFrame: true, serverFrame: true, ndiFrame: true })
            currentImage = 0
        }
    }

    function checkRate(key: string) {
        const lastFrame = captures[id].frameTiming[key].lastFrame
        const minMS = captures[id].frameTiming[key].minMS
        const now = new Date().getTime()
        if (now - lastFrame < minMS) {
            captures[id].frameTiming[key].lastFrame = now
            return true
        }
        return false
    }
}

export function updateFramerate(id: string) {
    if (!captures[id]) return

    if (NdiSender.NDI[id]) {
        let ndiFramerate = framerates.unconnected
        if (NdiSender.NDI[id].status === "connected") ndiFramerate = customFramerates[id]?.ndi || framerates.connected

        captures[id].framerates.ndi = parseInt(ndiFramerate)
    }

    // highest framerate
    let allRates = [captures[id].framerates.preview]
    if (captures[id].options.ndi) allRates.push(captures[id].framerates.ndi)
    if (captures[id].options.server) allRates.push(captures[id].framerates.server)
    let highestFramerate = Math.max(...allRates)

    console.log("Display Frequency", captures[id].displayFrequency)
    captures[id].frameTiming = {
        max: { lastFrame: new Date().getTime(), minMS: getMinMilliseconds(highestFramerate) },
        preview: { lastFrame: new Date().getTime(), minMS: getMinMilliseconds(captures[id].framerates.preview) },
        server: { lastFrame: new Date().getTime(), minMS: getMinMilliseconds(captures[id].framerates.server) },
        ndi: { lastFrame: new Date().getTime(), minMS: getMinMilliseconds(captures[id].framerates.ndi) },
    }
}

function getMinMilliseconds(framerate: number) {
    return 1000 / framerate
}

function getWindowScreen(window: BrowserWindow) {
    return electron.screen.getDisplayMatching({
        x: window.getBounds().x,
        y: window.getBounds().y,
        width: window.getBounds().width,
        height: window.getBounds().height,
    })
}

export function resizeImage(image: NativeImage, initialSize: Size, newSize: Size) {
    if (initialSize.width / initialSize.height >= newSize.width / newSize.height) image = image.resize({ width: newSize.width })
    else image = image.resize({ height: newSize.height })

    return image
}

export let previewSize: Size = { width: 320, height: 180 }
export function updatePreviewResolution(data: any) {
    previewSize = data.size

    if (data.id) CaptureTransmitter.sendFrames(data.id, storedFrames[data.id], { previewFrame: true })
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
