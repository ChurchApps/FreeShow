// MAIN
export const STARTUP = "STARTUP"
export const STORE = "STORE"
export const MAIN = "MAIN"
export const SHOW = "SHOW"
export const BIBLE = "BIBLE"
export const OUTPUT = "OUTPUT"
export const IMPORT = "IMPORT"
export const EXPORT = "EXPORT"
// SERVERS
export const REMOTE = "REMOTE"
export const STAGE = "STAGE"
export const CONTROLLER = "CONTROLLER"
export const OUTPUT_STREAM = "OUTPUT_STREAM"
// SPECIAL
export const CLOUD = "CLOUD"
export const RECORDER = "RECORDER"
export const NDI = "NDI"
export const API_DATA = "API_DATA"
// FILES (FRONTEND ONLY RECEIVERS)
export const OPEN_FILE = "OPEN_FILE"
export const OPEN_FOLDER = "OPEN_FOLDER"
export const READ_FOLDER = "READ_FOLDER"
export const FILE_INFO = "FILE_INFO"

export type ValidChannels =
    | "STARTUP"
    | "STORE"
    | "MAIN"
    | "SHOW"
    | "BIBLE"
    | "OUTPUT"
    | "IMPORT"
    | "EXPORT"
    | "REMOTE"
    | "STAGE"
    | "CONTROLLER"
    | "OUTPUT_STREAM"
    | "CLOUD"
    | "RECORDER"
    | "NDI"
    | "API_DATA"
    | "OPEN_FILE"
    | "OPEN_FOLDER"
    | "READ_FOLDER"
    | "FILE_INFO"

export type Data = string | DataObject
export interface DataObject {
    id: string
    data: any
}
