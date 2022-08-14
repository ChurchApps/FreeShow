import { app, BrowserWindow } from "electron"
import { join } from "path"
import { mainWindow, toApp } from ".."
import { MAIN, OUTPUT } from "../../types/Channels"
import { Output } from "./../../types/Output"

const isProd: boolean = process.env.NODE_ENV === "production" || !/[\\/]electron/.exec(process.execPath)

let outputWindows: { [key: string]: BrowserWindow } = {}
export function createOutput(output: Output) {
  let id: string = output.id || ""

  if (outputWindows[id]) outputWindows[id].close()

  outputWindows[id] = createOutputWindow({ bounds: output.bounds })
  // outputWindows[id].on("closed", () => removeOutput(id))
}

export function closeAllOutputs() {
  Object.keys(outputWindows).forEach(removeOutput)
}

export function updateOutput(data: any) {
  let window = outputWindows[data.id]
  let bounds = window.getBounds()
  if (data.window?.position) bounds = { ...bounds, x: data.window.position.x, y: data.window.position.y }
  if (data.window?.size) bounds = { ...bounds, width: data.window.size.width, height: data.window.size.height }
  window.setBounds(data.window.position)

  // send() to output window
}

export function removeOutput(id: string) {
  if (!outputWindows[id]) return
  // close window
  outputWindows[id].close()
  delete outputWindows[id]
  // send to app ?
}

let outputWindowSettings: any = {
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
  backgroundColor: "#000000",
  show: false,
  webPreferences: {
    // beta dev tools
    devTools: !isProd || Number(app.getVersion()[0]) === 0,
    preload: join(__dirname, "..", "preload"), // use a preload script
    contextIsolation: true,
    webSecurity: isProd, // get local files
    allowRunningInsecureContent: false,
  },
}
function createOutputWindow(options: any) {
  // https://www.electronjs.org/docs/latest/api/browser-window

  outputWindowSettings = { ...options.bounds, ...outputWindowSettings }
  let window: BrowserWindow | null = new BrowserWindow(outputWindowSettings)

  window.removeMenu() // hide menubar
  if (process.platform === "darwin") window.minimize() // hide on mac
  window.setAlwaysOnTop(true, "pop-up-menu", 1)
  // window.setVisibleOnAllWorkspaces(true)

  const url: string = isProd ? `file://${join(__dirname, "..", "..", "public", "index.html")}` : "http://localhost:3000"

  window.loadURL(url).catch((err) => {
    console.error(JSON.stringify(err))
  })

  // toOutput("MAIN", { channel: "OUTPUT", data: "true" })
  // window.webContents.send("MAIN", { channel: "OUTPUT" })
  // if (!isProd) window.webContents.openDevTools()

  window.on("ready-to-show", () => {
    mainWindow?.focus()
  })

  return window
}

