// ----- FreeShow -----
// Get all user configs

import Store from "electron-store"
import { defaultConfig, defaultSettings, defaultStage, defaultSyncedSettings, defaultThemes } from "./defaults"

// MAIN WINDOW
export const config = new Store<any>({ defaults: defaultConfig })

// SETTINGS
const settings = new Store({ name: "settings", defaults: defaultSettings })
const synced_settings = new Store({ name: "settings_synced", defaults: defaultSyncedSettings })
const themes = new Store({ name: "themes", defaults: defaultThemes })

// PROJECTS
const projects = new Store({ name: "projects", defaults: { projects: {}, folders: {} } })

// SLIDES
const shows = new Store({ name: "shows", defaults: {} })
const stageShows = new Store({ name: "stage", defaults: defaultStage })
const overlays = new Store({ name: "overlays", defaults: {} })
const templates = new Store({ name: "templates", defaults: {} })

// CALENDAR
const events = new Store({ name: "events", defaults: {} })

// CLOUD
const driveKeys = new Store({ name: "DRIVE_API_KEY", defaults: {} })

// CACHE
const media = new Store({ name: "media", defaults: {}, accessPropertiesByDotNotation: false })
const cache = new Store({ name: "cache", defaults: {} })
const history = new Store({ name: "history", defaults: {} })

export const stores: { [key: string]: Store<any> } = {
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
