export const MAIN: Main = "MAIN"
export const OUTPUT: OutputData = "OUTPUT"
export const OPEN_FILE: OpenFile = "OPEN_FILE"
export const OPEN_FOLDER: OpenFolder = "OPEN_FOLDER"
export const FOLDER_READ: FolderRead = "FOLDER_READ"
export const GET_SCREENS: GetScreens = "GET_SCREENS"
export const REMOTE: Remote = "REMOTE"
export const STAGE: Stage = "STAGE"

export type Main = "MAIN"
export type OutputData = "OUTPUT"
export type OpenFile = "OPEN_FILE"
export type OpenFolder = "OPEN_FOLDER"
export type FolderRead = "FOLDER_READ"
export type GetScreens = "GET_SCREENS"
export type Remote = "REMOTE"
export type Stage = "STAGE"

export type ValidChannels = Main | OpenFile | OpenFolder | FolderRead | GetScreens | Remote | Stage

export type Data = string | DataObject
export interface DataObject {
  id: string
  data: any
}

// export interface StageData {
//   connection?: string
// }