export function displayOutput(data: any) {
  let window: BrowserWindow = outputWindows[data.output?.id]

  if (data.enabled === "toggle") data.enabled = !window?.isVisible()

  if (!data.enabled) {
    // TODO: hide on double click
    console.log("hide")
    let windows = [window]
    if (!windows[0]) {
      windows = Object.values(outputWindows)
    }
    windows.forEach((window) => hideWindow(window))
    if (data.one !== true) toApp(OUTPUT, { channel: "DISPLAY", data })
    return
  }

  if (!window) {
    if (!data.output) return
    createOutput(data.output)
    window = outputWindows[data.output.id]
  }

  let bounds = data.output.bounds
  console.log(data.output.name)

  // /////////////////////

  // let outputScreen: any = null

  // if (!bounds || (bounds?.width === 0 && bounds?.height === 0) || data.reset) {
  //   if (data.screen) {
  //     outputScreen =
  //       displays.find((display) => {
  //         return display.id.toString() === data.screen
  //       }) || null
  //   }
  //   if (!outputScreen) {
  //     outputScreen =
  //       displays.find((display) => {
  //         return display.bounds.x !== mainWindow?.getBounds().x || display.bounds.y !== mainWindow?.getBounds().y
  //       }) || null
  //     if (outputScreen) toApp(MAIN, { channel: "SET_SCREEN", data: outputScreen })
  //   }
  //   // outputScreenId = outputScreen ? outputScreen.id.toString() : null

  //   bounds = outputScreen?.bounds || null
  //   toApp(OUTPUT, { channel: "POSITION", data: bounds })
  // }

  // if (outputScreen?.internal && screen.getDisplayMatching(mainWindow!.getBounds()).internal) outputScreen = null

  // /////////////////////

  // TODO: set output screen + pos, if nothing set on startup

  console.log("Display: ", bounds?.x, bounds?.y, bounds?.width, bounds?.height)

  // && JSON.stringify(bounds) !== JSON.stringify(outputWindow?.getBounds())
  let xDif = bounds?.x - mainWindow!.getBounds().x
  let yDif = bounds?.y - mainWindow!.getBounds().y

  let windowNotCoveringMain: boolean = xDif > 50 || yDif < -50 || (xDif < -50 && yDif > 50)
  console.log(bounds, xDif, yDif, windowNotCoveringMain)
  if (bounds && (data.force || windowNotCoveringMain)) {
    showWindow(window, !data.force)

    if (bounds) {
      window?.setBounds(bounds)
      console.log("set bounds")
      // has to be set twice to work first time
      setTimeout(() => {
        window?.setBounds(bounds)
      }, 10)
    }
  } else {
    hideWindow(window)
    data.enabled = false
    toApp(MAIN, { channel: "ALERT", data: "error.display" })
  }

  toApp(OUTPUT, { channel: "DISPLAY", data })
}

function showWindow(window: BrowserWindow, fullscreen: boolean = false) {
  if (!window) return
  // TODO: output task bar
  // window.setVisibleOnAllWorkspaces(true)
  window.showInactive()
  // window.show()
  // window.maximize()
  // window.blur()
  // mainWindow?.focus()
  // window.setFullScreen(true)
  // window.setAlwaysOnTop(true, "pop-up-menu", 1)
  // window.setAlwaysOnTop(true, "pop-up-menu")
  // window.setFullScreenable(false)
  // window.setAlwaysOnTop(true, "screen-saver", 1)
  // window.setAlwaysOnTop(true, 'floating')

  if (process.platform === "darwin") {
    setTimeout(() => {
      window.maximize()
      if (fullscreen) {
        // ... ??
        // window.setFullScreen(true)
      }
      setTimeout(() => {
        // focus on mac
        mainWindow?.focus()
      }, 10)
    }, 100)
  }

  window.moveTop()

  console.log("showing", window.isVisible())
}

function hideWindow(window: BrowserWindow) {
  if (!window) return

  if (process.platform === "darwin") {
    // window.setFullScreen(false)
    // setTimeout(() => {
    window.minimize()
    // }, 100)
  }
  window.hide()
}

export function updateBounds(data: any) {
  let window: BrowserWindow = outputWindows[data.id]
  if (!window) return

  // let wasVisible: boolean = window.isVisible()
  window.setKiosk(data.kiosk)
  if (!data.kiosk) {
    window.setBounds({ ...data.bounds, height: data.bounds.height - 1 })
    setTimeout(() => {
      window.setBounds(data.bounds)

      // TODO: creating "ghost" window when kiosk is diasabled
      // setTimeout(() => {
      //   console.log(window.isVisible(), !wasVisible)
      //   if (window.isVisible() && !wasVisible) hideWindow(window)
      // }, 500)
    }, 10)
  } else window.setBounds(data.bounds)
}

export function moveToFront(id: string) {
  let window: BrowserWindow = outputWindows[id]
  if (!window) return

  window.moveTop()
}

export function sendToOutputWindow(msg: any) {
  Object.entries(outputWindows).forEach(([id, window]: any) => {
    let tempMsg: any = JSON.parse(JSON.stringify(msg))

    // only send output with matching id
    if (msg.channel === "OUTPUTS") {
      // if (!msg.data[id]) createOutput(msg.data[id])
      if (msg.data?.[id]) tempMsg.data = { [id]: msg.data[id] }
    }

    if (msg.data?.id && msg.data?.id !== id) return

    window.webContents.send(OUTPUT, tempMsg)
  })
}
