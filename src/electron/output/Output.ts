import type { BrowserWindow, Rectangle } from "electron"
import type { RtmpData } from "../../types/Output"
import type { CaptureOptions } from "../capture/CaptureOptions"

export class Output {
    window!: BrowserWindow
    // hidden offscreen surface a displayed output is captured from; its window draws the surface's frames
    captureWindow?: BrowserWindow
    osr?: boolean // captured via offscreen paint events instead of the capturePage poll
    invisible?: boolean
    boundsLocked?: boolean
    screen?: string | null
    intendedBounds?: Rectangle
    // configured send size; a shared render runs at its class's largest size and downscales to this
    sendSize?: { width: number; height: number }
    transparent?: boolean
    webrtcData?: any
    rtmpData?: RtmpData
    // previewWindow: BrowserWindow
    captureOptions?: CaptureOptions
    /*
    previewBounds?: {
        x: number
        y: number
        width: number
        height: number
    }*/
}
