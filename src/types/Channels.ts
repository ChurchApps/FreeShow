export const MAIN: Main = "MAIN"
export const STORE: Store = "STORE"
export const SHOW: Show = "SHOW"
export const OUTPUT: OutputData = "OUTPUT"
export const OPEN_FILE: OpenFile = "OPEN_FILE"
export const OPEN_FOLDER: OpenFolder = "OPEN_FOLDER"
export const READ_FOLDER: ReadFolder = "READ_FOLDER"
export const FILE_INFO: FileInfo = "FILE_INFO"
export const REMOTE: Remote = "REMOTE"
export const STAGE: Stage = "STAGE"

export type Main = "MAIN"
export type Store = "STORE"
export type Show = "SHOW"
export type OutputData = "OUTPUT"
export type OpenFile = "OPEN_FILE"
export type OpenFolder = "OPEN_FOLDER"
export type ReadFolder = "READ_FOLDER"
export type FileInfo = "FILE_INFO"
export type Remote = "REMOTE"
export type Stage = "STAGE"

export type ValidChannels = Main | Store | Show | OutputData | OpenFile | OpenFolder | ReadFolder | Remote | Stage

export type Data = string | DataObject
export interface DataObject {
  id: string
  data: any
}

// export interface StageData {
//   connection?: string
// }
