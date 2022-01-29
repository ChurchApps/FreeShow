import Store = require("electron-store")
import defaultSettings from "./defaults"

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

export const appSettings = new Store<any>({ name: "settings", ...defaultSettings })
export const shows = new Store<any>({
  name: "shows",
})
