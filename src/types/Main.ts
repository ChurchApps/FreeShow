export interface Option {
    name: string
    extra?: string
    id?: string
}

export interface NumberObject {
    [key: string]: number
}
export interface StringObject {
    [key: string]: string
}

export interface Time {
    ms: string
    s: string
    m: string
    h: string
    d: string
}

export type SelectIds =
    | "slide"
    | "group"
    | "global_group"
    | "layout"
    | "show"
    | "show_drawer"
    | "project"
    | "folder"
    | "files"
    | "category_shows"
    | "category_media"
    | "category_overlays"
    | "category_audio"
    | "category_scripture"
    | "category_templates"
    | "category_player"
    | "category_live"
    | "category_web"
    | "stage"
    | "media"
    | "audio"
    | "overlay"
    | "template"
    | "effect"
    | "screen"
    | "camera"
    | "microphone"
    | "player"
    | "scripture"
    | "timer"
    | "global_timer"
    | "variable"
    | "trigger"
    | "chord"
    | "midi"
    | "theme"
    | "style"
    | "output"

export interface Selected {
    id: null | SelectIds
    data: any[]
}

export interface SlidesOptions {
    columns: number
    mode: "grid" | "simple" | "list" | "lyrics" | "text"
}
export interface MediaOptions {
    columns: number
    mode: "grid" | "list"
}

export interface ActiveEdit {
    // id?: string
    type?: "show" | "media" | "overlay" | "template" | "effect" | "audio"
    id?: string
    slide?: null | number
    items: number[]
}

export type MediaFit = "contain" | "cover" | "fill"
export interface Media {
    [key: string]: MediaStyle
}
export interface MediaStyle {
    filter?: string
    flipped?: boolean
    fit?: MediaFit
    speed?: string
    fromTime?: number
    toTime?: number
    favourite?: boolean
    audio?: boolean
}

export type Popups =
    | "initialize"
    | "import"
    | "export"
    | "show"
    | "delete_show"
    | "select_show"
    | "icon"
    | "manage_icons"
    | "player"
    | "rename"
    | "color"
    | "find_replace"
    | "timer"
    | "variable"
    | "trigger"
    | "transition"
    | "import_scripture"
    | "edit_event"
    | "choose_screen"
    | "change_output_values"
    | "choose_style"
    | "set_time"
    | "animate"
    | "next_timer"
    | "advanced_settings"
    | "about"
    | "shortcuts"
    | "unsaved"
    | "reset_all"
    | "alert"
    | "history"
    | "midi"
    | "connect"
    | "cloud_update"
    | "cloud_method"

export type DefaultProjectNames = "date" | "today" | "sunday" | "week" | "custom" | "blank"

// export type DropIds = "slide" | "slide_group" | "show" | "show_drawer" | "project" | "folder" | "file"
// export interface Drop {
//   id: null | SelectIds
//   data: null | number
// }
