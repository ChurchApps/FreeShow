import { READ_FOLDER, SHOW, STORE } from "./../types/Channels"
// const { ValidChannels, Data } = require("./src/types/Channels")
import { app, BrowserWindow, ipcMain, dialog, desktopCapturer, screen } from "electron"
import { Display } from "electron/main"
import { join } from "path"
import { URL } from "url"
import { GET_SCREENS, MAIN, OPEN_FILE, OUTPUT, OPEN_FOLDER, FILE_INFO } from "../types/Channels"
import path from "path"
import fs from "fs"
import { settings, electronSettings, shows, stageShows, projects, overlays, templates, events, themes } from "./utils/store"
import checkForUpdates from "./utils/updater"
// import express from express();
// import express from "./server/connection")

// WIP: Tray / push notifications
// https://www.webtips.dev/how-to-make-your-very-first-desktop-app-with-electron-and-svelte

const isProd: boolean = process.env.NODE_ENV === "production" || !/[\\/]electron/.exec(process.execPath)

electronSettings.set("loaded", true)
if (!electronSettings.get("loaded")) console.log("Error! Could not get stored data.")

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
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

  // check for uodates
  if (isProd) checkForUpdates()
})

let loadingWindow: BrowserWindow | null = null
const createLoading = () => {
  loadingWindow = new BrowserWindow({
    width: 500,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    icon: "public/freeshow.ico",
    webPreferences: { nodeIntegration: true, contextIsolation: false, enableRemoteModule: true },
  })
  loadingWindow.loadFile("public/loading.html")
  // if (!isProd) loadingWindow.webContents.openDevTools()
}

ipcMain.once("LOADED", () => {
  mainWindow?.show()
  loadingWindow?.close()
  loadingWindow = null
})

const createWindow = () => {
  let width: number = electronSettings.get("width")
  let height: number = electronSettings.get("height")
  let maximized: boolean = electronSettings.get("maximized")

  mainWindow = new BrowserWindow({
    width,
    height,
    frame: false,
    icon: "public/freeshow.ico",
    autoHideMenuBar: process.platform === "win32",
    // show: false,
    webPreferences: {
      devTools: isProd ? false : true,
      // preload: join(__dirname, "preload.js"), // use a preload script
      preload: join(__dirname, "preload"), // use a preload script
      webSecurity: false, // load local files
      // preload: "./preload",
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      allowRunningInsecureContent: false,
    },
  })

  const url =
    // process.env.NODE_ENV === "production"
    isProd
      ? // in production, use the statically build version of our application
        `file://${join(__dirname, "public", "index.html")}`
      : // in dev, target the host and port of the local rollup web server
        "http://localhost:3000"

  mainWindow.loadURL(url).catch((err) => {
    console.error(JSON.stringify(err))
    app.quit()
  })
  // mainWindow.loadURL(`file://${join("./", "public", "index.html")}`)
  // mainWindow.loadFile("./public/index.html")
  // mainWindow.loadFile(join(__dirname, "public", "index.html")).catch((err) => {
  //   console.error(JSON.stringify(err))
  //   app.quit()
  // })

  if (!isProd) mainWindow.webContents.openDevTools()

  mainWindow.on("maximize", () => electronSettings.set("maximized", true))
  mainWindow.on("unmaximize", () => electronSettings.set("maximized", false))
  mainWindow.on("resize", () => {
    let { width, height } = mainWindow!.getBounds()
    electronSettings.set("width", width)
    electronSettings.set("height", height)
  })

  if (maximized) mainWindow.maximize()

  mainWindow.on("closed", () => {
    mainWindow = null
  })

  mainWindow.once("ready-to-show", () => {
    // mainWindow?.show()
    createOutputWindow()
  })
}

// those two events are completely optional to subscrbe to, but that's a common way to get the
// user experience people expect to have on macOS: do not quit the application directly
// after the user close the last window, instead wait for Command + Q (or equivalent).
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

// app.on("activate", () => {
//   if (mainWindow === null) createWindow()
// })

