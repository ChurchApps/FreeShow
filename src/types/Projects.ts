import type { ShowType } from "./Show"

export interface Projects {
  [key: string]: Project
}
export interface Project {
  id?: string
  name: string
  notes: string
  created: Date
  parent: string
  shows: ProjectShowRef[]
}

export interface ProjectShowRef extends ShowRef {
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

export interface Tree extends Folder {}
