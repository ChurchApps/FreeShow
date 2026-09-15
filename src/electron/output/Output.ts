import type { BrowserWindow, Rectangle } from "electron"
import type { RtmpData } from "../../types/Output"
import type { CaptureOptions } from "../capture/CaptureOptions"

export class Output {
    window!: BrowserWindow
    // a displayed output's own window cannot be offscreen, so its capture reads this hidden surface
    // instead; not created when another output already renders this content (see presenter)
    captureWindow?: BrowserWindow
    // shows on a monitor but renders nothing: this window draws another output's render of the same
    // content. Unlike a follower it owns its window - it just never puts content in it.
    presenter?: boolean
    osr?: boolean // captured via offscreen paint events instead of the capturePage poll
    // shared-render (FS_SHARE_RENDER): this output is a FOLLOWER sharing `renderGroupRenderer`'s window +
    // capture (pixel-identical content). It owns no window and is fed by the renderer's fan-out.
    follower?: boolean
    renderGroupRenderer?: string
    invisible?: boolean
    boundsLocked?: boolean
    screen?: string | null
    intendedBounds?: Rectangle
    // the resolution this output SENDS at (its configured size). A shared render runs at the largest
    // member's size; smaller members are downscaled to their sendSize in the same readback pass.
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
