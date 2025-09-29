// ----- FreeShow -----
// Get all user configs
// https://www.npmjs.com/package/electron-store

import { app } from "electron"
import Store from "electron-store"
import { statSync } from "fs"
import path from "path"
import type { Event } from "../../types/Calendar"
import type { History } from "../../types/History"
import type { ErrorLog, Media } from "../../types/Main"
import type { Themes } from "../../types/Settings"
import type { Overlays, Templates, TrimmedShows } from "../../types/Show"
import type { StageLayouts } from "../../types/Stage"
// import { DEFAULT_PCO_DATA } from "../planningcenter/connect" // No longer needed
import { dataFolderNames, deleteFile, doesPathExist, readFile } from "../utils/files"
import { defaultConfig, defaultSettings, defaultSyncedSettings } from "./defaults"
import { forceCloseApp } from "../utils/close"
// Import content providers to trigger migration on startup
import "./contentProviders"

const fileNames: { [key: string]: string } = {
    error_log: "error_log",
    settings: "settings",
    synced_settings: "settings_synced",
    themes: "themes",
    projects: "projects",
    shows: "shows",
    stageShows: "stage",
    overlays: "overlays",
    templates: "templates",
    events: "events",
    driveKeys: "DRIVE_API_KEY",
    media: "media",
    cache: "cache",
    history: "history",
    usage: "usage",
    access: "ACCESS",
}

// NOTE: defaults will always replace the keys with any in the default when they are removed

const storeExtraConfig: { [key: string]: string } = {}
if (process.env.FS_MOCK_STORE_PATH !== undefined) {
    storeExtraConfig.cwd = process.env.FS_MOCK_STORE_PATH
}

// MAIN WINDOW
export const config = new Store<any>({ defaults: defaultConfig, ...storeExtraConfig })

const storesPath = config.path
checkStores(storesPath)

// Check that files are parsed properly!
function checkStores(dataPath: string) {
    Object.values(fileNames).forEach((fileName) => {
        const filePath = path.join(path.dirname(dataPath), fileName + ".json")
        if (!doesPathExist(filePath)) return

        // delete if too large
        if (fileName === "history") {
            const MAX_BYTES = 30 * 1024 * 1024 // 30 MB
            const stats = statSync(filePath)
            if (stats.size > MAX_BYTES) {
                deleteFile(filePath)
                console.info(`DELETED ${fileName + ".json"} file as it exceeded 30 MB!`)
                return
            }
        }

        const jsonData = readFile(filePath)

        try {
            JSON.parse(jsonData)
        } catch (err) {
            console.error("Could not read the " + fileName + ".json settings file, probably wrong JSON format!", err)
            // auto delete files that can't be parsed!
            deleteFile(filePath)
        }
    })
}

const DEFAULTS = {
    error_log: {} as { renderer?: ErrorLog[]; main?: ErrorLog[]; request?: ErrorLog[] },
    settings: defaultSettings,
    synced_settings: defaultSyncedSettings,
    themes: {} as { [key: string]: Themes },
    projects: { projects: {}, folders: {}, projectTemplates: {} },
    shows: {} as TrimmedShows,
    stageShows: {} as StageLayouts,
    overlays: {} as Overlays,
    templates: {} as Templates,
    events: {} as { [key: string]: Event },
    driveKeys: {} as any,
    media: {} as Media,
    cache: {} as any,
    history: {} as { undo: History[]; redo: History[] },
    usage: { all: [] } as any,
    accessKeys: {
        contentProviders: {
            planningcenter: {},
            chums: {}
        }
    },
}

// ERROR LOG
export const error_log = new Store({ name: fileNames.error_log, defaults: DEFAULTS.error_log, ...storeExtraConfig })

// SETTINGS
const settings = new Store({ name: fileNames.settings, defaults: DEFAULTS.settings, ...storeExtraConfig })
const synced_settings = new Store({ name: fileNames.synced_settings, defaults: DEFAULTS.synced_settings, ...storeExtraConfig })
const themes = new Store({ name: fileNames.themes, defaults: DEFAULTS.themes, ...storeExtraConfig })

// PROJECTS
const projects = new Store({ name: fileNames.projects, defaults: DEFAULTS.projects, ...storeExtraConfig })

// SLIDES
const shows = new Store({ name: fileNames.shows, defaults: DEFAULTS.shows, serialize: (v) => JSON.stringify(v), ...storeExtraConfig })
const stageShows = new Store({ name: fileNames.stageShows, defaults: DEFAULTS.stageShows, ...storeExtraConfig })
const overlays = new Store({ name: fileNames.overlays, defaults: DEFAULTS.overlays, ...storeExtraConfig })
const templates = new Store({ name: fileNames.templates, defaults: DEFAULTS.templates, ...storeExtraConfig })

