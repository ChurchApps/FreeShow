import type { BrowserWindow } from "electron"

export type CaptureOptions = {
    id: string
    window: BrowserWindow
    frameSubscription: any
    displayFrequency: number
    options: any
    framerates: any
}
