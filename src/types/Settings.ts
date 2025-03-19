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
    resolution?: Resolution // pre 1.3.9
    aspectRatio?: AspectRatio
    cropping?: Cropping // pre 1.3.3
    lines?: number
    template?: string // slide
    templateScripture?: string
    templateScripture_2?: string
    templateScripture_3?: string
    templateScripture_4?: string
    metadataDivider?: string
    metadataLayout?: string // not in use yet 1.2.8
    displayMetadata?: string
    metadataTemplate?: string
    messageTemplate?: string
    transition?: { [key: string]: Transition }
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
