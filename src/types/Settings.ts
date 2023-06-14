export interface Themes {
    name: string
    default?: boolean
    font: any
    colors: any
}

export interface Styles {
    name: string
    layers?: ["background", "slide", "overlays"][]
    background?: string
    backgroundImage?: string
    resolution?: Resolution
    cropping?: Cropping
    lines?: number
    template?: string
    displayMetadata?: string
    metadataTemplate?: string
    messageTemplate?: string
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
