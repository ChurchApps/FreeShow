import { app, BrowserWindow, desktopCapturer, dialog, Display, ipcMain, Menu, screen } from "electron"
import fs from "fs"
import path, { join } from "path"
import { URL } from "url"
import { FILE_INFO, GET_SCREENS, MAIN, OPEN_FOLDER, OUTPUT, READ_FOLDER, SHOW, STORE } from "../types/Channels"
import { template } from "./utils/menuTemplate"
import { electronSettings, events, overlays, projects, settings, shows, stageShows, templates, themes } from "./utils/store"
import checkForUpdates from "./utils/updater"

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
  externalDisplay =
    displays.find((display) => {
      return display.bounds.x !== 0 || display.bounds.y !== 0
    }) || null

  // https://gist.github.com/maximilian-lindsey/a446a7ee87838a62099d
  // const LANserver =
  require("./servers")
  // WIP: require("./webcam")

  if (process.platform === "win32") app.setAppUserModelId(app.name)

  // check for uodates
  if (isProd) checkForUpdates()
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
}

ipcMain.once("LOADED", () => {
  mainWindow?.show()
  loadingWindow?.close()
  loadingWindow = null
})

// MAIN WINDOW

const createWindow = () => {
  let width: number = electronSettings.get("width")
  let height: number = electronSettings.get("height")
  let maximized: boolean = electronSettings.get("maximized")

  mainWindow = new BrowserWindow({
    width,
    height,
    icon: "public/icon.ico",
    frame: !isProd,
    autoHideMenuBar: isProd && process.platform === "win32",
    backgroundColor: "#2d313b",
    show: !isProd,
    webPreferences: {
      // beta dev tools
      devTools: !isProd || Number(app.getVersion()[0]) > 1,
      preload: join(__dirname, "preload"), // use a preload script
      webSecurity: false, // load local files
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

  if (maximized) mainWindow.maximize()

  mainWindow.on("closed", () => (mainWindow = null))
  mainWindow.once("ready-to-show", createOutputWindow)

  // MENU
  const menu = Menu.buildFromTemplate(template({}))
  mainWindow!.setMenu(menu)
}

// macOS: do not quit the application directly after the user close the last window, instead wait for Command + Q (or equivalent).
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
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

  if (JSON.stringify(shows.store) !== JSON.stringify(data.shows)) shows.set(data.shows)
  else if (JSON.stringify(stageShows.store) !== JSON.stringify(data.stageShows)) stageShows.set(data.stageShows)
  else if (JSON.stringify(projects.store) !== JSON.stringify(data.projects)) projects.set(data.projects)
  else if (JSON.stringify(overlays.store) !== JSON.stringify(data.overlays)) overlays.set(data.overlays)
  else if (JSON.stringify(templates.store) !== JSON.stringify(data.templates)) templates.set(data.templates)
  else if (JSON.stringify(events.store) !== JSON.stringify(data.events)) events.set(data.events)
  else if (JSON.stringify(themes.store) !== JSON.stringify(data.themes)) themes.set(data.themes)

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

// SHOW
ipcMain.on(SHOW, (e, msg) => {
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

const updateShowsPath = (path: string) => {
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true })
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
  else if (msg.channel === "LANGUAGE") {
    const menu = Menu.buildFromTemplate(template(msg.data.strings))
    mainWindow!.setMenu(menu)
  } else if (msg.channel === "GET_PATHS") {
    data = {
      documents: app.getPath("documents"),
      pictures: app.getPath("pictures"),
      videos: app.getPath("videos"),
      music: app.getPath("music"),
    }

    // create documents/Shows
    updateShowsPath(path.resolve(data.documents, "Shows"))
  } else if (msg.channel === "OUTPUT") {
    // console.log(e.sender.id, outputWindow?.id, outputWindow?.webContents.id)
    // e.reply(MAIN, { channel: "OUTPUT", data: e.sender.id === outputWindow?.webContents.id ? "true" : "false" })
    data = e.sender.id === outputWindow?.webContents.id ? "true" : "false"
  } else if (msg.channel === "CLOSE") {
    mainWindow?.close()
    outputWindow?.close()
  } else if (msg.channel === "MAXIMIZE") {
    if (mainWindow?.isMaximized()) mainWindow?.unmaximize()
    else mainWindow?.maximize()
    msg.channel = "MAXIMIZED"
    data = mainWindow?.isMaximized()
  } else if (msg.channel === "MAXIMIZED") {
    data = mainWindow?.isMaximized()
  } else if (msg.channel === "MINIMIZE") {
    mainWindow?.minimize()
  } else {
    data = msg
  }
  if (data !== undefined) e.reply(MAIN, { channel: msg.channel, data })
})

// OUTPUT WINDOW

let displays: Display[] = []
// TODO: get this from settings...
let externalDisplay: Display | null = null

// create output
ipcMain.on(OUTPUT, (_e, msg: any) => {
  if (msg.channel === "DISPLAY") {
    if (msg.data === true) {
      if (externalDisplay && JSON.stringify(outputWindow?.getBounds) !== JSON.stringify(externalDisplay.bounds)) {
        outputWindow?.setBounds(externalDisplay.bounds)
      }
      outputWindow?.showInactive()
    } else {
      outputWindow?.hide()
      mainWindow?.webContents.send(OUTPUT, msg)
    }
  } else if (msg.channel.includes("MAIN")) mainWindow?.webContents.send(OUTPUT, msg)
  else outputWindow?.webContents.send(OUTPUT, msg)
})

let outputWindow: BrowserWindow | null = null
function createOutputWindow() {
  // https://www.electronjs.org/docs/latest/api/browser-window
  outputWindow = new BrowserWindow({
    width: externalDisplay?.bounds.width || 810,
    height: externalDisplay?.bounds.height || 610,
    x: externalDisplay?.bounds.x || 0,
    y: externalDisplay?.bounds.y || 0,
    transparent: true, // disable interaction (resize)
    alwaysOnTop: true, // keep window on top of other windows
    resizable: false, // disable resizing on mac and windows
    frame: false, // hide title/buttons
    type: "toolbar", // hide from taskbar
    fullscreen: true,
    skipTaskbar: true, // hide taskbar
    // focusable: false, // makes non focusable
    // titleBarStyle: "hidden", // hide titlebar
    // kiosk: true,
    // roundedCorners: false, // disable rounded corners on mac
    backgroundColor: "#000000",
    show: false,
    webPreferences: {
      // beta dev tools
      devTools: !isProd || Number(app.getVersion()[0]) > 1,
      preload: join(__dirname, "preload"), // use a preload script
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // get local files
      allowRunningInsecureContent: false,
    },
  })

  outputWindow.removeMenu() // hide menubar

  const url: string = isProd ? `file://${join(__dirname, "..", "..", "public", "index.html")}` : "http://localhost:3000"

  outputWindow.loadURL(url).catch((err) => {
    console.error(JSON.stringify(err))
    app.quit()
  })

  // TODO: get setting "auto display"
  if (externalDisplay) {
    outputWindow?.showInactive()
    mainWindow?.webContents.send(OUTPUT, { channel: "DISPLAY", data: true })
  }

  // toOutput("MAIN", { channel: "OUTPUT", data: "true" })
  // outputWindow.webContents.send("MAIN", { channel: "OUTPUT" })

  if (!isProd) outputWindow.webContents.openDevTools()
}

// LISTENERS

ipcMain.on(GET_SCREENS, (_e, args: string[] = ["screen"]) => {
  desktopCapturer.getSources({ types: args }).then(async (sources) => {
    try {
      const screens: any[] = []
      sources.map((source) => screens.push({ name: source.name, id: source.id }))
      toApp(GET_SCREENS, screens)
    } catch (err) {
      console.error(err)
    }
  })
})

ipcMain.on(OPEN_FOLDER, (_e, title: string) => {
  let folder: any = dialog.showOpenDialogSync(mainWindow!, { properties: ["openDirectory"], title: title })
  if (folder) toApp(OPEN_FOLDER, folder[0])
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
