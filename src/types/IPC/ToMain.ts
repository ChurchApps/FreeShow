import type { ICommonTagsResult } from "music-metadata"
import type { ContentProviderId } from "../../electron/contentProviders/base/types"
import type { AiCommandEnvelope } from "../ai/AiCommands"
import type { RtmpStatus } from "../Output"
import type { TrimmedShows } from "../Show"

export enum ToMain {
    ALERT = "ALERT",
    TOAST = "TOAST",
    MENU = "MENU",
    API = "API",
    SPELL_CHECK = "SPELL_CHECK",
    BACKUP = "BACKUP",
    RECENTLY_ADDED_FILES = "RECENTLY_ADDED_FILES",
    PRESENTATION_STATE = "PRESENTATION_STATE",
    CAPTURE_CANVAS = "CAPTURE_CANVAS",
    REPLACE_MEDIA_PATHS = "REPLACE_MEDIA_PATHS",
    LESSONS_DONE = "LESSONS_DONE",
    IMAGES_TO_SHOW = "IMAGES_TO_SHOW",
    MEDIA_DOWNLOAD_PROGRESS = "MEDIA_DOWNLOAD_PROGRESS",
    PDF_IMPORT_PROGRESS = "PDF_IMPORT_PROGRESS",
    RTMP_STATUS = "RTMP_STATUS",
    GPU_HEALTH = "GPU_HEALTH",
    // AI
    AI_STATUS = "AI_STATUS",
    AI_TRANSCRIPT = "AI_TRANSCRIPT",
    AI_TRANSCRIPT_INTERIM = "AI_TRANSCRIPT_INTERIM",
    AI_COMMAND = "AI_COMMAND",
    // Unified provider callbacks
    PROVIDER_CONNECT = "PROVIDER_CONNECT",
    PROVIDER_PROJECTS = "PROVIDER_PROJECTS",
    WEBSOCKET = "WEBSOCKET",
    AUDIO_METADATA = "AUDIO_METADATA",
    GET_DYNAMIC_VALUES = "GET_DYNAMIC_VALUES",
    // Main
    IMPORT2 = "IMPORT2",
    SHOW2 = "SHOW2",
    SAVE2 = "SAVE2",
    REFRESH_SHOWS2 = "REFRESH_SHOWS2",
    RESTORE2 = "RESTORE2",
    API_TRIGGER2 = "API_TRIGGER2",
    OPEN_FOLDER2 = "OPEN_FOLDER2",
    OPEN_FILE2 = "OPEN_FILE2",
    RECEIVE_MIDI2 = "RECEIVE_MIDI2"
}
export interface ToMainSendPayloads {
    [ToMain.ALERT]: string
    [ToMain.TOAST]: string
    [ToMain.MENU]: string
    [ToMain.API]: { action: string; data?: any }
    [ToMain.SPELL_CHECK]: { misspelled: string; suggestions: string[] }
    [ToMain.BACKUP]: { finished: boolean; path: string }
    [ToMain.RECENTLY_ADDED_FILES]: { paths: string[] }
    [ToMain.PRESENTATION_STATE]: { id: string; stat: any; info: any }
    [ToMain.CAPTURE_CANVAS]: { input: string; output: string; size: any; extension: string; config: any; id: string }
    [ToMain.REPLACE_MEDIA_PATHS]: any[]
    [ToMain.LESSONS_DONE]: { showId: string; status: { finished: number; failed: number } }
    [ToMain.IMAGES_TO_SHOW]: { images: string[]; name: string }
    [ToMain.MEDIA_DOWNLOAD_PROGRESS]: { url: string; progress: number; total: number; status: "downloading" | "complete" | "error"; name?: string }
    [ToMain.PDF_IMPORT_PROGRESS]: { filePath: string; name: string; progress: number; total: number; status: "importing" | "complete" | "error"; message?: string }
    [ToMain.RTMP_STATUS]: { outputId: string; destinations: RtmpStatus }
    [ToMain.GPU_HEALTH]: { issue: "compositing" | "video-decode"; platform: string; vendorName: string; vaDriverMissing: boolean; packages: string[] }
    // Unified provider callbacks
    [ToMain.PROVIDER_CONNECT]: { providerId: ContentProviderId; success: boolean; isFirstConnection?: boolean }
    [ToMain.PROVIDER_PROJECTS]: { providerId: ContentProviderId; categoryName: string; shows: any; projects: any; pcoPlans?: { planId: string; serviceTypeId: string; name: string; date: string }[] }
    [ToMain.WEBSOCKET]: "connected"
    [ToMain.AUDIO_METADATA]: { filePath: string; metadata: ICommonTagsResult }
    [ToMain.GET_DYNAMIC_VALUES]: string[]
    ///
    [ToMain.IMPORT2]: { channel: string; data: ({ content: Buffer | string | object; name?: string; extension?: string } | string)[]; custom?: any }
    [ToMain.SHOW2]: { error?: string; err?: NodeJS.ErrnoException; id: string }
    [ToMain.SAVE2]: { closeWhenFinished: boolean; customTriggers: any }
    [ToMain.REFRESH_SHOWS2]: TrimmedShows
    [ToMain.RESTORE2]: { starting?: boolean; finished?: boolean }
    [ToMain.API_TRIGGER2]: { action: string; returnId: string; data: any }
    [ToMain.OPEN_FOLDER2]: { channel: string; path: string }
    [ToMain.OPEN_FILE2]: { channel: string; id: string; files: string[]; content: { [key: string]: string } }
    [ToMain.RECEIVE_MIDI2]: { id: string; values: any; type: "noteon" | "noteoff" | "control" }
    // AI (WIP)
    [ToMain.AI_STATUS]: { state: "listening" | "stopped" | "error"; message?: string }
    [ToMain.AI_TRANSCRIPT]: { text: string; startMs: number; endMs: number; language?: string; music?: boolean; utteranceEnd?: boolean }
    [ToMain.AI_TRANSCRIPT_INTERIM]: { text: string }
    [ToMain.AI_COMMAND]: AiCommandEnvelope
}

export interface ToMainReturnPayloads {
    [ToMain.API]: Promise<any>
    [ToMain.GET_DYNAMIC_VALUES]: Promise<{ [key: string]: string }>
}

///////////

// export type ToMainSendValue<ID extends ToMain, V> = ID extends keyof ToMainSendPayloads ? (ToMainSendPayloads[ID] extends V ? V : never) : never
// export type ToMainSendValue<ID extends ToMain, V> = Extract<, V>
export type ToMainSendValue<ID extends ToMain> = ID extends keyof ToMainSendPayloads ? ToMainSendPayloads[ID] : never

export type ToMainReceiveData<ID extends ToMain> = ID extends keyof ToMainSendPayloads ? ToMainSendPayloads[ID] : undefined
export type ToMainReceiveValue<ID extends ToMain = ToMain> = {
    channel: ID
    data: ToMainReceiveData<ID>
}
