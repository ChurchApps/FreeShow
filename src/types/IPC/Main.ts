import type { SaveData } from "./../Save"

export const MAIN = "MAIN"

export enum Main {
    SAVE = "SAVE",
}

export interface MainSendPayloads {
    [Main.SAVE]: SaveData
}
export interface MainReturnPayloads {
    [Main.SAVE]: undefined
}

export type MainSendValue<ID extends Main, V> = ID extends keyof MainSendPayloads ? (MainSendPayloads[ID] extends V ? V : never) : never
export type MainReceiveValue = {
    // channel: keyof typeof Main
    channel: Main
    data: MainSendPayloads[Main]
}
