import type { BrowserWindow } from "electron"

export type CaptureOptions = {
    id: string
    window: BrowserWindow
    frameSubscription: NodeJS.Timeout | null
    displayFrequency: number
    options: { [key: string]: boolean }
    framerates: { [key: string]: number }
}
