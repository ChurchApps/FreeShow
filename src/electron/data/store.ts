// ----- FreeShow -----
// Get all user configs
// https://www.npmjs.com/package/electron-store

import { app } from "electron"
import Store from "electron-store"
import path from "path"
import { defaultConfig, defaultSettings, defaultSyncedSettings } from "./defaults"
import { dataFolderNames } from "../utils/files"

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
}

// NOTE: defaults will always replace the keys with any in the default when they are removed

const storeExtraConfig: { [key: string]: string } = {}
if (process.env.FS_MOCK_STORE_PATH != undefined) {
    storeExtraConfig["cwd"] = process.env.FS_MOCK_STORE_PATH
}

// MAIN WINDOW
export const config = new Store<any>({ defaults: defaultConfig, ...storeExtraConfig })
// ERROR LOG
export const error_log = new Store({ name: fileNames.error_log, defaults: {}, ...storeExtraConfig })

// SETTINGS
const settings = new Store({ name: fileNames.settings, defaults: defaultSettings, ...storeExtraConfig })
let synced_settings = new Store({ name: fileNames.synced_settings, defaults: defaultSyncedSettings, ...storeExtraConfig })
let themes = new Store({ name: fileNames.themes, defaults: {}, ...storeExtraConfig })

// PROJECTS
let projects = new Store({ name: fileNames.projects, defaults: { projects: {}, folders: {} }, ...storeExtraConfig })

// SLIDES
let shows = new Store({ name: fileNames.shows, defaults: {}, serialize: (v) => JSON.stringify(v), ...storeExtraConfig })
let stageShows = new Store({ name: fileNames.stageShows, defaults: {}, ...storeExtraConfig })
let overlays = new Store({ name: fileNames.overlays, defaults: {}, ...storeExtraConfig })
let templates = new Store({ name: fileNames.templates, defaults: {}, ...storeExtraConfig })

// CALENDAR
let events = new Store({ name: fileNames.events, defaults: {}, ...storeExtraConfig })

// CLOUD
let driveKeys = new Store({ name: fileNames.driveKeys, defaults: {}, ...storeExtraConfig })

// CACHE
const media = new Store({ name: fileNames.media, defaults: {}, accessPropertiesByDotNotation: false, serialize: (v) => JSON.stringify(v), ...storeExtraConfig })
const cache = new Store({ name: fileNames.cache, defaults: {}, serialize: (v) => JSON.stringify(v), ...storeExtraConfig })
let history = new Store({ name: fileNames.history, defaults: {}, serialize: (v) => JSON.stringify(v), ...storeExtraConfig })

export let stores: { [key: string]: Store<any> } = {
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
}

// ----- CUSTOM DATA PATH -----

const portableData: any = {
    synced_settings: { key: "SYNCED_SETTINGS", defaults: defaultSyncedSettings },
    themes: { key: "THEMES", defaults: {} },
    projects: { key: "PROJECTS", defaults: { projects: {}, folders: {} } },
    shows: { key: "SHOWS", defaults: {} },
    stageShows: { key: "STAGE_SHOWS", defaults: {} },
    overlays: { key: "OVERLAYS", defaults: {} },
    templates: { key: "TEMPLATES", defaults: {} },
    events: { key: "EVENTS", defaults: {} },
    driveKeys: { key: "DRIVE_API_KEY", defaults: {} },
    history: { key: "HISTORY", defaults: {} },
}

export let userDataPath: string | null = null
export function updateDataPath({ reset, dataPath, load }: any = {}) {
    if (reset) return resetStoresPath()

    let settingsStore = settings.store || {}

    let useDataPath = !!settingsStore.special?.customUserDataLocation
    if (!useDataPath) return

    userDataPath = dataPath || settingsStore.dataPath || ""
    if (!userDataPath) return

    userDataPath = path.join(userDataPath, dataFolderNames.userData)
    updateStoresPath(load)
}

function resetStoresPath() {
    userDataPath = app.getPath("userData")
    updateStoresPath()
}

function updateStoresPath(load: boolean = false) {
    if (!userDataPath) return
    Object.keys(portableData).forEach((id) => createStoreAtNewLocation(id, load))
}

function createStoreAtNewLocation(id: string, load: boolean = false) {
    let key = portableData[id].key
    let tempData: any = {}
    if (!load) {
        try {
            tempData = JSON.parse(JSON.stringify(stores[key].store))
        } catch (err) {
            console.log("Could not parse store:", key)
        }
    }

    // set new stores to export
    stores[key] = new Store({ name: fileNames[id], defaults: portableData[id].defaults || {}, cwd: userDataPath! })

    if (load || !Object.keys(tempData).length) return

    // rewrite data to new location
    stores[key].clear()
    stores[key].set(tempData)
}
