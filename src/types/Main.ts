import type fs from "fs"
import type { dataFolderNames } from "../electron/utils/files"
import type { ShowRef } from "./Projects"
import type { Cropping } from "./Settings"

export interface OS {
    platform: NodeJS.Platform
    name: string
    arch: string
}

export interface Option {
    name: string
    extra?: string
    extraInfo?: string
    data?: any
    id?: string | null
    icon?: string
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
    d: number
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
    | "audio_effect"
    | "metronome"
    | "overlay"
    | "template"
    | "action"
    | "effect"
    | "screen"
    | "ndi"
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
    | "bible_book"

export interface Selected {
    id: null | SelectIds
    data: any[]
    showId?: string
    hoverActive?: boolean
}
export interface DropData {
    id: string
    data: any
    trigger?: string
    center: boolean
    index?: number
}

export interface Clipboard {
    id: string | null
    data?: any // []
}
// export interface ClipboardData {
//     index?: number

//     // ActiveEdit
//     type?: string
//     id?: string
//     slide?: null | number
//     items?: number[]
//     showId?: string

//     // [key: string]: any
// }

export interface SlidesOptions {
    columns: number
    mode: "grid" | "simple" | "groups" | "list" | "lyrics" | "text"
}
export interface MediaOptions {
    columns: number
    mode: "grid" | "list"
}

export interface ActiveEdit {
    // id?: string
    type?: "show" | "media" | "camera" | "overlay" | "template" | "effect" | "audio"
    id?: string
    slide?: null | number
    items: number[]
    showId?: string // only used to reset to slide 0 if changed ($activeShow.id is actually used)
    data?: any // camera data
}

export type MediaFit = "contain" | "cover" | "fill" | "blur"
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
    videoType?: string // default | "background" | "foreground"
    audioType?: AudioType // default | "music" | "effect"
    favourite?: boolean
    audio?: boolean
    loop?: boolean // audio
    volume?: number // audio
    rendering?: string // image rendering
    info?: any // cached codec/mime data
    tracks?: Subtitle[]
    subtitle?: string
    tags?: string[] // media tags
    cropping?: Partial<Cropping>

    ignoreLayer?: boolean // foreground background type
}

export type AudioType = "music" | "effect"

// subtitles/captions
export interface Subtitle {
    lang: string // id
    name: string
    vtt: string // WebVTT format
    embedded?: boolean // extracted from the video
}

export interface MainFilePaths {
    // documents: string
    pictures: string
    videos: string
    music: string
}

export type LyricSearchResult = {
    source: "Genius" | "Hymnary" | "Letras"
    key: string
    artist: string
    title: string
    originalQuery?: string
}

export interface DriveData {
    mainFolderId: string | null
    path: string | null
    dataPath: string
    method: string | null
    closeWhenFinished: boolean
}

export interface LessonsData {
    type?: keyof typeof dataFolderNames
    path: string
    showId: string
    name: string
    files: LessonFile[]
}
export interface LessonFile {
    name: string
    url: string
    type: string
    fileType: string
    streamUrl?: string
    loopVideo?: boolean
    loop?: boolean
}

export interface Variable {
    id?: string
    name: string
    type: "number" | "random_number" | "text"
    tags?: string[]

    // number
    number?: number
    step?: number
    default?: number
    minValue?: number
    maxValue?: number

    // random number
    animate?: boolean
    eachNumberOnce?: boolean
    sets?: { name: string; minValue?: number; maxValue?: number }[]
    setName?: string // chosen random set
    setLog?: { name: string; number: number }[]

    // text
    text?: string
    enabled?: boolean
}

export interface Trigger {
    name: string
    type: "http"
    value: string
}

export interface FileData {
    path: string
    stat: fs.Stats
    extension: string
    folder: boolean
    name: string
    thumbnailPath?: string
}

export interface ErrorLog {
    time: Date
    os: string
    version: string
    active: { window: string; page: string; show: ShowRef | null; edit: ActiveEdit }
    drawer: { active: string }
    type: string
    source: string
    message: string
    stack: string
    dev?: boolean
}

export type Popups =
    | "initialize"
    | "confirm"
    | "custom_text"
    | "import"
    | "songbeamer_import"
    | "export"
    | "show"
    | "delete_show"
    | "select_show"
    | "select_template"
    | "select_style"
    | "select_stage_layout"
    | "delete_duplicated_shows"
    | "icon"
    | "manage_groups"
    | "manage_icons"
    | "manage_colors"
    | "manage_metadata"
    | "manage_dynamic_values"
    | "player"
    | "rename"
    | "color"
    | "color_gradient"
    | "find_replace"
    | "timer"
    | "variable"
    | "trigger"
    | "audio_stream"
    | "aspect_ratio"
    | "max_lines"
    | "transition"
    | "media_fit"
    | "metadata_display"
    | "import_scripture"
    | "scripture_show"
    | "edit_event"
    | "choose_chord"
    | "choose_screen"
    | "choose_camera"
    | "choose_output"
    | "choose_style"
    | "change_output_values"
    | "set_time"
    | "assign_shortcut"
    | "dynamic_values"
    | "conditions"
    | "animate"
    | "translate"
    | "next_timer"
    | "display_duration"
    | "manage_tags"
    | "advanced_settings"
    | "about"
    | "shortcuts"
    | "unsaved"
    | "reset_all"
    | "alert"
    | "history"
    | "action_history"
    | "manage_emitters"
    | "action"
    | "category_action"
    | "custom_action"
    | "user_data_overwrite"
    | "connect"
    | "cloud_update"
    | "cloud_method"
    | "chums_sync_categories"
    | "effect_items"

export type DefaultProjectNames = "date" | "today" | "sunday" | "week" | "custom" | "blank"

// export type DropIds = "slide" | "slide_group" | "show" | "show_drawer" | "project" | "folder" | "file"
// export interface Drop {
//   id: null | SelectIds
//   data: null | number
// }
