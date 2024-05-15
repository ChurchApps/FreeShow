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

    const previewFramerate = Math.round(framerates.preview / Object.keys(captures).length)

    let defaultFramerates = {
        preview: previewFramerate,
        server: framerates.server,
        ndi: framerates.connected,
    }

    return {
        window,
        subscribed: false,
        displayFrequency: screen.displayFrequency || 60,
        options: { server: false, ndi: false },
        framerates: defaultFramerates,
        id
    }
}

// START

export let storedFrames: any = {}
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


    //captures[id].options.ndi = true
    CaptureTransmitter.startTransmitting(id)

    //framerates.preview = rate === "full" ? 60 : 30
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
            //let image = await captures[id].window.webContents.capturePage()
            //CaptureTransmitter.sendFrames(captures[id], image, { previewFrame: true, serverFrame: true, ndiFrame: true })

            // capture for 60 seconds then get cpu again
            captureCount++
            setTimeout(cpuCapture, rate === "optimized" ? 2000 : 250)
        } else {
            captureCount = captureAmount
            if (!captures[id].window.webContents.isBeingCaptured()) captures[id].window.webContents.beginFrameSubscription(true, processFrame)
        }
    }

    function processFrame(image: NativeImage) {
        storedFrames[id] = image
    }

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

export let previewSize: Size = { width: 320, height: 180 }
export function updatePreviewResolution(data: any) { previewSize = data.size }

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
