import type { TrimmedShows } from "../Show"

export enum ToMain {
  ALERT = "ALERT",
  TOAST = "TOAST",
  MENU = "MENU",
  SPELL_CHECK = "SPELL_CHECK",
  BACKUP = "BACKUP",
  PRESENTATION_STATE = "PRESENTATION_STATE",
  CAPTURE_CANVAS = "CAPTURE_CANVAS",
  REPLACE_MEDIA_PATHS = "REPLACE_MEDIA_PATHS",
  LESSONS_DONE = "LESSONS_DONE",
  IMAGES_TO_SHOW = "IMAGES_TO_SHOW",
  PCO_CONNECT = "PCO_CONNECT",
  PCO_PROJECTS = "PCO_PROJECTS",
  CHUMS_CONNECT = "CHUMS_CONNECT",
  CHUMS_PROJECTS = "CHUMS_PROJECTS",
  API = "API",
  // Main
  IMPORT2 = "IMPORT2",
  SHOW2 = "SHOW2",
  SAVE2 = "SAVE2",
  REFRESH_SHOWS2 = "REFRESH_SHOWS2",
  RESTORE2 = "RESTORE2",
  API_TRIGGER2 = "API_TRIGGER2",
  OPEN_FOLDER2 = "OPEN_FOLDER2",
  OPEN_FILE2 = "OPEN_FILE2",
  RECEIVE_MIDI2 = "RECEIVE_MIDI2",
}
export interface ToMainSendPayloads {
  [ToMain.ALERT]: string
  [ToMain.TOAST]: string
  [ToMain.MENU]: string
  [ToMain.SPELL_CHECK]: { misspelled: string; suggestions: string[] }
  [ToMain.BACKUP]: { finished: boolean; path: string }
  [ToMain.PRESENTATION_STATE]: { id: string; stat: any; info: any }
  [ToMain.CAPTURE_CANVAS]: { input: string; output: string; size: any; extension: string; config: any }
  [ToMain.REPLACE_MEDIA_PATHS]: any[]
  [ToMain.LESSONS_DONE]: { showId: string; status: { finished: number; failed: number } }
  [ToMain.IMAGES_TO_SHOW]: { images: string[]; name: string }
  [ToMain.PCO_CONNECT]: { success: boolean; isFirstConnection?: boolean }
  [ToMain.PCO_PROJECTS]: { shows: any; projects: any }
  [ToMain.CHUMS_CONNECT]: { success: boolean; isFirstConnection?: boolean }
  [ToMain.CHUMS_PROJECTS]: { shows: any; projects: any }
  [ToMain.API]: "connected"
  ///
  [ToMain.IMPORT2]: { channel: string; data: ({ content: Buffer | string; name?: string; extension?: string } | string)[]; custom?: any }
  [ToMain.SHOW2]: { error?: string; err?: NodeJS.ErrnoException; id: string }
  [ToMain.SAVE2]: { closeWhenFinished: boolean; customTriggers: any }
  [ToMain.REFRESH_SHOWS2]: TrimmedShows
  [ToMain.RESTORE2]: { starting?: boolean; finished?: boolean }
  [ToMain.API_TRIGGER2]: { action: string; returnId: string; data: any }
  [ToMain.OPEN_FOLDER2]: { channel: string; path: string; showsPath?: string }
  [ToMain.OPEN_FILE2]: { channel: string; id: string; files: string[]; content: { [key: string]: string } }
  [ToMain.RECEIVE_MIDI2]: { id: string; values: any; type: "noteon" | "noteoff" }
}

///////////

// export type ToMainSendValue<ID extends ToMain, V> = ID extends keyof ToMainSendPayloads ? (ToMainSendPayloads[ID] extends V ? V : never) : never
export type ToMainSendValue<ID extends ToMain, V> = Extract<ToMainSendPayloads[ID], V>

export type ToMainReceiveData<ID extends ToMain> = ID extends keyof ToMainSendPayloads ? ToMainSendPayloads[ID] : undefined
export type ToMainReceiveValue<ID extends ToMain = ToMain> = {
  channel: ID
  data: ToMainReceiveData<ID>
}
