import type { ShowRef } from "./Projects"

export type HistoryPages = "none" | "drawer" | "show" | "reflow" | "edit" | "calendar" | "draw" | "stage" | "settings"
export type HistoryIDs =
    // NEW
    | "UPDATE"
    | "SHOWS"
    | "SLIDES"
    | "TEMPLATE"
    | "SHOW_LAYOUT"
    | "SHOW_ITEMS"

    // TODO: remove/update these:
    // edit
    | "textStyle"
    | "textAlign"
    | "deleteItem"
    | "setItems"
    | "setStyle"
    | "slideStyle"
    // show
    | "slide"
    | "showMedia"
    | "showAudio"

export interface History {
    id: HistoryIDs
    oldData?: any
    newData?: any
    save?: boolean
    time?: number
    location?: {
        page: HistoryPages
        id?: string
        override?: boolean | string
        project?: null | string
        folder?: string
        show?: ShowRef
        shows?: any[]
        layout?: string
        layouts?: string[]
        layoutSlide?: number
        slide?: string
        items?: any[]
        theme?: string
        lines?: number[]
    }
}

export type HistoryTypes = "store_create" | "store_update" | "store_delete"
export interface HistoryNew {
    version: number
    time: number
    type: HistoryTypes
    value: any
}
