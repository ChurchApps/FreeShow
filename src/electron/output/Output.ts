import type { BrowserWindow, Rectangle } from "electron"
import type { RtmpData } from "../../types/Output"
import type { CaptureOptions } from "../capture/CaptureOptions"

export class Output {
    window!: BrowserWindow
    // a displayed output's own window cannot be offscreen, so its capture (and any render it shares,
    // RenderGroups.ts) reads this hidden surface instead, and the window draws the surface's frames
    captureWindow?: BrowserWindow
    osr?: boolean // captured via offscreen paint events instead of the capturePage poll
    invisible?: boolean
    boundsLocked?: boolean
    screen?: string | null
    intendedBounds?: Rectangle
    // the resolution this output SENDS at (its configured size). A shareable page renders at its class's
    // largest size; smaller members are downscaled to their sendSize in the same readback pass.
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
