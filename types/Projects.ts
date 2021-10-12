import type { ShowType } from "./Show"

export interface Projects {
  [key: string]: Project
}
export interface Project {
  id?: string
  name: string
  created: Date
  parent: string
  shows: ShowRef[]
}

export interface ShowRef {
  id: string
  type?: ShowType
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
