export interface Option {
  name: string
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
}

export type SelectIds =
  | "slide"
  | "group"
  | "global_group"
  | "show"
  | "show_drawer"
  | "project"
  | "folder"
  | "files"
  | "category"
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
  grid: boolean
}

export interface ActiveEdit {
  slide: null | number
  items: number[]
}

export type Popups = "show" | "delete_show" | "icon" | "rename" | "about"

export type DefaultProjectNames = "date" | "today" | "sunday" | "week" | "custom" | "blank"

// export type DropIds = "slide" | "slide_group" | "show" | "show_drawer" | "project" | "folder" | "file"
// export interface Drop {
//   id: null | SelectIds
//   data: null | number
// }
