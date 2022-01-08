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

export type SelectIds = "slide" | "slide_group" | "show" | "show_drawer" | "project" | "folder" | "file" | "navigation" | "media"
export interface Selected {
  id: null | SelectIds
  elems: any[]
}

export type DragIds = "slide" | "slide_group" | "show" | "show_drawer" | "project" | "folder" | "file"
export interface Drag {
  id: null | SelectIds
  // to
  index: null | number
  // selected: number[]
  side: "left" | "right"
}
