import type { ShowType } from "./Show"

export interface Projects {
    [key: string]: Project
}
export interface Project {
    id?: string
    deleted?: boolean // cloud sync deleted
    name: string
    notes?: string // pre v0.6.1
    created: number
    modified?: number // used for cloud sync updates
    parent: string
    shows: ProjectShowRef[]
}

export interface ProjectShowRef extends ShowRef {
    layout?: string
    layoutInfo?: { [key: string]: any }
    muted?: boolean
    loop?: boolean
    filter?: any[]
    notes?: string
    icon?: string // focus mode
    data?: any // pdf viewports
}

export interface ShowRef {
    id: string
    index?: number
    name?: string
    type?: ShowType
    data?: any
    // private?: boolean
    // location?: string;
}

export interface Folders {
    [key: string]: Folder
}
export interface Folder {
    id?: string
    deleted?: boolean // cloud sync deleted
    name: string
    created?: number
    modified?: number // used for cloud sync updates
    parent: string
    type?: "folder"
}

export interface Tree extends Folder {
    shows?: []
    index?: number
    path?: string
}
