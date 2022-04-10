import { app, BrowserWindow, desktopCapturer, dialog, Display, ipcMain, Menu, screen } from "electron"
import fs from "fs"
import path, { join } from "path"
import { URL } from "url"
import { FILE_INFO, MAIN, OPEN_FOLDER, OUTPUT, READ_FOLDER, SHOW, STORE, EXPORT } from "../types/Channels"
import { closeServers } from "./servers"
import { template } from "./utils/menuTemplate"
import { electronSettings, events, overlays, projects, settings, shows, stageShows, templates, themes } from "./utils/store"
// import checkForUpdates from "./utils/updater"
import { createPDFWindow, exportTXT } from "./utils/export"

// WIP: Tray / push notifications
// https://www.webtips.dev/how-to-make-your-very-first-desktop-app-with-electron-and-svelte

const isProd: boolean = process.env.NODE_ENV === "production" || !/[\\/]electron/.exec(process.execPath)

electronSettings.set("loaded", true)
if (!electronSettings.get("loaded")) console.error("Could not get stored data!")

// keep a global reference of the window object to prevent it closing automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow | null

app.on("ready", () => {
  createLoading()
  createWindow()

  displays = screen.getAllDisplays()
  // TODO: get this from settings...
  // externalDisplay =
  //   displays.find((display) => {
  //     return display.bounds.x !== 0 || display.bounds.y !== 0
  //   }) || null

  // SCREEN LISTENERS
  screen.on("display-added", (_e: any, display) => {
    if (!outputWindow?.isEnabled()) toApp(OUTPUT, { channel: "SCREEN_ADDED", data: display.id.toString() })
  })
  screen.on("display-removed", (_e: any, display) => {
    if (outputScreen === display.id.toString()) {
      outputWindow?.hide()
      toApp(OUTPUT, { channel: "DISPLAY", data: { enabled: false } })
    }
  })

  // https://gist.github.com/maximilian-lindsey/a446a7ee87838a62099d
  // const LANserver =
  require("./servers")
  // WIP: require("./webcam")

  if (process.platform === "win32") app.setAppUserModelId(app.name)

  // check for updates
  // if (isProd) checkForUpdates()
})

// LOADING WINDOW

let loadingWindow: BrowserWindow | null = null
const createLoading = () => {
  loadingWindow = new BrowserWindow({
    width: 500,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    // show: false,
    icon: "public/icon.ico",
    webPreferences: { nodeIntegration: true, contextIsolation: false, enableRemoteModule: true },
  })
  loadingWindow.loadFile("public/loading.html")
  // loadingWindow.once("ready-to-show", () => loadingWindow!.showInactive())
  // if (!isProd) loadingWindow.webContents.openDevTools()

  loadingWindow.on("closed", () => (loadingWindow = null))
}

ipcMain.once("LOADED", () => {
  if (electronSettings.get("maximized")) mainWindow!.maximize()
  mainWindow?.show()
  loadingWindow?.close()
})

// MAIN WINDOW

const createWindow = () => {
  let width: number = electronSettings.get("width")
  let height: number = electronSettings.get("height")

  mainWindow = new BrowserWindow({
    width,
    height,
    icon: "public/icon.ico",
    frame: !isProd || process.platform !== "win32",
    autoHideMenuBar: isProd && process.platform === "win32",
    backgroundColor: "#2d313b",
    show: !isProd,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      // beta dev tools
      devTools: !isProd || Number(app.getVersion()[0]) === 0,
      preload: join(__dirname, "preload"), // use a preload script
      webSecurity: isProd, // load local files
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      allowRunningInsecureContent: false,
    },
  })

  // app.asar/build/~electron/public/index.html
  const url: string = isProd ? `file://${join(__dirname, "..", "..", "public", "index.html")}` : "http://localhost:3000"

  mainWindow.loadURL(url).catch((err) => {
    console.error("UNVALID URL:", JSON.stringify(err))
    app.quit()
  })

  if (!isProd) mainWindow.webContents.openDevTools()

  mainWindow.on("maximize", () => electronSettings.set("maximized", true))
  mainWindow.on("unmaximize", () => electronSettings.set("maximized", false))
  mainWindow.on("resize", () => {
    let { width, height } = mainWindow!.getBounds()
    electronSettings.set("width", width)
    electronSettings.set("height", height)
  })

  let focused: boolean = false
  mainWindow.on("focus", () => {
    // WIP hide task bar on second screen
    if (process.platform === "win32" && !focused) {
      focused = true
      outputWindow?.focus()
      mainWindow?.focus()
      setTimeout(() => {
        focused = false
      }, 100)
    }
  })

  mainWindow.on("closed", () => {
    mainWindow = null
    outputWindow?.close()
  })
  mainWindow.once("ready-to-show", createOutputWindow)

  // MENU
  const menu = Menu.buildFromTemplate(template({}))
  // mainWindow!.setMenu(menu)
  Menu.setApplicationMenu(menu)
}

