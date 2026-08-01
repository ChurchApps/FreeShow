import type { Display } from "electron"
import type { ExifData } from "exif"
import type { Stats } from "fs"
import type { Bible } from "json-bible/lib/Bible"
import type { SyncProviderId } from "../../electron/cloud/syncManager"
import type { ContentFile, ContentLibraryCategory, ContentProviderId, MediaLicense } from "../../electron/contentProviders/base/types"
import type { PCOFolderTreeNode } from "../../electron/contentProviders/planningCenter/request"
import type { _store } from "../../electron/data/store"
import type { TimecodeMode } from "../../electron/timecode/timecode"
import type { ErrorLog, FileFolder, LessonsData, LyricSearchResult, MainFilePaths, Media, OS, SpotifyState, Subtitle } from "../Main"
import type { Output } from "../Output"
import type { Folders, Projects } from "../Projects"
import type { Dictionary, Resolution, Themes } from "../Settings"
import type { Overlays, Show, Shows, Templates, TrimmedShows } from "../Show"
import type { ServerData } from "../Socket"
import type { StageLayouts } from "../Stage"
import type { Event } from "./../Calendar"
import type { History } from "./../History"
import type { SaveData, SaveListSyncedSettings } from "./../Save"

// enum + MAIN const are declared in ./channels (no imports) and re-exported here
// so the channel enum can be consumed without pulling in the payload/Electron types below.
export { MAIN, Main } from "./channels"
import { Main } from "./channels"

export interface MainSendPayloads {
    // DEV
    [Main.LOG]: any
    /////
    [Main.IMPORT]: { channel: string; format: { name: string; extensions: string[] }; settings?: any }
    [Main.IMPORT_FILES]: { id: string; paths: string[] }
    [Main.BIBLE]: { id: string; name: string }
    [Main.SHOW]: { id: string; name: string }
    [Main.SAVE]: SaveData
    ////////////
    [Main.DELETE_BACKUP]: { path: string }
    [Main.SPELLCHECK]: { addToDictionary?: string; fixSpelling?: string }
    [Main.URL]: string
    [Main.LANGUAGE]: { lang: string; strings: Dictionary }
    [Main.UPDATE_DATA_PATH]: { newPath: string; oldPath: string }
    [Main.LOG_ERROR]: ErrorLog
    [Main.OPEN_FOLDER_PATH]: string
    [Main.GET_STORE_VALUE]: { file: "config" | keyof typeof _store; key: string }
    [Main.SET_STORE_VALUE]: { file: "config" | keyof typeof _store; key: string; value: any }
    [Main.DELETE_SHOWS]: { shows: { id: string; name: string }[] }
    [Main.DELETE_SHOWS_NI]: { shows: TrimmedShows }
    [Main.GET_EMPTY_SHOWS]: { cached: Shows }
    [Main.OUTPUT]: "true" | "false"
    [Main.DOES_MEDIA_EXIST]: { path: string; creationTime?: number; noCache?: boolean }
    [Main.GET_THUMBNAIL]: { input: string; size: number }
    [Main.SAVE_IMAGE]: { id?: string; path?: string; base64?: string; buffer?: ArrayBuffer; filePath?: string[]; format?: "png" | "jpg"; openFolder?: boolean }
    [Main.PDF_TO_IMAGE]: { filePath: string }
    [Main.READ_EXIF]: { id: string }
    [Main.MEDIA_CODEC]: { path: string }
    [Main.MEDIA_TRACKS]: { path: string }
    [Main.DOWNLOAD_LESSONS_MEDIA]: LessonsData[]
    [Main.MEDIA_DOWNLOAD]: { url: string; contentFile?: any }
    [Main.MEDIA_IS_DOWNLOADED]: { url: string; contentFile?: any }
    [Main.NOW_PLAYING]: { filePath: string; name: string; unknownLang: string[]; format: string; duration: number }
    // [Main.MEDIA_BASE64]: { id: string; path: string }[]
    [Main.READ_AUDIO_METADATA]: { filePath: string }
    [Main.CAPTURE_SLIDE]: { output: { [key: string]: Output }; resolution: Resolution }
    [Main.LIBREOFFICE_CONVERT]: { type: string }
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
    [Main.RESTORE]?: { path: string }
    [Main.RECORDER]: { blob: ArrayBuffer; name: string }
    [Main.SYSTEM_OPEN]: string

