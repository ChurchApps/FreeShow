import type { Media, OS } from "../Main"
import type { Folders, Projects } from "../Projects"
import type { Themes } from "../Settings"
import type { Overlays, Templates } from "../Show"
import type { StageLayouts } from "../Stage"
import type { Event } from "./../Calendar"
import type { History } from "./../History"
import type { SaveData, SaveListSyncedSettings } from "./../Save"

export const MAIN = "MAIN"

export enum Main {
    // GENERAL
    VERSION = "VERSION",
    IS_DEV = "IS_DEV",
    GET_OS = "GET_OS",
    GET_TEMP_PATHS = "GET_TEMP_PATHS",
    DEVICE_ID = "DEVICE_ID",
    MAXIMIZED = "MAXIMIZED",
    // STORES
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
    /////
    SAVE = "SAVE",
}

export interface MainSendPayloads {
    [Main.SAVE]: SaveData
}
export interface MainReturnPayloads {
    // GENERAL
    [Main.VERSION]: string
    [Main.IS_DEV]: boolean
    [Main.GET_OS]: OS
    [Main.GET_TEMP_PATHS]: { [key: string]: string }
    [Main.DEVICE_ID]: string
    [Main.MAXIMIZED]: boolean
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
}

///////////

export type MainSendData<ID extends Main> = ID extends keyof MainReturnPayloads ? MainReturnPayloads[ID] : undefined
export type MainSendValue<ID extends Main, V> = ID extends keyof MainSendPayloads ? (MainSendPayloads[ID] extends V ? V : never) : never

export type MainReceiveData<ID extends Main> = ID extends keyof MainSendPayloads ? MainSendPayloads[ID] : undefined
export type MainReceiveValue<ID extends Main = Main> = {
    channel: ID
    data: MainReceiveData<ID>
}

type MainHandler<ID extends Main> = (data: ID extends keyof MainSendPayloads ? MainSendPayloads[ID] : undefined) => ID extends keyof MainReturnPayloads ? MainReturnPayloads[ID] : void
export type MainResponses = {
    [ID in Main]: MainHandler<ID>
}