app.on("web-contents-created", (e, contents) => {
  console.info(e)
  // Security of webviews
  contents.on("will-attach-webview", (event, webPreferences, params) => {
    console.info(event, params)
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

//   // https://www.electronjs.org/docs/api/menu
//   // const menu = new Menu();

//   // menu.append(
//   //   new MenuItem({
//   //     label: "Save",
//   //     accelerator: "CmdOrCtrl+S",
//   //     click: () => toApp("savefile"),
//   //   })
//   // );
//   // menu.append(
//   //   new MenuItem({
//   //     label: "Open",
//   //     accelerator: "CmdOrCtrl+O",
//   //     click: openFile,
//   //   })
//   // );
//   // menu.append(
//   //   new MenuItem({
//   //     role: "reload",
//   //     accelerator: "CmdOrCtrl+R",
//   //   })
//   // );

//   // Menu.setApplicationMenu(menu);

//   // ipcMain.on('show-context-menu', (event) => {
//   //   const template = [
//   //     {
//   //       role: 'reload'
//   //     },
//   //   ]
//   //   const menu = Menu.buildFromTemplate(template)
//   //   menu.popup(BrowserWindow.fromWebContents(event.sender))
//   // })

//   // ipcMain.on("savenewfile", (e, content) => {
//   //   createNewFile(content);
//   // });
//   // ipcMain.on("saveexistingfile", (e, { path, content }) => {
//   //   fs.writeFile(path, content, err => {
//   //     if (err) return;
//   //   });
//   // });

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

// DISPLAY WINDOW

// const toApp = (channel, args): void => mainWindow.webContents.send(channel, args)
// module.exports = toApp
export const toApp = (channel: string, ...args: any[]) => mainWindow?.webContents.send(channel, ...args)

// ipcMain.handle("displayMessage", text => dialog.showMessageBox(text))

const updateShowsPath = (path: string) => {
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true })
}

const os = require("os")
ipcMain.on(MAIN, (e, msg) => {
  let data: any
  if (msg.channel === "GET_OS") data = { platform: os.platform(), name: os.hostname() }
  else if (msg.channel === "VERSION") data = app.getVersion()
  else if (msg.channel === "DISPLAY") data = outputWindow?.isVisible()
  else if (msg.channel === "GET_PATHS") {
    data = {
      documents: app.getPath("documents"),
      pictures: app.getPath("pictures"),
      videos: app.getPath("videos"),
      music: app.getPath("music"),
    }

    // create documents/Shows
    updateShowsPath(path.resolve(data.documents, "Shows"))
  } else if (msg.channel === "OUTPUT") {
    console.log(e.sender.id, outputWindow?.id, outputWindow?.webContents.id)
    // e.reply(MAIN, { channel: "OUTPUT", data: e.sender.id === outputWindow?.webContents.id ? "true" : "false" })
    data = e.sender.id === outputWindow?.webContents.id ? "true" : "false"
  } else if (msg.channel === "CLOSE") {
    mainWindow?.close()
    outputWindow?.close()
  } else if (msg.channel === "MAXIMIZE") {
    if (mainWindow?.isMaximized()) mainWindow?.unmaximize()
    else mainWindow?.maximize()
    data = mainWindow?.isMaximized()
  } else if (msg.channel === "MAXIMIZED") {
    data = mainWindow?.isMaximized()
  } else if (msg.channel === "MINIMIZE") {
    mainWindow?.minimize()
  } else {
    data = msg
  }
  if (data) e.reply(MAIN, { channel: msg.channel, data })
})

let displays: Display[] = []
// TODO: get this from settings...
let externalDisplay: Display | null = null

// create output
ipcMain.on(OUTPUT, (_e, msg: any) => {
  if (msg.channel === "DISPLAY") {
    if (msg.data === true) {
      if (externalDisplay && JSON.stringify(outputWindow?.getBounds) !== JSON.stringify(externalDisplay.bounds)) {
        outputWindow?.setBounds(externalDisplay.bounds)
        // outputWindow?.setSize(externalDisplay.bounds.width, externalDisplay.bounds.height)
        // outputWindow?.setPosition(externalDisplay.bounds.x + 50, externalDisplay.bounds.y + 50)
      }
      outputWindow?.show()
    } else outputWindow?.hide()
  } else if (msg.channel.includes("MAIN")) {
    mainWindow?.webContents.send(OUTPUT, msg)
  } else {
    outputWindow?.webContents.send(OUTPUT, msg)
  }
})
// https://stackoverflow.com/questions/51808712/electronjs-multiple-monitors
// export const toOutput = (channel: string, ...args: any[]) => outputWindow?.webContents.send(channel, args)
// app.whenReady().then(() => {
//   displays = screen.getAllDisplays()
//   // TODO: get this from settings...
//   externalDisplay =
//     displays.find((display) => {
//       return display.bounds.x !== 0 || display.bounds.y !== 0
//     }) || null

//   createOutputWindow()
// })
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
    roundedCorners: false, // disable rounded corners on mac
    backgroundColor: "#000",
    show: false,
    webPreferences: {
      devTools: true,
      preload: join(__dirname, "preload"), // use a preload script
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // get local files,
      allowRunningInsecureContent: false,
    },
  })
  // show: false, // hide window
  // titleBarStyle: "hidden", // hide titlebar
  // kiosk: true,

  // Menu.setApplicationMenu(null) // hide menubar (all windows)
  outputWindow.removeMenu() // hide menubar
  // outputWindow.setMenuBarVisibility(false)

  // outputWindow.setIgnoreMouseEvents(true) // hide window on click

  const url =
    // process.env.NODE_ENV === "production"
    isProd
      ? // in production, use the statically build version of our application
        `file://${join(__dirname, "public", "index.html")}`
      : // in dev, target the host and port of the local rollup web server
        "http://localhost:3000"

  outputWindow.loadURL(url).catch((err) => {
    console.error(JSON.stringify(err))
    app.quit()
  })

  if (externalDisplay) {
    // outputWindow?.setBounds(externalDisplay.bounds)
    // console.log(externalDisplay)
    // console.log(externalDisplay.bounds)

    // outputWindow.setSize(externalDisplay.bounds.width, externalDisplay.bounds.height)
    // outputWindow.setPosition(externalDisplay.bounds.x + 50, externalDisplay.bounds.y + 50)
    outputWindow?.show()
    mainWindow?.webContents.send(OUTPUT, { channel: "DISPLAY", data: true })
  }

  // outputWindow.webContents.openDevTools()
  // outputWindow.maximize()
  // outputWindow.show()

  // toOutput("MAIN", { channel: "OUTPUT", data: "true" })
  // outputWindow.webContents.send("MAIN", { channel: "OUTPUT" })

  if (!isProd) outputWindow.webContents.openDevTools()
}

