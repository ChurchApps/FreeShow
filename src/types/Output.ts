import type { Resolution } from "./Settings"
import type { OutBackground, OutSlide, OutTransition } from "./Show"

export interface Outputs {
    [key: string]: Output
}

export interface Output {
    id?: string
    keyOutput?: string
    isKeyOutput?: boolean
    stageOutput?: string
    enabled: boolean
    active: boolean
    name: string
    color: string
    bounds: { x: number; y: number; width: number; height: number }
    screen: string | null
    kioskMode?: boolean
    alwaysOnTop?: boolean
    transparent?: boolean
    ndi?: boolean
    ndiData?: any
    blackmagic?: boolean
    blackmagicData?: any
    forcedResolution?: Resolution
    invisible?: boolean
    taskbar?: boolean
    style?: string
    show?: any
    out?: {
        refresh?: boolean
        background?: null | OutBackground
        slide?: null | OutSlide
        overlays?: string[]
        transition?: null | OutTransition
    }
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
