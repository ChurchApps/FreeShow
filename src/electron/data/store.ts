// ----- FreeShow -----
// Get all user configs
// https://www.npmjs.com/package/electron-store

import Store from "electron-store"
import { mkdirSync, renameSync, statSync } from "fs"
import path from "path"
import type { Event } from "../../types/Calendar"
import type { History } from "../../types/History"
import { Main } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"
import type { Config, ErrorLog, Media } from "../../types/Main"
import type { Themes } from "../../types/Settings"
import type { Overlays, Templates, TrimmedShows } from "../../types/Show"
import type { StageLayouts } from "../../types/Stage"
import type { ContentProviderId } from "../contentProviders/base/types"
import { sendMain, sendToMain } from "../IPC/main"
import { dataFolderNames, deleteFile, doesPathExist, getDataFolderPath, getDataFolderRoot, getDefaultDataFolderRoot, readFile, readFolder } from "../utils/files"
import { clone } from "../utils/helpers"
import "./contentProviders"
import { defaultConfig, defaultSettings, defaultSyncedSettings } from "./defaults"

// NOTE: defaults will always replace the keys with any in the default when they are removed

export const config = new Store<Config>({ defaults: defaultConfig })

export const storeFilesData = {
    SHOWS: { fileName: "shows", portable: false, defaults: {} as TrimmedShows, minify: true }, // cache
    SETTINGS: { fileName: "settings", portable: false, defaults: clone(defaultSettings) },

    // PORTABLE
    SYNCED_SETTINGS: { fileName: "settings_synced", portable: true, defaults: clone(defaultSyncedSettings) },
    THEMES: { fileName: "themes", portable: true, defaults: {} as { [key: string]: Themes } },
    PROJECTS: { fileName: "projects", portable: true, defaults: { projects: {}, folders: {}, projectTemplates: {} } },
    STAGE: { fileName: "stage", portable: true, defaults: {} as StageLayouts },
    OVERLAYS: { fileName: "overlays", portable: true, defaults: {} as Overlays },
    TEMPLATES: { fileName: "templates", portable: true, defaults: {} as Templates },
    EVENTS: { fileName: "events", portable: true, defaults: {} as { [key: string]: Event } },

    HISTORY: { fileName: "history", portable: false, defaults: {} as { undo: History[]; redo: History[] }, minify: true },
    MEDIA: { fileName: "media", portable: false, defaults: {} as Media, minify: true },

    CACHE: { fileName: "cache", portable: false, defaults: {} as any, minify: true },
    USAGE: { fileName: "usage", portable: false, defaults: {} as { all: any[] }, minify: true },
    ERROR_LOG: { fileName: "error_log", portable: false, defaults: {} as { renderer?: ErrorLog[]; main?: ErrorLog[]; request?: ErrorLog[] } },

    DRIVE_API_KEY: { fileName: "DRIVE_API_KEY", portable: false, defaults: {} as any },
    ACCESS: { fileName: "ACCESS", portable: false, defaults: { contentProviders: {} as { [key in ContentProviderId]?: any } } }
}

export const appDataPath = path.dirname(config.path)
checkStores(appDataPath)

export function setupStores() {
    const oldLocation = migrateConfig()
    createStores(oldLocation, true)

    checkStores(getDataFolderRoot())
}