// LISTENERS

ipcMain.on(GET_SCREENS, (_e, args: string[] = ["screen"]) => {
  // ["window", "screen"]
  desktopCapturer.getSources({ types: args }).then(async (sources) => {
    try {
      const screens: any[] = []
      sources.map((source) => screens.push({ name: source.name, id: source.id }))
      // sources.map((source) => screens.push(source))
      toApp(GET_SCREENS, screens)

      // const videoOptionsMenu = Menu.buildFromTemplate(
      //   sources.map(source => {
      //     return {
      //       label: source.name,
      //       click: () => toApp('getScreens', source)
      //     }
      //   })
      // );

      // videoOptionsMenu.popup();
    } catch (err) {
      console.error("Error:", err)
    }
  })
})

// WIP https://github.com/electron/electron/issues/1948
ipcMain.on(OPEN_FILE, (_e, args) => {
  if (!args.filters) args.filters = [{ name: "All", extensions: ["*"] }]
  if (!args.title) args.title = "Test"

  let file = dialog.showOpenDialogSync(mainWindow!, {
    properties: ["openFile"],
    filters: args.filters,
    title: args.title,
  })

  if (file) {
    toApp(MAIN, file)
    // server(file);
    // toApp("openFile", {
    //   path: chunk(file),
    //   // content: data,
    // });
    // toApp('openFile', "./video");
    toApp(OPEN_FILE, file)
    // fs.readFile(file[0], "utf8", (err, data) => {
    //   toApp('main', err);
    //   toApp('main', data);
    //   if (err) return;

    //   toApp("openFile", {
    //     path: chunk(path),
    //     // content: data,
    //   });

    //   // toApp("openFile", {
    //   //   path: file[0],
    //   //   // content: data,
    //   // });
    // });
  }
  // fs.readFile(args.path, (error, data) => {
  //   // Do something with file contents

  //   // Send result back to renderer process
  //   toApp("openedFile", {data, error});
  // });
})

