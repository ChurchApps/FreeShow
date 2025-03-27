import type { Resolution } from "./Settings"
import type { Line } from "./Show"

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
        [key: string]: StageItem
    }
}

export interface StageItem {
    type?: string // ItemType ++
    enabled?: boolean
    label?: string // sending translated label to stage

    // style
    style: string
    align: string
    alignX?: string
    filter?: any // not in use at the moment

    // textbox
    chords?: { enabled?: boolean; color?: string; size?: number }
    auto?: boolean

    // slide text
    slideOffset?: number
    includeMedia?: boolean
    keepStyle?: boolean
    lineCount?: number // max lines to show in next slide preview
    itemNumber?: number // only show a certain item index (0 will show all items)
    invertItems?: boolean // invert items if more than one (used for e.g. scripture refs)

    // textbox
    lines?: Line[]

    // other items
    variable?: { id: string } // variable data
    device?: { name: string } // camera data
    tracker?: any // slide tracker data
    timer?: any // timer options
    clock?: any // clock options
}
