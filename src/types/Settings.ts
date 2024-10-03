import type { MediaFit } from "./Main"
import type { Transition } from "./Show"

export interface Themes {
    name: string
    default?: boolean
    font: any
    colors: any
    border?: any
}

type StyleLayers = "background" | "slide" | "overlays"
export interface Styles {
    name: string
    layers?: StyleLayers[]
    background?: string
    backgroundImage?: string
    clearStyleBackgroundOnText?: boolean
    fit?: MediaFit | null
    resolution?: Resolution
    cropping?: Cropping
    lines?: number
    template?: string // slide
    templateScripture?: string
    metadataDivider?: string
    metadataLayout?: string // not in use yet 1.2.8
    displayMetadata?: string
    metadataTemplate?: string
    messageTemplate?: string
    transition?: Transition
}

export interface Resolution {
    width: number
    height: number
}
export interface Cropping {
    top: number
    right: number
    bottom: number
    left: number
}

export interface Dictionary {
    [key: string]: {
        [key: string]: string
    }
}
