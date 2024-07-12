import { BrowserWindow } from "electron"

export type CaptureOptions = {
    id: string
    window: BrowserWindow
    subscribed: boolean
    displayFrequency: number
    options: any
    framerates: any
}
