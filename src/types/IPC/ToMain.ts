export enum ToMain {
    ALERT = "ALERT",
    TOAST = "TOAST",
    MENU = "MENU",
    BACKUP = "BACKUP",
    PRESENTATION_STATE = "PRESENTATION_STATE",
    CAPTURE_CANVAS = "CAPTURE_CANVAS",
    LESSONS_DONE = "LESSONS_DONE",
    IMAGES_TO_SHOW = "IMAGES_TO_SHOW",
    PCO_CONNECT = "PCO_CONNECT",
    PCO_PROJECTS = "PCO_PROJECTS",
    // Main
    SAVE2 = "SAVE",
    REFRESH_SHOWS2 = "REFRESH_SHOWS",
    RESTORE2 = "RESTORE",
    API_TRIGGER2 = "API_TRIGGER",
    OPEN_FOLDER2 = "OPEN_FOLDER",
    OPEN_FILE2 = "OPEN_FILE",
}
export interface ToMainSendPayloads {
    [ToMain.ALERT]: string
    [ToMain.TOAST]: string
    [ToMain.MENU]: string
    [ToMain.BACKUP]: { finished: boolean; path: string }
    [ToMain.PRESENTATION_STATE]: { stat: any; info: any }
    [ToMain.CAPTURE_CANVAS]: { input: string; output: string; size: any; extension: string; config: any }
    [ToMain.LESSONS_DONE]: { showId: string; status: { finished: number; failed: number } }
    [ToMain.IMAGES_TO_SHOW]: { images: string[]; name: string }
    [ToMain.PCO_CONNECT]: { success: boolean; isFirstConnection?: boolean }
    [ToMain.PCO_PROJECTS]: { shows: any; projects: any }
    ///
    [ToMain.SAVE2]: { closeWhenFinished: boolean; customTriggers: any }
    [ToMain.REFRESH_SHOWS2]: { [key: string]: any }
    [ToMain.RESTORE2]: { starting?: boolean; finished?: boolean }
    [ToMain.API_TRIGGER2]: { action: string; returnId: string; data: any }
    [ToMain.OPEN_FOLDER2]: { channel: string; path: string; showsPath?: string }
    [ToMain.OPEN_FILE2]: { channel: string; id: string; files: string[]; content: { [key: string]: string } }
}

///////////

// export type ToMainSendValue<ID extends ToMain, V> = ID extends keyof ToMainSendPayloads ? (ToMainSendPayloads[ID] extends V ? V : never) : never
export type ToMainSendValue<ID extends ToMain, V> = Extract<ToMainSendPayloads[ID], V>

export type ToMainReceiveData<ID extends ToMain> = ID extends keyof ToMainSendPayloads ? ToMainSendPayloads[ID] : undefined
export type ToMainReceiveValue<ID extends ToMain = ToMain> = {
    channel: ID
    data: ToMainReceiveData<ID>
}