// macOS: do not quit the application directly after the user close the last window, instead wait for Command + Q (or equivalent).
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    closeServers()
    app.quit()
  }
})

app.on("web-contents-created", (_e, contents) => {
  // console.info(e)
  // Security of webviews
  contents.on("will-attach-webview", (_event, webPreferences, _params) => {
    // console.info(event, params)
    // Strip away preload scripts if unused or verify their location is legitimate
    delete webPreferences.preload

    // Verify URL being loaded
    // if (!params.src.startsWith(`file://${join(__dirname)}`)) {
    //   event.preventDefault(); // We do not open anything now
    // }
  })

  contents.on("will-navigate", (event, navigationUrl) => {
    const parsedURL = new URL(navigationUrl)
    // In dev mode allow Hot Module Replacement
    if (parsedURL.host !== "localhost:3000" && !isProd) {
      console.warn("Stopped attempt to open: " + navigationUrl)
      event.preventDefault()
    } else if (isProd) {
      console.warn("Stopped attempt to open: " + navigationUrl)
      event.preventDefault()
    }
  })
})

// STORE
ipcMain.on(STORE, (e, msg) => {
  if (msg.channel === "SAVE") save(msg.data)
  else if (msg.channel === "SETTINGS") e.reply(STORE, { channel: "SETTINGS", data: settings.store })
  else if (msg.channel === "SHOWS") e.reply(STORE, { channel: "SHOWS", data: shows.store })
  else if (msg.channel === "STAGE_SHOWS") e.reply(STORE, { channel: "SHOW", data: stageShows.store })
  else if (msg.channel === "PROJECTS") e.reply(STORE, { channel: "PROJECTS", data: projects.store })
  else if (msg.channel === "OVERLAYS") e.reply(STORE, { channel: "OVERLAYS", data: overlays.store })
  else if (msg.channel === "TEMPLATES") e.reply(STORE, { channel: "TEMPLATES", data: templates.store })
  else if (msg.channel === "EVENTS") e.reply(STORE, { channel: "EVENTS", data: events.store })
  else if (msg.channel === "THEMES") e.reply(STORE, { channel: "THEMES", data: themes.store })
})

// save
function save(data: any) {
  Object.entries(data.settings).forEach(([key, value]: any) => {
    if (JSON.stringify(settings.get(key)) !== JSON.stringify(value)) settings.set(key, value)
  })

  if (data.shows && JSON.stringify(shows.store) !== JSON.stringify(data.shows)) shows.set(data.shows)
  if (data.stageShows && JSON.stringify(stageShows.store) !== JSON.stringify(data.stageShows)) stageShows.set(data.stageShows)
  if (data.projects && JSON.stringify(projects.store) !== JSON.stringify(data.projects)) projects.set(data.projects)
  if (data.overlays && JSON.stringify(overlays.store) !== JSON.stringify(data.overlays)) overlays.set(data.overlays)
  if (data.templates && JSON.stringify(templates.store) !== JSON.stringify(data.templates)) templates.set(data.templates)
  if (data.events && JSON.stringify(events.store) !== JSON.stringify(data.events)) events.set(data.events)
  if (data.themes && JSON.stringify(themes.store) !== JSON.stringify(data.themes)) themes.set(data.themes)

  // check folder
  if (!fs.existsSync(data.path)) {
    data.path = updateOutputPath()
    toApp(MAIN, { channel: "SHOWS_PATH", data: data.path })
  }

  // SHOWS
  Object.entries(data.showsCache).forEach(([id, value]: any) => {
    let p: string = path.resolve(data.path, value.name + ".show")
    if (!fs.existsSync(p) || JSON.stringify([id, value]) !== fs.readFileSync(p, "utf8")) {
      fs.writeFile(p, JSON.stringify([id, value]), (err): void => {
        if (err) toApp(SHOW, { error: "no_write", err, id })
      })
    }
  })
}

// EXPORT
ipcMain.on(EXPORT, (_e, msg) => {
  if (msg.channel === "GENERATE") {
    // check folder
    if (!msg.data.path) {
      msg.data.path = dialog.showOpenDialogSync(mainWindow!, { properties: ["openDirectory"] })?.[0]
      if (msg.data.path) toApp(MAIN, { channel: "EXPORT_PATH", data: msg.data.path })
    }

    if (msg.data.path) {
      if (msg.data.type === "pdf") createPDFWindow(msg.data)
      else if (msg.data.type === "txt") exportTXT(msg.data)
    }
  }
})

