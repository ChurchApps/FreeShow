import { BrowserWindow } from "electron"
import { CaptureOptions } from "./capture"

export class Output {
    window: BrowserWindow
    previewWindow: BrowserWindow
    captureOptions?: CaptureOptions
    previewBounds?: {
        x: number
        y: number
        width: number
        height: number
    }
}
