import type { BrowserWindow, Rectangle } from "electron"
import type { RtmpData } from "../../types/Output"
import type { CaptureOptions } from "../capture/CaptureOptions"

export class Output {
    window!: BrowserWindow
    name?: string
    osr?: boolean // captured via offscreen paint events instead of the capturePage poll
    // shared-render (FS_SHARE_RENDER): this output is a FOLLOWER sharing `renderGroupRenderer`'s window +
    // capture (pixel-identical content). It owns no window and is fed by the renderer's fan-out.
    follower?: boolean
    renderGroupRenderer?: string
    invisible?: boolean
    boundsLocked?: boolean
    screen?: string | null
    intendedBounds?: Rectangle
    transparent?: boolean
    webrtcData?: any
    rtmpData?: RtmpData
    htmlData?: any
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
