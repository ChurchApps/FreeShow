import type { BrowserWindow } from "electron"
import type { CaptureOptions } from "../capture/CaptureOptions"

export class Output {
    window!: BrowserWindow
    invisible?: boolean
    boundsLocked?: boolean
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
