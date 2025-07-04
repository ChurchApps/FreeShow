import type { Cropping, Resolution } from "./Settings"
import type { OutBackground, OutSlide, OutTransition } from "./Show"

export interface Outputs {
    [key: string]: Output
}

export interface Output {
    id?: string
    hideFromPreview?: boolean
    keyOutput?: string
    isKeyOutput?: boolean
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
    kioskMode?: boolean
    alwaysOnTop?: boolean
    transparent?: boolean
    allowMainScreen?: boolean // allow custom output bounds
    ndi?: boolean
    ndiData?: any
    blackmagic?: boolean
    blackmagicData?: any
    forcedResolution?: Resolution
    invisible?: boolean
    taskbar?: boolean
    style?: string
    show?: any
    out?: OutData
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
