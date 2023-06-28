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
            background?: boolean
            color?: string
            autoStretch?: string
            resolution?: boolean
            size?: Resolution
            labels?: boolean
            showLabelIfEmptySlide?: boolean
        }
        items: {
            [key: string]: {
                enabled: boolean
                auto?: boolean
                style: string
                align: string
            }
        }
    }
}
