export interface Option {
    name: string
    extra?: string
    data?: any
    id?: string
    style?: string // css style for the item
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
    | "slide_icon"
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
    | "metronome"
    | "overlay"
    | "template"
    | "action"
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
    | "audio_stream"
    | "chord"
    | "midi"
    | "theme"
    | "style"
    | "output"
    | "tag"

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
    showId?: string // only used to reset to slide 0 if changed ($activeShow.id is actually used)
}

export type MediaFit = "contain" | "cover" | "fill"
export interface Media {
    [key: string]: MediaStyle
}
export interface MediaStyle {
    filter?: string
    flipped?: boolean
    flippedY?: boolean
    fit?: MediaFit
    speed?: string
    fromTime?: number
    toTime?: number
    favourite?: boolean
    audio?: boolean
    loop?: boolean // audio
    volume?: number // audio
    rendering?: string // image rendering
    info?: any // cached codec/mime data
}

export type Popups =
    | "initialize"
    | "import"
    | "songbeamer_import"
    | "export"
    | "show"
    | "delete_show"
    | "select_show"
    | "delete_duplicated_shows"
    | "icon"
    | "manage_icons"
    | "manage_colors"
    | "player"
    | "rename"
    | "color"
    | "find_replace"
    | "timer"
    | "variable"
    | "trigger"
    | "audio_stream"
    | "transition"
    | "import_scripture"
    | "edit_event"
    | "edit_list"
    | "choose_chord"
    | "choose_screen"
    | "choose_camera"
    | "choose_output"
    | "change_output_values"
    | "set_time"
    | "slide_shortcut"
    | "animate"
    | "translate"
    | "next_timer"
    | "advanced_settings"
    | "about"
    | "shortcuts"
    | "unsaved"
    | "reset_all"
    | "alert"
    | "history"
    | "action"
    | "category_action"
    | "connect"
    | "cloud_update"
    | "cloud_method"

export type DefaultProjectNames = "date" | "today" | "sunday" | "week" | "custom" | "blank"

// export type DropIds = "slide" | "slide_group" | "show" | "show_drawer" | "project" | "folder" | "file"
// export interface Drop {
//   id: null | SelectIds
//   data: null | number
// }
