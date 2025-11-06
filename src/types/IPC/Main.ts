import type { Display } from "electron"
import type { ExifData } from "exif"
import type { Stats } from "fs"
import type { Bible } from "json-bible/lib/Bible"
import type os from "os"
import type { ContentFile, ContentLibraryCategory, ContentProviderId } from "../../electron/contentProviders/base/types"
import type { stores } from "../../electron/data/store"
import type { ErrorLog, FileData, LessonsData, LyricSearchResult, MainFilePaths, Media, OS, Subtitle } from "../Main"
import type { Output } from "../Output"
import type { Folders, Projects } from "../Projects"
import type { Dictionary, Resolution, Themes } from "../Settings"
import type { Overlays, Show, Shows, Templates, TrimmedShows } from "../Show"
import type { ServerData } from "../Socket"
import type { StageLayouts } from "../Stage"
import type { Event } from "./../Calendar"
import type { History } from "./../History"
import type { SaveData, SaveListSyncedSettings } from "./../Save"

export const MAIN = "MAIN"

export enum Main {
    // DEV
    LOG = "LOG",
    IS_DEV = "IS_DEV",
    GET_TEMP_PATHS = "GET_TEMP_PATHS",
    // APP
    VERSION = "VERSION",
    GET_OS = "GET_OS",
    DEVICE_ID = "DEVICE_ID",
    IP = "IP",
    // STORES
    SETTINGS = "SETTINGS",
    SYNCED_SETTINGS = "SYNCED_SETTINGS",
    STAGE_SHOWS = "STAGE_SHOWS",
    PROJECTS = "PROJECTS",
    OVERLAYS = "OVERLAYS",
    TEMPLATES = "TEMPLATES",
    EVENTS = "EVENTS",
    MEDIA = "MEDIA",
    THEMES = "THEMES",
    DRIVE_API_KEY = "DRIVE_API_KEY",
    HISTORY = "HISTORY",
    USAGE = "USAGE",
    CACHE = "CACHE",
    // WINDOW
    CLOSE = "CLOSE",
    MAXIMIZE = "MAXIMIZE",
    MAXIMIZED = "MAXIMIZED",
    MINIMIZE = "MINIMIZE",
    FULLSCREEN = "FULLSCREEN",
    /////
    IMPORT = "IMPORT",
    BIBLE = "BIBLE",
    SHOW = "SHOW",
    SAVE = "SAVE",
    ///////////////////
    SPELLCHECK = "SPELLCHECK",
    ////
    SHOWS = "SHOWS",
    AUTO_UPDATE = "AUTO_UPDATE",
    URL = "URL",
    LANGUAGE = "LANGUAGE",
    GET_PATHS = "GET_PATHS",
    SHOWS_PATH = "SHOWS_PATH",
    DATA_PATH = "DATA_PATH",
    LOG_ERROR = "LOG_ERROR",
    OPEN_LOG = "OPEN_LOG",
    OPEN_CACHE = "OPEN_CACHE",
    OPEN_APPDATA = "OPEN_APPDATA",
    OPEN_FOLDER_PATH = "OPEN_FOLDER_PATH",
    GET_STORE_VALUE = "GET_STORE_VALUE",
    SET_STORE_VALUE = "SET_STORE_VALUE",
    DELETE_SHOWS = "DELETE_SHOWS",
    DELETE_SHOWS_NI = "DELETE_SHOWS_NI",
    REFRESH_SHOWS = "REFRESH_SHOWS",
    GET_EMPTY_SHOWS = "GET_EMPTY_SHOWS",
    FULL_SHOWS_LIST = "FULL_SHOWS_LIST",
    GET_SCREENS = "GET_SCREENS",
    GET_WINDOWS = "GET_WINDOWS",
    GET_DISPLAYS = "GET_DISPLAYS",
    OUTPUT = "OUTPUT",
    DOES_MEDIA_EXIST = "DOES_MEDIA_EXIST",
    GET_THUMBNAIL = "GET_THUMBNAIL",
    SAVE_IMAGE = "SAVE_IMAGE",
    PDF_TO_IMAGE = "PDF_TO_IMAGE",
    READ_EXIF = "READ_EXIF",
    MEDIA_CODEC = "MEDIA_CODEC",
    MEDIA_TRACKS = "MEDIA_TRACKS",
    DOWNLOAD_LESSONS_MEDIA = "DOWNLOAD_LESSONS_MEDIA",
    MEDIA_DOWNLOAD = "MEDIA_DOWNLOAD",
    MEDIA_IS_DOWNLOADED = "MEDIA_IS_DOWNLOADED",
    NOW_PLAYING = "NOW_PLAYING",
    NOW_PLAYING_UNSET = "NOW_PLAYING_UNSET",
    // MEDIA_BASE64 = "MEDIA_BASE64",
    CAPTURE_SLIDE = "CAPTURE_SLIDE",
    ACCESS_CAMERA_PERMISSION = "ACCESS_CAMERA_PERMISSION",
    ACCESS_MICROPHONE_PERMISSION = "ACCESS_MICROPHONE_PERMISSION",
    ACCESS_SCREEN_PERMISSION = "ACCESS_SCREEN_PERMISSION",
    LIBREOFFICE_CONVERT = "LIBREOFFICE_CONVERT",
    SLIDESHOW_GET_APPS = "SLIDESHOW_GET_APPS",
    START_SLIDESHOW = "START_SLIDESHOW",
    PRESENTATION_CONTROL = "PRESENTATION_CONTROL",
    START = "START",
    STOP = "STOP",
    SERVER_DATA = "SERVER_DATA",
    WEBSOCKET_START = "WEBSOCKET_START",
    WEBSOCKET_STOP = "WEBSOCKET_STOP",
    API_TRIGGER = "API_TRIGGER",
    EMIT_OSC = "EMIT_OSC",
    GET_MIDI_OUTPUTS = "GET_MIDI_OUTPUTS",
    GET_MIDI_INPUTS = "GET_MIDI_INPUTS",
    SEND_MIDI = "SEND_MIDI",
    RECEIVE_MIDI = "RECEIVE_MIDI",
    CLOSE_MIDI = "CLOSE_MIDI",
    GET_LYRICS = "GET_LYRICS",
    SEARCH_LYRICS = "SEARCH_LYRICS",
    RESTORE = "RESTORE",
    SYSTEM_OPEN = "SYSTEM_OPEN",
    DOES_PATH_EXIST = "DOES_PATH_EXIST",
    UPDATE_DATA_PATH = "UPDATE_DATA_PATH",
    LOCATE_MEDIA_FILE = "LOCATE_MEDIA_FILE",
    GET_SIMULAR = "GET_SIMULAR",
    BUNDLE_MEDIA_FILES = "BUNDLE_MEDIA_FILES",
    FILE_INFO = "FILE_INFO",
    READ_FOLDER = "READ_FOLDER",
    READ_FOLDERS = "READ_FOLDERS",
    READ_FILE = "READ_FILE",
    OPEN_FOLDER = "OPEN_FOLDER",
    OPEN_FILE = "OPEN_FILE",
    // Provider-based routing
    PROVIDER_LOAD_SERVICES = "PROVIDER_LOAD_SERVICES",
    PROVIDER_DISCONNECT = "PROVIDER_DISCONNECT",
    PROVIDER_STARTUP_LOAD = "PROVIDER_STARTUP_LOAD",
    // Content Library
    GET_CONTENT_PROVIDERS = "GET_CONTENT_PROVIDERS",
    GET_CONTENT_LIBRARY = "GET_CONTENT_LIBRARY",
    GET_PROVIDER_CONTENT = "GET_PROVIDER_CONTENT"
}

