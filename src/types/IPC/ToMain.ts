import type { ICommonTagsResult } from "music-metadata"
import type { ContentProviderId } from "../../electron/contentProviders/base/types"
import type { TrimmedShows } from "../Show"

// enum declared in ./channels (no imports) and re-exported so it can be consumed
// without pulling in the payload/Electron types below.
export { ToMain } from "./channels"
import { ToMain } from "./channels"

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
