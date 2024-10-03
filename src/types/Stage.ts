import type { Resolution } from "./Settings"

export interface ActiveStage {
    id: null | string
    items: string[]
}

export interface StageLayouts {
    [key: string]: StageLayout
}

export interface StageLayout {
    name: string
    disabled: boolean
    password: string
    settings: {
        output?: string
        background?: boolean
        color?: string
        autoStretch?: string
        resolution?: Resolution
        // resolution?: boolean
        // size?: Resolution
        labels?: boolean
        labelColor?: string
        showLabelIfEmptySlide?: boolean
    }
    items: {
        [key: string]: {
            enabled: boolean
            chords?: boolean
            chordsData?: any
            auto?: boolean
            style: string
            align: string
            alignX?: string
            label?: string // sending translated label to stage
            tracker?: any // slide tracker data
            lineCount?: number // max lines to show in next slide preview
            invertItems?: boolean // invert items if more than one (used for e.g. scripture refs)
        }
    }
}