export interface MainSendPayloads {
    // DEV
    [Main.LOG]: any
    /////
    [Main.IMPORT]: { channel: string; format: { name: string; extensions: string[] }; settings?: any }
    [Main.BIBLE]: { id: string; path: string; name: string }
    [Main.SHOW]: { id: string; path: string | null; name: string }
    [Main.SAVE]: SaveData
    [Main.SHOWS]: { showsPath: string }
    ////////////
    [Main.SPELLCHECK]: { addToDictionary?: string; fixSpelling?: string }
    [Main.URL]: string
    [Main.LANGUAGE]: { lang: string; strings: Dictionary }
    [Main.LOG_ERROR]: ErrorLog
    [Main.OPEN_FOLDER_PATH]: string
    [Main.GET_STORE_VALUE]: { file: "config" | keyof typeof stores; key: string }
    [Main.SET_STORE_VALUE]: { file: "config" | keyof typeof stores; key: string; value: any }
    [Main.DELETE_SHOWS]: { shows: { id: string; name: string }[]; path: string }
    [Main.DELETE_SHOWS_NI]: { shows: TrimmedShows; path: string }
    [Main.REFRESH_SHOWS]: { path: string }
    [Main.GET_EMPTY_SHOWS]: { path: string; cached: Shows }
    [Main.FULL_SHOWS_LIST]: { path: string }
    [Main.OUTPUT]: "true" | "false"
    [Main.DOES_MEDIA_EXIST]: { path: string; creationTime?: number; noCache?: boolean }
    [Main.GET_THUMBNAIL]: { input: string; size: number }
    [Main.SAVE_IMAGE]: { path: string; base64?: string; filePath?: string[]; format?: "png" | "jpg" }
    [Main.PDF_TO_IMAGE]: { dataPath: string; filePath: string }
    [Main.READ_EXIF]: { id: string }
    [Main.MEDIA_CODEC]: { path: string }
    [Main.MEDIA_TRACKS]: { path: string }
    [Main.DOWNLOAD_LESSONS_MEDIA]: LessonsData[]
    [Main.MEDIA_DOWNLOAD]: { url: string; dataPath: string }
    [Main.MEDIA_IS_DOWNLOADED]: { url: string; dataPath: string }
    [Main.NOW_PLAYING]: { dataPath: string; filePath: string; name: string; unknownLang: string[] }
    [Main.NOW_PLAYING_UNSET]: { dataPath: string }
    // [Main.MEDIA_BASE64]: { id: string; path: string }[]
    [Main.CAPTURE_SLIDE]: { output: { [key: string]: Output }; resolution: Resolution }
    [Main.LIBREOFFICE_CONVERT]: { type: string; dataPath: string }
    [Main.START_SLIDESHOW]: { path: string; program: string }
    [Main.PRESENTATION_CONTROL]: { action: string }
    [Main.START]: { ports: { [key: string]: number }; max: number; disabled: { [key: string]: boolean }; data: { [key: string]: ServerData } }
    [Main.SERVER_DATA]: { [key: string]: any }
    [Main.WEBSOCKET_START]: number
    [Main.API_TRIGGER]: { action: string; returnId: string; data: any }
    [Main.EMIT_OSC]: { signal: any; data: any }
    [Main.GET_MIDI_OUTPUTS]: string[]
    [Main.GET_MIDI_INPUTS]: string[]
    [Main.SEND_MIDI]: any
    [Main.RECEIVE_MIDI]: any
    [Main.CLOSE_MIDI]: { id: string }
    [Main.GET_LYRICS]: { song: LyricSearchResult }
    [Main.SEARCH_LYRICS]: { artist: string; title: string }
    [Main.RESTORE]: { showsPath: string }
    [Main.SYSTEM_OPEN]: string
    [Main.DOES_PATH_EXIST]: { path: string; dataPath: string }
    [Main.UPDATE_DATA_PATH]: { reset: boolean; dataPath: string }

