export const STARTUP: Startup = "STARTUP"
export const MAIN: Main = "MAIN"
export const STORE: Store = "STORE"
export const SHOW: Show = "SHOW"
export const BIBLE: Bible = "BIBLE"
export const OUTPUT: OutputData = "OUTPUT"
export const IMPORT: Import = "IMPORT"
export const EXPORT: Export = "EXPORT"
export const OPEN_FILE: OpenFile = "OPEN_FILE"
export const OPEN_FOLDER: OpenFolder = "OPEN_FOLDER"
export const READ_FOLDER: ReadFolder = "READ_FOLDER"
export const FILE_INFO: FileInfo = "FILE_INFO"
export const READ_EXIF: ReadExif = "READ_EXIF"
export const REMOTE: Remote = "REMOTE"
export const STAGE: Stage = "STAGE"
export const CONTROLLER: Controller = "CONTROLLER"
export const OUTPUT_STREAM: OutputStream = "OUTPUT_STREAM"
export const CLOUD: Cloud = "CLOUD"
export const RECORDER: Recorder = "RECORDER"
export const NDI: Ndi = "NDI"

export type Startup = "STARTUP"
export type Main = "MAIN"
export type Store = "STORE"
export type Show = "SHOW"
export type Bible = "BIBLE"
export type OutputData = "OUTPUT"
export type Import = "IMPORT"
export type Export = "EXPORT"
export type OpenFile = "OPEN_FILE"
export type OpenFolder = "OPEN_FOLDER"
export type ReadFolder = "READ_FOLDER"
export type FileInfo = "FILE_INFO"
export type ReadExif = "READ_EXIF"
export type Remote = "REMOTE"
export type Stage = "STAGE"
export type Controller = "CONTROLLER"
export type OutputStream = "OUTPUT_STREAM"
export type Cloud = "CLOUD"
export type Recorder = "RECORDER"
export type Ndi = "NDI"

export type ValidChannels = Startup | Main | Store | Show | Bible | OutputData | Import | Export | OpenFile | OpenFolder | ReadFolder | Remote | Stage | Controller | OutputStream | Cloud | Ndi

export type Data = string | DataObject
export interface DataObject {
    id: string
    data: any
}

// export interface StageData {
//   connection?: string
// }
