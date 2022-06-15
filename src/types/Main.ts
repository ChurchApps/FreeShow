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
  | "overlay"
  | "template"
  | "camera"
  | "player"
export interface Selected {
  id: null | SelectIds
  data: any[]
}

export interface SlidesOptions {
  columns: number
  mode: "grid" | "list" | "lyrics"
}

export interface ActiveEdit {
  // id?: string
  type?: "show" | "media" | "overlay" | "template" | "audio"
  id?: string
  slide?: null | number
  items: number[]
}

export interface Media {
  [key: string]: {
    fill?: "fill" | "fit"
    filter: any
    flipped?: boolean
  }
}

export type Popups =
  | "initialize"
  | "import"
  | "export"
  | "show"
  | "delete_show"
  | "icon"
  | "rename"
  | "timer"
  | "transition"
  | "import_scripture"
  | "edit_event"
  | "about"
  | "shortcuts"
  | "unsaved"
  | "reset_all"
  | "alert"

export type DefaultProjectNames = "date" | "today" | "sunday" | "week" | "custom" | "blank"

// export type DropIds = "slide" | "slide_group" | "show" | "show_drawer" | "project" | "folder" | "file"
// export interface Drop {
//   id: null | SelectIds
//   data: null | number
// }
