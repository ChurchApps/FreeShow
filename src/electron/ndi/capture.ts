import type { BrowserWindow, NativeImage } from "electron"
import { outputWindows } from "../utils/output"
import { sendBufferNDI } from "./ndi"

type CaptureOptions = {
    window: BrowserWindow
    frameRate: number
    framerateNow: number
    framesToSkip: number
    subscribed: boolean
    framerateSource: number
}

export let captures: { [key: string]: CaptureOptions } = {}

const defaultFrameRate = 60

export function startCapture(id: string) {
    let window = outputWindows[id]
    if (!window) return

    if (captures[id]) return

    captures[id] = {
        window,
        frameRate: defaultFrameRate,
        framerateNow: defaultFrameRate,
        framesToSkip: -1,
        framerateSource: -1,
        subscribed: false,
    }

    const framesToSkip = Math.trunc(captures[id].framerateSource / captures[id].framerateNow - 1)
    if (captures[id].framesToSkip !== framesToSkip) {
        console.log(`NDI - frame rate: ${captures[id].framerateNow}`)
        captures[id].framesToSkip = framesToSkip
    }

    if (!captures[id].subscribed) {
        console.log("NDI - starting capture")

        captures[id].window.webContents.beginFrameSubscription(false, processFrame)
        captures[id].subscribed = true
    }

    let framesSkipped = 0
    // , dirty: Rectangle
    function processFrame(image: NativeImage) {
        if (framesSkipped++ < captures[id].framesToSkip) return

        framesSkipped = 0
        const buffer = image.getBitmap()
        const size = image.getSize()
        const ratio = image.getAspectRatio()

        sendBufferNDI(id, buffer, { size, ratio, frameRate: captures[id].frameRate })
    }
}

export function stopAllCaptures() {
    Object.keys(captures).forEach(stopCapture)
}

export function stopCapture(id: string) {
    if (!captures[id]) return
    console.log("NDI - stopping capture")

    if (captures[id].subscribed) {
        captures[id].window.webContents.endFrameSubscription()
        captures[id].subscribed = false
    }

    captures[id].window.removeAllListeners()
    captures[id].window.webContents.removeAllListeners()

    delete captures[id]
}
