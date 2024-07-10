import { BrowserWindow } from "electron"

export class Output {
    window: BrowserWindow
    previewWindow: BrowserWindow
    previewBounds?: {
        x: number
        y: number
        width: number
        height: number
    }
}
