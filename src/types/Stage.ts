import type { AutosizeTypes } from "../frontend/components/edit/scripts/autosize"
import type { Resolution } from "./Settings"
import type { Condition, Line } from "./Show"

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
    modified?: number // cloud sync
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
    itemOrder?: string[] // sort item ids in chosen order
}

export interface StageItem {
    type?: string // ItemType ++
    enabled?: boolean
    label?: string // sending translated label to stage

    // special
    conditions?: { [key: string]: Condition }

    // style
    style: string
    align: string
    alignX?: string
    filter?: any // not in use at the moment

    // textbox
    chords?: { enabled?: boolean; color?: string; size?: number }
    auto?: boolean
    textFit?: AutosizeTypes // auto size text fix option (default: growToFit)
    button?: { press?: string; release?: string } // click actions

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
    src?: string // media path
    tracker?: any // slide tracker data
    timer?: any // timer options
    clock?: any // clock options
    currentOutput?: { source?: string; showLabel?: boolean }
}