    [Main.LOCATE_MEDIA_FILE]: { filePath: string; folders: string[] }
    [Main.SET_MEDIA_FOLDER_PATH]: string
    [Main.GET_SIMILAR]: { paths: string[] }
    [Main.BUNDLE_MEDIA_FILES]: { openFolder?: boolean; outputPath?: string }
    [Main.MEDIA_FOLDER_COPY]: { paths: string[] }
    [Main.FILE_INFO]: string
    [Main.READ_FOLDER]: { path: string | string[]; depth?: number; generateThumbnails?: boolean; captureFolderContent?: boolean }
    [Main.READ_FILE]: { path: string }
    [Main.CREATE_FOLDER]: { path: string; name: string }
    [Main.OPEN_FOLDER]: { channel: string; title?: string; path?: string }
    [Main.OPEN_FILE]: { id: string; channel: string; title?: string; filter: any; multiple: boolean; read?: boolean }
    // SYNC
    [Main.CAN_SYNC]?: { id: SyncProviderId }
    [Main.GET_TEAMS]?: { id: SyncProviderId }
    [Main.CLOUD_DATA]: { id: SyncProviderId; churchId: string; teamId: string }
    [Main.CLOUD_CHANGED]: { id: SyncProviderId; churchId: string; teamId: string }
    [Main.CLOUD_SYNC]: { id: SyncProviderId; churchId: string; teamId: string; method: "merge" | "read_only" | "upload" | "replace" }
    [Main.RESTORE_CLOUD_BACKUP]: { id: SyncProviderId; churchId: string; teamId: string }
    [Main.GET_CONVERSATION_ID]: { teamId: string }
    [Main.SEND_SOCKET_MESSAGE]: { churchId: string; teamId: string; displayName: string; content: string }
    // Provider-based routing
    [Main.PROVIDER_LOAD_SERVICES]: { providerId: ContentProviderId; cloudOnly?: boolean; data?: any }
    [Main.PROVIDER_DISCONNECT]: { providerId: ContentProviderId; scope?: string }
    [Main.PROVIDER_STARTUP_LOAD]: { providerId: ContentProviderId; scope?: string; data?: any; cloudOnly?: boolean }
    [Main.PROVIDER_FETCH_FOLDERS]: { providerId: ContentProviderId }
    [Main.PCO_LIVE_GET]: { serviceTypeId: string; planId: string }
    [Main.PCO_PUSHER_AUTH]: { socketId: string; channelName: string; serviceTypeId: string }
    [Main.PCO_FETCH_SERVICE_TREE]: undefined
    [Main.PCO_LOAD_PLAN]: { serviceTypeId: string; planId: string }
    // Content Library
    [Main.GET_CONTENT_LIBRARY]: { providerId: ContentProviderId }
    [Main.GET_PROVIDER_CONTENT]: { providerId: ContentProviderId; key: string }
    [Main.CHECK_MEDIA_LICENSE]: { providerId: ContentProviderId; mediaId: string }
    // Timecode
    [Main.TIMECODE_START]: { type: "send" | "receive"; mode: TimecodeMode; framerate?: number; data?: any }
    [Main.TIMECODE_VALUE]: number
    [Main.TIMECODE_STATUS]: "play" | "pause" | "stop"
    [Main.TIMECODE_AUDIO_DATA]: { mode: TimecodeMode; buffer: Uint8Array }
    // Spotify
    [Main.SPOTIFY_GET_STATE]: undefined
    [Main.SPOTIFY_COMMAND]: { command: "playpause" | "next" | "prev" | "seek" | "setVolume" | "pause"; value?: number }
    // FFmpeg
    [Main.FFMPEG_CHECK]: undefined
    [Main.FFMPEG_DOWNLOAD]: undefined
}

