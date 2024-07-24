import type { Resolution } from "./Settings"

export interface ActiveStage {
    id: null | string
    items: string[]
}

export interface StageShows {
    [key: string]: {
        name: string
        disabled: boolean
        password: string
        settings: {
            output?: string
            outputScreen?: boolean
            background?: boolean
            color?: string
            autoStretch?: string
            resolution?: Resolution
            // resolution?: boolean
            // size?: Resolution
            labels?: boolean
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
            }
        }
    }
}
