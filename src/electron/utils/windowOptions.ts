// ----- FreeShow -----
// Options for electron windows

import { join } from "path"
import { isProd } from ".."

// https://www.electronjs.org/docs/latest/api/browser-window

export const loadingOptions: any = {
  width: 500,
  height: 300,
  icon: "public/icon.png",
  backgroundColor: "#2d313b",
  transparent: true,
  alwaysOnTop: true,
  resizable: false,
  frame: false,
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false,
  },
}

export const mainOptions: any = {
  icon: "public/icon.png",
  backgroundColor: "#2d313b",
  titleBarStyle: process.platform === "darwin" ? "hidden" : "default", // hiddenInset
  trafficLightPosition: { x: 10, y: 17 },
  show: false,
  webPreferences: {
    preload: join(__dirname, "..", "preload"), // use a preload script
    devTools: !isProd, // enable dev tools
    webSecurity: isProd, // get local files in dev
    nodeIntegration: false,
    contextIsolation: true,
    allowRunningInsecureContent: false,
  },
}

export const outputOptions: any = {
  backgroundColor: "#000000",
  alwaysOnTop: true, // keep window on top of other windows
  resizable: false, // disable resizing on mac and windows
  frame: false, // hide title/buttons
  // fullscreen: true,
  skipTaskbar: true, // hide taskbar

  // parent: mainWindow!,
  // modal: true,

  // type: "toolbar", // hide from taskbar
  // transparent: isProd, // disable interaction (resize)
  // focusable: false, // makes non focusable
  // titleBarStyle: "hidden", // hide titlebar
  // kiosk: true, // fixed window over menu bar
  // roundedCorners: false, // disable rounded corners on mac
  show: false,
  webPreferences: {
    preload: join(__dirname, "..", "preload"), // use a preload script
    devTools: !isProd,
    webSecurity: isProd,
    // nodeIntegration: false,
    contextIsolation: true,
    allowRunningInsecureContent: false,
  },
}