export interface MainReturnPayloads {
    // DEV
    [Main.IS_DEV]: boolean
    [Main.GET_CACHE_PATH]: string
    // APP
    [Main.VERSION]: string
    [Main.GET_OS]: OS
    [Main.DEVICE_ID]: string
    [Main.GET_DEVICE_NAME]: string
    [Main.IP]: string[]
    [Main.CHECK_RAM_USAGE]: { total: number; free: number; performanceMode: boolean }
    ///
    // [Main.SAVE]: { closeWhenFinished: boolean; customTriggers: any } | Promise<void>
    [Main.BACKUPS]: { path: string; name: string; date: number; size: number }[]
    [Main.SHOWS]: TrimmedShows
    // STORES
    [Main.SYNCED_SETTINGS]: { [key in SaveListSyncedSettings]: any }
    [Main.STAGE]: StageLayouts
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
    [Main.DATA_PATH]: string
    [Main.GET_STORE_VALUE]: any
    [Main.DELETE_SHOWS]: { deleted: string[] }
    [Main.DELETE_SHOWS_NI]: { deleted: string[] } | undefined
    [Main.GET_EMPTY_SHOWS]: Promise<{ id: string; name: string }[] | undefined>
    [Main.FULL_SHOWS_LIST]: string[]
    [Main.GET_SCREENS]: Promise<{ name: string; id: string }[]>
    [Main.GET_WINDOWS]: Promise<{ name: string; id: string }[]>
    [Main.DOES_MEDIA_EXIST]: Promise<{ path: string; exists: boolean; creationTime?: number }>
    [Main.GET_THUMBNAIL]: Promise<{ output: string; input: string; size: number }>
    // [Main.PDF_TO_IMAGE]: Promise<string[]>
    [Main.READ_EXIF]: Promise<{ id: string; exif: ExifData | undefined }>
    [Main.MEDIA_CODEC]: Promise<{ path: string; codecs: string[]; mimeType: string; mimeCodec: string }>
    [Main.MEDIA_TRACKS]: Promise<{ path: string; tracks: Subtitle[] }>
    [Main.MEDIA_IS_DOWNLOADED]: Promise<{ path: string; buffer: Buffer | null; protectedUrl?: string | null; isDownloading?: boolean } | null>
    // [Main.MEDIA_BASE64]: { id: string; content: string }[]
    [Main.READ_AUDIO_METADATA]: Promise<any>
    [Main.CAPTURE_SLIDE]: Promise<{ base64: string } | null>
    [Main.SLIDESHOW_GET_APPS]: string[]
    [Main.GET_MIDI_OUTPUTS]: { name: string }[]
    [Main.GET_MIDI_INPUTS]: { name: string }[]
    [Main.GET_LYRICS]: Promise<{ lyrics: string; source: string; title: string; artist: string }>
    [Main.SEARCH_LYRICS]: Promise<LyricSearchResult[]>
    [Main.GET_SIMILAR]: { path: string; name: string }[]
    [Main.RESTORE_CLOUD_BACKUP]: Promise<{ success: boolean; error?: string }>
    [Main.MEDIA_FOLDER_COPY]: Promise<boolean>
    [Main.LOCATE_MEDIA_FILE]: Promise<{ path: string; hasChanged: boolean } | null>
    [Main.GET_MEDIA_FOLDER_PATH]: string
    [Main.READ_BIBLES_FOLDER]: { path: string; name: string }[]
    [Main.FILE_INFO]: { path: string; stat: Stats; extension: string; folder: boolean } | null
    [Main.READ_FOLDER]: Promise<{ [key: string]: FileFolder }>
    [Main.CREATE_FOLDER]: string
    [Main.READ_FILE]: { content: string }
    // SYNC
    [Main.CAN_SYNC]: Promise<boolean>
    [Main.GET_TEAMS]: Promise<{ id: string; churchId: string; name: string }[]>
    [Main.CLOUD_DATA]: Promise<boolean>
    [Main.CLOUD_CHANGED]: Promise<boolean>
    [Main.CLOUD_SYNC]: Promise<{ success?: boolean; error?: string; changedFiles?: any[] }>
    [Main.GET_CONVERSATION_ID]: Promise<string | null>
    [Main.SEND_SOCKET_MESSAGE]: Promise<boolean>
    // Provider-based routing
    [Main.PROVIDER_DISCONNECT]: { success: boolean }
    [Main.PROVIDER_FETCH_FOLDERS]: Promise<PCOFolderTreeNode[]>
    [Main.PCO_FETCH_SERVICE_TREE]: Promise<PCOFolderTreeNode[]>
    [Main.PCO_LIVE_GET]: Promise<{ liveId: string | null; liveChannel: string | null; orgId: string | null; liveStartAt: string | null; liveEndAt: string | null; length: number | null; isPreService: boolean; serviceStartAt: string | null; serviceEndAt: string | null } | null>
    [Main.PCO_PUSHER_AUTH]: Promise<{ auth: string; channel_data?: string } | null>
    // Content Library
    [Main.GET_CONTENT_PROVIDERS]: { providerId: ContentProviderId; displayName: string; hasContentLibrary: boolean }[]
    [Main.GET_CONTENT_LIBRARY]: Promise<ContentLibraryCategory[]>
    [Main.GET_PROVIDER_CONTENT]: Promise<ContentFile[]>
    [Main.CHECK_MEDIA_LICENSE]: Promise<MediaLicense | null>
    // Timecode
    [Main.TIMECODE_VALUE]: number | void
    [Main.TIMECODE_AUDIO_DATA]: Buffer | void
    [Main.TIMECODE_STATUS]: "play" | "pause" | "stop" | void
    // Spotify
    [Main.SPOTIFY_GET_STATE]: Promise<SpotifyState | null>
    [Main.SPOTIFY_COMMAND]: Promise<boolean>
    // FFmpeg
    [Main.FFMPEG_CHECK]: { installed: boolean; path?: string }
    [Main.FFMPEG_DOWNLOAD]: Promise<{ success: boolean; error?: string }>
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
