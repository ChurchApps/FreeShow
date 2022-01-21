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
  | "navigation"
  | "media"
  | "overlay"
  | "template"
  | "camera"
  | "player"
export interface Selected {
  id: null | SelectIds
  data: any[]
}

// export type DropIds = "slide" | "slide_group" | "show" | "show_drawer" | "project" | "folder" | "file"
// export interface Drop {
//   id: null | SelectIds
//   data: null | number
// }