    [Main.LOCATE_MEDIA_FILE]: { fileName: string; splittedPath: string[]; folders: string[]; ref: { showId: string; mediaId: string; cloudId: string } }
    [Main.GET_SIMULAR]: { paths: string[] }
    [Main.BUNDLE_MEDIA_FILES]: { showsPath: string; dataPath: string }
    [Main.FILE_INFO]: string
    [Main.READ_FOLDER]: { path: string; disableThumbnails?: boolean; listFilesInFolders?: boolean }
    [Main.READ_FOLDERS]: { path: string }[]
    [Main.READ_FILE]: { path: string }
    [Main.OPEN_FOLDER]: { channel: string; title?: string; path?: string }
    [Main.OPEN_FILE]: { id: string; channel: string; title?: string; filter: any; multiple: boolean; read?: boolean }
    // Provider-based routing
    [Main.PROVIDER_LOAD_SERVICES]: { providerId: ContentProviderId; dataPath?: string }
    [Main.PROVIDER_DISCONNECT]: { providerId: ContentProviderId; scope?: string }
    [Main.PROVIDER_STARTUP_LOAD]: { providerId: ContentProviderId; scope?: string; data?: any }
    // Content Library
    [Main.GET_CONTENT_LIBRARY]: { providerId: ContentProviderId }
    [Main.GET_PROVIDER_CONTENT]: { providerId: ContentProviderId; key: string }
}

