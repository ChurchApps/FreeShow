// ----- FreeShow -----
// Plain-JSON key/value stores for the headless server, replacing electron-store.
// Honors the same store keys the frontend expects (SETTINGS, SYNCED_SETTINGS,
// PROJECTS, OVERLAYS, TEMPLATES, EVENTS, STAGE, THEMES, MEDIA, SHOWS index, ...).
// All files live under <dataRoot>/Config/<fileName>.json.

import { defaultSettings, defaultSyncedSettings } from "../../../electron/data/defaults"
import { doesPathExist, joinPath, parseJSON, readFile, writeFile } from "../../../shared/data/fsCore"
import { getDataFolderPath } from "./dataPaths"

interface StoreMeta {
    fileName: string
    defaults: any
}

// mirrors src/electron/data/store.ts storeFilesData (fileName + defaults), minus electron-store specifics
export const storeRegistry: { [key: string]: StoreMeta } = {
    SHOWS: { fileName: "shows", defaults: {} },
    SETTINGS: { fileName: "settings", defaults: defaultSettings },
    SYNCED_SETTINGS: { fileName: "settings_synced", defaults: defaultSyncedSettings },
    THEMES: { fileName: "themes", defaults: {} },
    PROJECTS: { fileName: "projects", defaults: { projects: {}, folders: {}, projectTemplates: {} } },
    STAGE: { fileName: "stage", defaults: {} },
    OVERLAYS: { fileName: "overlays", defaults: {} },
    TEMPLATES: { fileName: "templates", defaults: {} },
    EVENTS: { fileName: "events", defaults: {} },
    HISTORY: { fileName: "history", defaults: {} },
    MEDIA: { fileName: "media", defaults: {} },
    CACHE: { fileName: "cache", defaults: {} },
    CACHE_SYNC: { fileName: "cache_sync", defaults: {} },
    USAGE: { fileName: "usage", defaults: { all: [] } },
    DRIVE_API_KEY: { fileName: "DRIVE_API_KEY", defaults: {} },
    ACCESS: { fileName: "ACCESS", defaults: { contentProviders: {}, secrets: {} } }
}

function storeFilePath(id: string): string {
    const meta = storeRegistry[id]
    if (!meta) return ""
    return joinPath(getDataFolderPath("userData"), meta.fileName + ".json")
}

export function getStore(id: string): any {
    const meta = storeRegistry[id]
    if (!meta) {
        console.warn(`Store "${id}" does not exist`)
        return {}
    }

    const filePath = storeFilePath(id)
    if (!doesPathExist(filePath)) return meta.defaults

    const parsed = parseJSON(readFile(filePath))
    return parsed ?? meta.defaults
}

export function setStore(id: string, value: any): void {
    const filePath = storeFilePath(id)
    if (!filePath) return
    writeFile(filePath, JSON.stringify(value))
}

export function getStoreValue(data: { file: string; key: string }): any {
    const store = getStore(data.file)
    return store?.[data.key] ?? null
}

export function setStoreValue(data: { file: string; key: string; value: any }): void {
    const store = getStore(data.file) || {}
    store[data.key] = data.value
    setStore(data.file, store)
}