// CALENDAR
const events = new Store({ name: fileNames.events, defaults: DEFAULTS.events, ...storeExtraConfig })

// CLOUD
const driveKeys = new Store({ name: fileNames.driveKeys, defaults: DEFAULTS.driveKeys, ...storeExtraConfig })

// CACHE
const media = new Store({ name: fileNames.media, defaults: DEFAULTS.media, accessPropertiesByDotNotation: false, serialize: (v) => JSON.stringify(v), ...storeExtraConfig })
const cache = new Store({ name: fileNames.cache, defaults: DEFAULTS.cache, serialize: (v) => JSON.stringify(v), ...storeExtraConfig })
const history = new Store({ name: fileNames.history, defaults: DEFAULTS.history, serialize: (v) => JSON.stringify(v), ...storeExtraConfig })
const usage = new Store({ name: fileNames.usage, defaults: DEFAULTS.usage, serialize: (v) => JSON.stringify(v), ...storeExtraConfig })
const accessKeys = new Store({ name: fileNames.access, defaults: DEFAULTS.accessKeys })

export const stores = {
    SETTINGS: settings,
    SYNCED_SETTINGS: synced_settings,
    THEMES: themes,
    PROJECTS: projects,
    SHOWS: shows,
    STAGE_SHOWS: stageShows,
    OVERLAYS: overlays,
    TEMPLATES: templates,
    EVENTS: events,
    DRIVE_API_KEY: driveKeys,
    MEDIA: media,
    CACHE: cache,
    HISTORY: history,
    USAGE: usage,
    ACCESS: accessKeys,
}

// ----- GET STORE -----

export function getStore<T extends keyof typeof stores>(id: T): (typeof stores)[T] extends { store: infer S } ? S : null {
    if (!stores[id]) throw new Error(`Store with key ${id} does not exist.`)

    const store = stores[id].store
    return store as (typeof stores)[T] extends { store: infer S } ? S : null
}

// ----- CUSTOM DATA PATH -----

const portableData: { [key: string]: { key: keyof typeof stores; defaults: object } } = {
    synced_settings: { key: "SYNCED_SETTINGS", defaults: defaultSyncedSettings },
    themes: { key: "THEMES", defaults: {} },
    projects: { key: "PROJECTS", defaults: { projects: {}, folders: {}, projectTemplates: {} } },
    shows: { key: "SHOWS", defaults: {} },
    stageShows: { key: "STAGE_SHOWS", defaults: {} },
    overlays: { key: "OVERLAYS", defaults: {} },
    templates: { key: "TEMPLATES", defaults: {} },
    events: { key: "EVENTS", defaults: {} },
    driveKeys: { key: "DRIVE_API_KEY", defaults: {} },
    history: { key: "HISTORY", defaults: {} },
}

export let userDataPath: string | null = null
export function updateDataPath({ reset, dataPath, load }: { reset?: boolean; dataPath?: string; load?: boolean } = {}) {
    if (reset) return resetStoresPath()

    const settingsStore = settings.store || {}

    const useDataPath = !!settingsStore.special?.customUserDataLocation
    if (!useDataPath) return

    userDataPath = dataPath || settingsStore.dataPath || ""
    if (!userDataPath) return

    userDataPath = path.join(userDataPath, dataFolderNames.userData)
    checkStores(path.join(userDataPath, "config.json"))
    updateStoresPath(load)
}

function resetStoresPath() {
    userDataPath = app.getPath("userData")
    updateStoresPath()
}

function updateStoresPath(load = false) {
    if (!userDataPath) return
    Object.keys(portableData).forEach((id) => createStoreAtNewLocation(id, load))
}

let error = false
function createStoreAtNewLocation(id: string, load = false) {
    if (error) return

    const key = portableData[id].key
    let tempData: any = {}
    if (!load) {
        try {
            tempData = JSON.parse(JSON.stringify(stores[key].store))
        } catch (err) {
            console.error("Could not parse store:", key)
        }
    }

    // set new stores to export
    try {
        stores[key] = new Store({ name: fileNames[id], defaults: (portableData[id].defaults || {}) as any, cwd: userDataPath! }) as any
    } catch (err) {
        error = true
        console.error("Can't create store at set location!", err)

        // revert
        const special = stores.SETTINGS.get("special")
        special.customUserDataLocation = false
        stores.SETTINGS.set("special", special)
        stores.SETTINGS.set("dataPath", "")
        stores.SETTINGS.set("showsPath", "")

        forceCloseApp()
    }

    if (load || !Object.keys(tempData).length) return

    // rewrite data to new location
    stores[key].clear()
    ;(stores[key] as any).set(tempData)
}