export interface MainReturnPayloads {
    // DEV
    [Main.IS_DEV]: boolean
    [Main.GET_TEMP_PATHS]: { [key: string]: string }
    // APP
    [Main.VERSION]: string
    [Main.GET_OS]: OS
    [Main.DEVICE_ID]: string
    [Main.IP]: NodeJS.Dict<os.NetworkInterfaceInfo[]>
    ///
    // [Main.SAVE]: { closeWhenFinished: boolean; customTriggers: any } | Promise<void>
    [Main.SHOWS]: TrimmedShows
    // STORES
    [Main.SYNCED_SETTINGS]: { [key in SaveListSyncedSettings]: any }
    [Main.STAGE_SHOWS]: StageLayouts
    [Main.PROJECTS]: { projects: Projects; folders: Folders; projectTemplates: Projects }
    [Main.OVERLAYS]: Overlays
    [Main.TEMPLATES]: Templates
    [Main.EVENTS]: { [key: string]: Event }
    [Main.MEDIA]: Media
    [Main.THEMES]: { [key: string]: Themes }
    [Main.DRIVE_API_KEY]: any
    [Main.HISTORY]: { undo: History[]; redo: History[] }
    [Main.USAGE]: any
    [Main.CACHE]: any
    // WINDOW
    [Main.CLOSE]: boolean | void
    [Main.MAXIMIZED]: boolean
    /////////////////////
    [Main.BIBLE]: { id: string; error?: string; content?: [string, Bible] }
    [Main.SHOW]: { id: string; error?: string; content?: [string, Show] }
    ///
    [Main.GET_DISPLAYS]: Display[]
    [Main.GET_PATHS]: MainFilePaths
    [Main.SHOWS_PATH]: string
    [Main.DATA_PATH]: string
    [Main.GET_STORE_VALUE]: { file: "config" | keyof typeof stores; key: string; value: any }
    [Main.DELETE_SHOWS]: { deleted: string[] }
    [Main.DELETE_SHOWS_NI]: { deleted: string[] } | undefined
    [Main.GET_EMPTY_SHOWS]: Promise<{ id: string; name: string }[] | undefined>
    [Main.FULL_SHOWS_LIST]: string[]
    [Main.GET_SCREENS]: Promise<{ name: string; id: string }[]>
    [Main.GET_WINDOWS]: Promise<{ name: string; id: string }[]>
    [Main.DOES_MEDIA_EXIST]: Promise<{ path: string; exists: boolean; creationTime?: number }>
    [Main.GET_THUMBNAIL]: { output: string; input: string; size: number }
    // [Main.PDF_TO_IMAGE]: Promise<string[]>
    [Main.READ_EXIF]: Promise<{ id: string; exif: ExifData }>
    [Main.MEDIA_CODEC]: Promise<{ path: string; codecs: string[]; mimeType: string; mimeCodec: string }>
    [Main.MEDIA_TRACKS]: Promise<{ path: string; tracks: Subtitle[] }>
    [Main.MEDIA_IS_DOWNLOADED]: Promise<{ path: string; buffer: Buffer | null } | null>
    // [Main.MEDIA_BASE64]: { id: string; content: string }[]
    [Main.CAPTURE_SLIDE]: Promise<{ base64: string } | undefined>
    [Main.SLIDESHOW_GET_APPS]: string[]
    [Main.GET_MIDI_OUTPUTS]: { name: string }[]
    [Main.GET_MIDI_INPUTS]: { name: string }[]
    [Main.GET_LYRICS]: Promise<{ lyrics: string; source: string; title: string; artist: string }>
    [Main.SEARCH_LYRICS]: Promise<LyricSearchResult[]>
    [Main.DOES_PATH_EXIST]: { path: string; dataPath: string; exists: boolean }
    [Main.GET_SIMULAR]: { path: string; name: string }[]
    [Main.LOCATE_MEDIA_FILE]: Promise<{ path: string; ref: { showId: string; mediaId: string; cloudId: string } } | undefined>
    [Main.FILE_INFO]: { path: string; stat: Stats; extension: string; folder: boolean } | null
    [Main.READ_FOLDER]: { path: string; files: FileData[]; filesInFolders: any[]; folderFiles: { [key: string]: any[] } }
    [Main.READ_FOLDERS]: Promise<{ [key: string]: FileData[] }>
    [Main.READ_FILE]: { content: string }
    // Provider-based routing
    [Main.PROVIDER_DISCONNECT]: { success: boolean }
    // Content Library
    [Main.GET_CONTENT_PROVIDERS]: { providerId: ContentProviderId; displayName: string; hasContentLibrary: boolean }[]
    [Main.GET_CONTENT_LIBRARY]: Promise<ContentLibraryCategory[]>
    [Main.GET_PROVIDER_CONTENT]: Promise<ContentFile[]>
}

///////////

export type ToMainSendValue2<ID extends Main> = ID extends keyof MainReturnPayloads ? MainReturnPayloads[ID] : never
export type MainSendValue<ID extends Main> = ID extends keyof MainSendPayloads ? MainSendPayloads[ID] : never

export type MainReceiveData<ID extends Main> = ID extends keyof MainSendPayloads ? MainSendPayloads[ID] : undefined
export type MainReceiveValue<ID extends Main = Main> = {
    channel: ID
    data: MainReceiveData<ID>
}

type MainHandler<ID extends Main> = (data: ID extends keyof MainSendPayloads ? MainSendPayloads[ID] : undefined, e: Electron.IpcMainEvent) => ID extends keyof MainReturnPayloads ? MainReturnPayloads[ID] : void
export type MainResponses = {
    [ID in Main]: MainHandler<ID>
}
