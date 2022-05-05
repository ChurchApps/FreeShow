import type { ShowType } from "./Show"

export interface Projects {
  [key: string]: Project
}
export interface Project {
  id?: string
  name: string
  notes: string
  created: number
  parent: string
  shows: ProjectShowRef[]
}

export interface ProjectShowRef extends ShowRef {
  layout?: string
  muted?: boolean
  loop?: boolean
  filter?: any[]
}

export interface ShowRef {
  id: string
  index?: number
  name?: string
  type?: ShowType
  // private?: boolean
  // location?: string;
}

export interface Folders {
  [key: string]: Folder
}
export interface Folder {
  id?: string
  name: string
  parent: string
  type?: "folder"
}

export interface Tree extends Folder {
  shows?: []
  index?: number
  path?: string
}
