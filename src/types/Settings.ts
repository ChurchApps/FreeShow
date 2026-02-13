import type { MediaFit } from "./Main"
import type { Transition } from "./Show"

export interface Themes {
    name: string
    default?: boolean
    font: { family: string; size: string }
    colors: { [key: string]: string | null }
    border?: { radius?: string }
}

type StyleLayers = "background" | "slide" | "overlays"
export interface Styles {
    name: string
    layers?: StyleLayers[]
    background?: string
    backgroundImage?: string
    clearStyleBackgroundOnText?: boolean
    transition?: { [key: string]: Transition }
    fit?: MediaFit | null
    blurAmount?: number
    blurOpacity?: number
    volume?: number
    resolution?: Resolution // pre 1.3.9
    aspectRatio?: AspectRatio
    cropping?: Cropping // pre 1.3.3
    lines?: number
    skipVirtualBreaks?: boolean // break on [_VB] chars only for templates with this option
    template?: string // slide
    templateScripture?: string
    templateScripture_2?: string
    templateScripture_3?: string
    templateScripture_4?: string
    metadata?: Metadata
}

export interface Metadata {
    display?: string
    template?: string // default or last slide only
    templateFirst?: string // first slide only
    templateAll?: string // all slides (old "message")
}

export interface Resolution {
    width: number
    height: number
}
export interface AspectRatio extends Resolution {
    outputResolutionAsRatio?: boolean
    alignPosition?: "center" | "start" | "end"
    fontSizeRatio?: number
}
export interface Cropping {
    top: number
    right: number
    bottom: number
    left: number
}

export interface Dictionary {
    [key: string]: { [key: string]: string } | undefined
}