ipcMain.on(OPEN_FOLDER, (_e, title: string) => {
  let folder: any = dialog.showOpenDialogSync(mainWindow!, {
    properties: ["openDirectory"],
    title: title,
  })

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
  // const pathToFile: string = path.join(filePath)
  const stat = fs.statSync(filePath)
  const [extension] = filePath.substring(filePath.lastIndexOf("\\") + 1).match(/\.[0-9a-z]+$/i) || [""]

  toApp(FILE_INFO, { path: filePath, stat, extension: extension.substring(1) })
})

// server
// express.use(express.static(path.join(__dirname, 'public')))

// express.get('/', function(req, res) {
//   res.sendFile(path.join(__dirname + '/index.htm'))
// })

// function server(path: string) {
//   // express.get("/video", function (req, res) {
//   //   const stat = fs.statSync(path)
//   //   const fileSize = stat.size
//   //   const range = req.headers.range
//   //   if (range) {
//   //     const parts = range.replace(/bytes=/, "").split("-")
//   //     const start = parseInt(parts[0], 10)
//   //     const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
//   //     if (start >= fileSize) {
//   //       res.status(416).send("Requested range not satisfiable\n" + start + " >= " + fileSize)
//   //       return
//   //     }
//   //     const chunksize = end - start + 1
//   //     const file = fs.createReadStream(path, { start, end })
//   //     const head = {
//   //       "Content-Range": `bytes ${start}-${end}/${fileSize}`,
//   //       "Accept-Ranges": "bytes",
//   //       "Content-Length": chunksize,
//   //       "Content-Type": "video/mp4",
//   //     }
//   //     res.writeHead(206, head)
//   //     file.pipe(res)
//   //   } else {
//   //     const head = {
//   //       "Content-Length": fileSize,
//   //       "Content-Type": "video/mp4",
//   //     }
//   //     res.writeHead(200, head)
//   //     fs.createReadStream(path).pipe(res)
//   //   }
//   // })
// }

// express.listen(3000, function () {
//   console.log('Listening on port 3000!')
// })

// function chunk(path) {
//   const stat = fs.statSync(path)
//   const fileSize = stat.size
//   const range = req.headers.range

//   if (range) {
//     const parts = range.replace(/bytes=/, "").split("-")
//     const start = parseInt(parts[0], 10)
//     const end = parts[1]
//       ? parseInt(parts[1], 10)
//       : fileSize-1

//     if(start >= fileSize) {
//       res.status(416).send('Requested range not satisfiable\n'+start+' >= '+fileSize);
//       return
//     }

//     const chunksize = (end-start)+1
//     const file = fs.createReadStream(path, {start, end})
//     const head = {
//       'Content-Range': `bytes ${start}-${end}/${fileSize}`,
//       'Accept-Ranges': 'bytes',
//       'Content-Length': chunksize,
//       'Content-Type': 'video/mp4',
//     }

//     // res.writeHead(206, head)
//     // file.pipe(res)
//     return file
//   } else {
//     const head = {
//       'Content-Length': fileSize,
//       'Content-Type': 'video/mp4',
//     }
//     // res.writeHead(200, head)
//     // fs.createReadStream(path).pipe(res)
//     return fs.createReadStream(path)
//   }
// }
