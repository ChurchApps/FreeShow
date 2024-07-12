import type { BrowserWindow, Display, NativeImage, Size } from "electron"
import electron from "electron"
import { NdiSender } from "../ndi/NdiSender"
import { CaptureTransmitter } from "./CaptureTransmitter"
import { OutputHelper } from "./OutputHelper"

export type CaptureOptions = {
    id: string
    window: BrowserWindow
    subscribed: boolean
    displayFrequency: number
    options: any
    framerates: any
}

export let captures: { [key: string]: CaptureOptions } = {}

export const framerates: any = {
    server: 30,
    unconnected: 1,
    connected: 30,
}
export let customFramerates: any = {}

function getDefaultCapture(window: BrowserWindow, id: string): CaptureOptions {
    let screen: Display = getWindowScreen(window)

    let defaultFramerates = {
        server: framerates.server,
        ndi: framerates.connected,
    }

    return {
        window,
        subscribed: false,
        displayFrequency: screen.displayFrequency || 60,
        options: { server: false, ndi: false },
        framerates: defaultFramerates,
        id,
    }
}

// START

export let storedFrames: any = {}
export function startCapture(id: string, toggle: any = {}) {
    let window = OutputHelper.getOutput(id)?.window
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

    //captures[id].options.ndi = true
    CaptureTransmitter.startTransmitting(id)

    // TODO: Re-enable for NDI and Server
    /*
    //framerates.preview = rate === "full" ? 60 : 30
    if (rate === "auto" || rate === "full") captures[id].window.webContents.beginFrameSubscription(true, processFrame) // updates approximately every 0.02s
    captures[id].subscribed = true

    if (rate === "full" || (rate !== "optimized" && captures[id].options.ndi)) return

    // optimize cpu on low end devices
    const autoOptimizePercentageCPU = 95 / 10 // % / 10
    const captureAmount = 4 * 60
    let captureCount = captureAmount

    cpuCapture()
    async function cpuCapture() {
        if (!captures[id] || captures[id].window.isDestroyed()) return

        let usage = process.getCPUUsage()

        let isOptimizedOrLagging = rate !== "auto" || captureCount < captureAmount || usage.percentCPUUsage > autoOptimizePercentageCPU
        if (isOptimizedOrLagging) {
            if (captureCount > captureAmount) captureCount = 0
            // limit frames
            if (captures[id].window.webContents.isBeingCaptured()) captures[id].window.webContents.endFrameSubscription()

            // manually capture to reduce lag
            let image = await captures[id].window.webContents.capturePage()
            processFrame(image)

            // capture for 60 seconds then get cpu again (if rate is "auto")
            captureCount++
            setTimeout(cpuCapture, rate === "optimized" ? 1000 : 100)
        } else {
            captureCount = captureAmount
            if (!captures[id].window.webContents.isBeingCaptured()) captures[id].window.webContents.beginFrameSubscription(true, processFrame)
        }
    }

    function processFrame(image: NativeImage) {
        storedFrames[id] = image
    }
    */
}

export function updateFramerate(id: string) {
    if (!captures[id]) return

    if (NdiSender.NDI[id]) {
        let ndiFramerate = framerates.unconnected
        if (NdiSender.NDI[id].status === "connected") ndiFramerate = customFramerates[id]?.ndi || framerates.connected

        if (captures[id].framerates.ndi !== parseInt(ndiFramerate)) {
            captures[id].framerates.ndi = parseInt(ndiFramerate)
            CaptureTransmitter.startChannel(id, "ndi")
        }
    }
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

// STOP

export function stopAllCaptures() {
    Object.keys(captures).forEach(stopCapture)
}

export function stopCapture(id: string) {
    return new Promise((resolve) => {
        if (!captures[id]) return resolve(true)
        CaptureTransmitter.removeAllChannels(id)
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