// SHOW
ipcMain.on(SHOW, (e, msg) => {
  // check folder
  if (!fs.existsSync(msg.path)) {
    msg.path = updateOutputPath()
    toApp(MAIN, { channel: "SHOWS_PATH", data: msg.path })
  }

  let show: any = "{}"
  let p: string = path.resolve(msg.path, msg.name + ".show")
  if (fs.existsSync(p)) {
    show = JSON.parse(fs.readFileSync(p, "utf8"))
    if (show[0] === msg.id) {
      e.reply(SHOW, { id: msg.id, show })
    } else e.reply(SHOW, { error: "not_found", id: msg.id, file_id: show[0] })
  } else e.reply(SHOW, { error: "not_found", id: msg.id })
})

export const toApp = (channel: string, ...args: any[]) => mainWindow?.webContents.send(channel, ...args)

const updateOutputPath = (p: any = null, name: string = "Shows") => {
  if (!p) p = path.resolve(app.getPath("documents"), name)
  if (!fs.existsSync(p)) p = fs.mkdirSync(p, { recursive: true })
  return p
}

export async function openURL(url: string) {
  const { shell } = require("electron")
  await shell.openExternal(url)
}

const os = require("os")
ipcMain.on(MAIN, (e, msg) => {
  let data: any
  if (msg.channel === "GET_OS") data = { platform: os.platform(), name: os.hostname() }
  else if (msg.channel === "VERSION") data = app.getVersion()
  else if (msg.channel === "DISPLAY") data = outputWindow?.isVisible()
  else if (msg.channel === "URL") openURL(msg.data)
  else if (msg.channel === "IP") {
    data = os.networkInterfaces()
  } else if (msg.channel === "LANGUAGE") {
    const menu = Menu.buildFromTemplate(template(msg.data.strings))
    Menu.setApplicationMenu(menu)
  } else if (msg.channel === "SHOWS_PATH") {
    data = updateOutputPath()
  } else if (msg.channel === "EXPORT_PATH") {
    data = updateOutputPath(null, "Exports")
  } else if (msg.channel === "GET_WINDOWS" || msg.channel === "GET_SCREENS") {
    desktopCapturer.getSources({ types: [msg.channel === "GET_WINDOWS" ? "window" : "screen"] }).then(async (sources) => {
      const screens: any[] = []
      sources.map((source) => screens.push({ name: source.name, id: source.id }))
      msg.data = screens
      toApp(MAIN, msg)
    })
  } else if (msg.channel === "GET_DISPLAYS") {
    data = displays
  } else if (msg.channel === "GET_PATHS") {
    data = {
      documents: app.getPath("documents"),
      pictures: app.getPath("pictures"),
      videos: app.getPath("videos"),
      music: app.getPath("music"),
      shows: path.resolve(app.getPath("documents"), "Shows"),
    }

    // create documents/Shows
    updateOutputPath()
  } else if (msg.channel === "OUTPUT") {
    // console.log(e.sender.id, outputWindow?.id, outputWindow?.webContents.id)
    // e.reply(MAIN, { channel: "OUTPUT", data: e.sender.id === outputWindow?.webContents.id ? "true" : "false" })
    data = e.sender.id === outputWindow?.webContents.id ? "true" : "false"
  } else if (msg.channel === "CLOSE") {
    mainWindow?.close()
  } else if (msg.channel === "MAXIMIZE") {
    if (mainWindow?.isMaximized()) mainWindow?.unmaximize()
    else mainWindow?.maximize()
    msg.channel = "MAXIMIZED"
    data = mainWindow?.isMaximized()
  } else if (msg.channel === "MAXIMIZED") {
    data = mainWindow?.isMaximized()
  } else if (msg.channel === "MINIMIZE") {
    mainWindow?.minimize()
  } else if (msg.channel === "FULLSCREEN") {
    mainWindow?.setFullScreen(!mainWindow?.isFullScreen())
  } else {
    data = msg
  }
  if (data !== undefined) e.reply(MAIN, { channel: msg.channel, data })
})

// OUTPUT WINDOW

let displays: Display[] = []
let outputScreen: string | null = null