// Check that files are parsed properly!
function checkStores(dataPath: string) {
    Object.values(storeFilesData).forEach(({ fileName }) => {
        const filePath = path.join(dataPath, fileName + ".json")
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

export let _store: { [key in keyof typeof storeFilesData]?: Store<any> } = {}

export function createStores(previousLocation?: string | null, setup: boolean = false) {
    const configFolderPath = getWritableConfigPath(previousLocation, setup)
    if (!configFolderPath) return
    if (previousLocation === configFolderPath) previousLocation = ""

    Object.entries(storeFilesData).forEach(([key, data]) => {
        const createStoreConfig = (useCwd: boolean) => ({
            name: data.fileName,
            defaults: data.defaults,
            cwd: useCwd && data.portable ? configFolderPath : undefined,
            serialize: (data as any).minify ? (v: any) => JSON.stringify(v) : undefined,
            accessPropertiesByDotNotation: key === "MEDIA" ? false : true
        })

        try {
            _store[key as keyof typeof storeFilesData] = new Store(createStoreConfig(true))

            // move user data files to data/Config folder if not already
            if (previousLocation && data.portable) moveStore(key as keyof typeof storeFilesData, previousLocation, setup)
        } catch (err) {
            console.error(`Failed to create store for ${key} with cwd:`, err)

            // try again at app data location
            try {
                _store[key as keyof typeof storeFilesData] = new Store(createStoreConfig(false))
                console.log(`Created store for ${key} without custom cwd`)
            } catch (fallbackErr) {
                console.error(`Failed to create store for ${key} even without cwd:`, fallbackErr)
            }
        }
    })
}

function getWritableConfigPath(previousLocation?: string | null, setup: boolean = false): string | null {
    let configFolderPath = getDataFolderPath("userData")

    if (doesPathExist(configFolderPath)) return configFolderPath

    try {
        // try to create "Config" folder at current path
        if (!configFolderPath) throw new Error("No config folder path")
        mkdirSync(configFolderPath, { recursive: true })
    } catch (err) {
        sendToMain(ToMain.ALERT, "Error: No permission to create folder!")

        // in setup previous path is the app data path
        if (setup && previousLocation) return previousLocation

        // fallback to previous (often the default data path), or default data path
        const dataFolderPath = previousLocation || getDefaultDataFolderRoot()
        if (dataFolderPath) {
            config.set("dataPath", dataFolderPath)
            sendMain(Main.DATA_PATH, dataFolderPath)
        }

        configFolderPath = getDataFolderPath("userData")

        if (doesPathExist(configFolderPath)) return configFolderPath

        try {
            if (!configFolderPath) throw new Error("No config folder path")
            mkdirSync(configFolderPath, { recursive: true })
        } catch (err) {
            // fallback to app data path
            config.set("dataPath", appDataPath)
            sendMain(Main.DATA_PATH, appDataPath)

            configFolderPath = getDataFolderPath("userData")

            if (doesPathExist(configFolderPath)) return configFolderPath

            try {
                if (!configFolderPath) throw new Error("No config folder path")
                mkdirSync(configFolderPath, { recursive: true })
            } catch (err) {
                console.error("Could not get a writable data folder", err)
                sendToMain(ToMain.ALERT, "Error: No permission to create data folder! Try installing as administrator.")
                return null
            }
        }
    }

    return configFolderPath
}

// ----- GET STORE -----

export function getStore(id: "config"): Config
export function getStore<T extends keyof typeof storeFilesData>(id: T): (typeof storeFilesData)[T]["defaults"]
export function getStore<T extends keyof typeof storeFilesData | "config">(id: T) {
    if (id === "config") return config.store

    const storeId = id as keyof typeof storeFilesData
    if (!_store[storeId]) throw new Error(`Store with key ${id} does not exist.`)

    try {
        return _store[storeId]!.store
    } catch (err) {
        console.error(`Could not get store data for ${id}:`, err)
        return storeFilesData[storeId].defaults
    }
}

// GET STORE VALUE (used in special cases - currently only some "config" keys)
export function getStoreValue(data: { file: "config" | keyof typeof _store; key: string }) {
    const store = data.file === "config" ? config : _store[data.file]
    return (store as any).get(data.key)
}
// SET STORE VALUE (used in special cases - currently only some "config" keys)
export function setStoreValue(data: { file: "config" | keyof typeof _store; key: string; value: any }) {
    const store = data.file === "config" ? config : _store[data.file]
    store?.set(data.key, data.value)
}

/// MIGRATE

function moveStore(key: keyof typeof storeFilesData, previousLocation: string, setup: boolean = false) {
    const store = _store[key]
    if (!store) return

    if (!setup) {
        // don't override if existing
        const filePathNew = path.join(getDataFolderPath("userData"), storeFilesData[key].fileName + ".json")
        if (doesPathExist(filePathNew)) {
            // send new data to main
            sendMain((Main as any)[key], getStore(key))
            return
        }
    }

    const filePathOld = path.join(previousLocation, storeFilesData[key].fileName + ".json")

    if (!doesPathExist(filePathOld)) return

    const fileData = readFile(filePathOld)
    if (!fileData) return

    try {
        store.clear()
        store.set(JSON.parse(fileData))

        console.info(`Moved ${storeFilesData[key].fileName}.json to data folder`)
    } catch (err) {
        console.error("Could not read the " + filePathOld + ".json settings file, probably wrong JSON format!", err)
        // auto delete files that can't be parsed!
        deleteFile(filePathOld)
    }

    // deleteFile(filePathOld) // keep old file for now
}

// move pre 1.5.3 data path & config
export function migrateConfig() {
    const configDataPath = config.get("dataPath")
    if (configDataPath) return null // already set

    // read settings.json at appDataPath
    const settings = JSON.parse(readFile(path.join(appDataPath, "settings.json")) || "{}")
    const dataPath = settings.dataPath || getDefaultDataFolderRoot()
    const showsPath = settings.showsPath

    // setStoreValue({ file: "config", key: "dataPath", value: dataPath })
    config.set("dataPath", dataPath)

    // move shows content to data/Shows if not already
    if (showsPath && (!showsPath.includes(dataPath) || !showsPath.includes("Shows"))) {
        moveShowsToDataFolder(showsPath)
    }

    const useDataPath = !!settings.special?.customUserDataLocation
    const userDataPath = path.join(dataPath, dataFolderNames.userData, "settings_synced.json")
    const noConfig = !useDataPath || !doesPathExist(userDataPath)

    return noConfig ? appDataPath : null
}

function moveShowsToDataFolder(oldShowsPath: string) {
    if (!doesPathExist(oldShowsPath)) return

    console.log("Moving shows to data location")

    const files = readFolder(oldShowsPath)
    const showsFolderPath = getDataFolderPath("shows")

    files.forEach(file => {
        if (!file.endsWith(".show")) return

        const oldPath = path.join(oldShowsPath, file)
        const newPath = path.join(showsFolderPath, file)

        try {
            renameSync(oldPath, newPath)
        } catch (err) {
            console.error("Could not move show file to new data folder:", err)
        }
    })
}
