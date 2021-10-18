import Store = require("electron-store")

interface ElectronSettings {
  loaded: boolean
  width: number
  height: number
  maximized: boolean
}

const electronSettings = new Store<ElectronSettings>({
  defaults: {
    loaded: false,
    width: 800,
    height: 600,
    maximized: false,
  },
})

export default electronSettings