// create output
ipcMain.on(OUTPUT, (_e, msg: any) => {
  if (msg.channel === "DISPLAY") {
    if (msg.data.enabled) {
      let screen = msg.data.screen
      if (screen) {
        screen =
          displays.find((display) => {
            return display.id.toString() === screen
          }) || null
      }
      if (!screen) {
        screen =
          displays.find((display) => {
            return display.bounds.x !== mainWindow?.getBounds().x || display.bounds.y !== mainWindow?.getBounds().y
          }) || null
        if (screen) toApp(MAIN, { channel: "SET_SCREEN", data: screen })
      }
      outputScreen = screen ? screen.id.toString() : null

      if (screen) {
        if (JSON.stringify(outputWindow?.getBounds) !== JSON.stringify(screen.bounds)) outputWindow?.setBounds(screen.bounds)
        // TODO: output task bar
        outputWindow?.setVisibleOnAllWorkspaces(true)
        outputWindow?.showInactive()
        // outputWindow?.show()
        // outputWindow?.maximize()
        // outputWindow?.blur()
        // mainWindow?.focus()
        // outputWindow?.setFullScreen(true)
        // outputWindow?.setAlwaysOnTop(true, "pop-up-menu", 1)
        // outputWindow?.setAlwaysOnTop(true, "pop-up-menu")
        // outputWindow?.setFullScreenable(false)
        // outputWindow?.setAlwaysOnTop(true, "screen-saver", 1)
        outputWindow?.moveTop()
        // outputWindow?.maximize()

        // focus on mac
        mainWindow?.focus()
      }
    } else {
      outputWindow?.hide()
    }
    toApp(OUTPUT, msg)
  } else if (msg.channel.includes("MAIN")) toApp(OUTPUT, msg)
  else outputWindow?.webContents.send(OUTPUT, msg)
})

let outputWindow: BrowserWindow | null = null
function createOutputWindow() {
  // https://www.electronjs.org/docs/latest/api/browser-window
  outputWindow = new BrowserWindow({
    width: 810,
    height: 610,
    x: 0,
    y: 0,
    alwaysOnTop: true, // keep window on top of other windows
    resizable: false, // disable resizing on mac and windows
    frame: false, // hide title/buttons
    fullscreen: true,
    skipTaskbar: true, // hide taskbar

    // parent: mainWindow!,
    // modal: true,

    // type: "toolbar", // hide from taskbar
    // transparent: isProd, // disable interaction (resize)
    // focusable: false, // makes non focusable
    // titleBarStyle: "hidden", // hide titlebar
    // kiosk: true,
    // roundedCorners: false, // disable rounded corners on mac
    backgroundColor: "#000000",
    show: false,
    webPreferences: {
      // beta dev tools
      devTools: !isProd || Number(app.getVersion()[0]) === 0,
      preload: join(__dirname, "preload"), // use a preload script
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: isProd, // get local files
      allowRunningInsecureContent: false,
    },
  })

  outputWindow.removeMenu() // hide menubar
  outputWindow.setAlwaysOnTop(true, "pop-up-menu", 1)
  outputWindow.setVisibleOnAllWorkspaces(true)

  const url: string = isProd ? `file://${join(__dirname, "..", "..", "public", "index.html")}` : "http://localhost:3000"

  outputWindow.loadURL(url).catch((err) => {
    console.error(JSON.stringify(err))
    app.quit()
  })

  // toOutput("MAIN", { channel: "OUTPUT", data: "true" })
  // outputWindow.webContents.send("MAIN", { channel: "OUTPUT" })

  if (!isProd) outputWindow.webContents.openDevTools()

  outputWindow.on("closed", () => (outputWindow = null))
}

// LISTENERS

ipcMain.on(OPEN_FOLDER, (_e, msg: { id: string; title: string | undefined }) => {
  let folder: any = dialog.showOpenDialogSync(mainWindow!, { properties: ["openDirectory"], title: msg.title })
  if (folder) toApp(OPEN_FOLDER, { id: msg.id, path: folder[0] })
})

ipcMain.on(READ_FOLDER, (_e, folderPath: string) => {
  const fileList: string[] = fs.readdirSync(folderPath)
  let files: any[] = []

  for (const name of fileList) {
    const pathToFile: string = path.join(folderPath, name)
    const stat = fs.statSync(pathToFile)
    const [extension] = name.match(/\.[0-9a-z]+$/i) || [""]
    files.push({ path: pathToFile, name, folder: stat.isDirectory(), extension: extension.substring(1), stat })
  }

  toApp(READ_FOLDER, { path: folderPath, files })
})

ipcMain.on(FILE_INFO, (_e, filePath: string) => {
  const stat = fs.statSync(filePath)
  const [extension] = filePath.substring(filePath.lastIndexOf("\\") + 1).match(/\.[0-9a-z]+$/i) || [""]
  toApp(FILE_INFO, { path: filePath, stat, extension: extension.substring(1) })
})
