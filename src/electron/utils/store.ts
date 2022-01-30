import Store = require("electron-store")
import { defaultSettings, defaultThemes } from "./defaults"

interface ElectronSettings {
  loaded: boolean
  maximized: boolean
  width: number
  height: number
}

export const electronSettings = new Store<ElectronSettings>({
  defaults: {
    loaded: false,
    maximized: false,
    width: 800,
    height: 600,
  },
})

export const settings = new Store<any>({ name: "settings", defaults: defaultSettings })
export const shows = new Store<any>({ name: "shows", defaults: {} })
export const stageShows = new Store<any>({ name: "stage", defaults: {} })
export const projects = new Store<any>({ name: "projects", defaults: { projects: {}, folders: {} } })
export const overlays = new Store<any>({ name: "overlays", defaults: {} })
export const templates = new Store<any>({ name: "templates", defaults: {} })
export const events = new Store<any>({ name: "events", defaults: {} })
export const themes = new Store<any>({ name: "themes", defaults: defaultThemes })
