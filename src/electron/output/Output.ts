import type { BrowserWindow, Rectangle } from "electron"
import type { CaptureOptions } from "../capture/CaptureOptions"

export class Output {
    window!: BrowserWindow
    invisible?: boolean
    boundsLocked?: boolean
    screen?: string | null
    intendedBounds?: Rectangle
    transparent?: boolean
    webrtcData?: any
    rtmpData?: any
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
