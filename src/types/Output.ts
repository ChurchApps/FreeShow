import type { Cropping, Resolution } from "./Settings"
import type { OutBackground, OutSlide, OutTransition } from "./Show"

export interface Outputs {
    [key: string]: Output
}

export interface Output {
    id?: string
    hideFromPreview?: boolean
    stageOutput?: string
    enabled: boolean
    active: boolean
    name: string
    color: string
    bounds: { x: number; y: number; width: number; height: number }
    boundsLocked?: boolean
    cropping?: Cropping
    blending?: { left: number; right: number; rotate: number; opacity: number; centered: boolean; offset: number }
    screen: string | null
    alwaysOnTop?: boolean
    transparent?: boolean
    ndi?: boolean
    ndiData?: any
    blackmagic?: boolean
    blackmagicData?: any
    webrtc?: boolean
    webrtcData?: { url?: string; token?: string; streaming?: boolean; fps?: string | number; bitrate?: string | number }
    rtmp?: boolean
    rtmpData?: RtmpData
    html?: boolean
    htmlData?: { path?: string }
    forcedResolution?: Resolution
    invisible?: boolean
    taskbar?: boolean
    style?: string
    show?: any
    out?: OutData
}

// RTMP
export interface RtmpDestination {
    id: string
    url: string
    key: string
    enabled: boolean
}
export interface RtmpData {
    streaming?: boolean
    fps?: string | number
    bitrate?: string | number
    destinations?: RtmpDestination[]
    url?: string // deprecated, only used in v1.6.4
    key?: string // deprecated, only used in v1.6.4
}
export type RtmpDestinationState = "idle" | "connecting" | "live" | "reconnecting" | "error"
export interface RtmpStatus {
    /**
     * `restarts`/`lastIssue` persist for the whole stream rather than clearing on recovery: a
     * destination that keeps dropping and reconnecting reads as healthy from `state` alone.
     */
    [destinationId: string]: { state: RtmpDestinationState; error?: string; restarts?: number; lastIssue?: string }
}

export interface OutData {
    refresh?: boolean
    background?: null | OutBackground
    slide?: null | OutSlide
    effects?: string[]
    overlays?: string[]
    transition?: null | OutTransition
}

export interface Animation {
    actions: AnimationAction[]
    repeat?: boolean
    easing?: string
}

export interface AnimationAction {
    type: "change" | "set" | "wait"
    id?: "background" | "text" | "item"
    key?: string
    extension?: string
    value?: number
    duration: number
}
