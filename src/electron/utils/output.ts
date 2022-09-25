import { BrowserWindow, screen } from "electron"
import { join } from "path"
import { dialogClose, mainWindow, toApp } from ".."
import { MAIN, OUTPUT } from "../../types/Channels"
import { Message } from "../../types/Socket"
import { Output } from "./../../types/Output"
import { outputOptions } from "./windowOptions"

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
  try {
    outputWindows[id].close()
  } catch (error) {
    console.log(error)
  }

  delete outputWindows[id]
  // send to app ?
}

function createOutputWindow(options: any) {
  options = { ...options.bounds, ...outputOptions }
  let window: BrowserWindow | null = new BrowserWindow(options)

  // only win & linux
  // window.removeMenu() // hide menubar
  // window.setAutoHideMenuBar(true) // hide menubar

  window.setSkipTaskbar(true) // hide from taskbar
  if (process.platform === "darwin") window.minimize() // hide on mac

  window.setAlwaysOnTop(true, "pop-up-menu", 1)
  // window.setVisibleOnAllWorkspaces(true)

  const url: string = isProd ? `file://${join(__dirname, "..", "..", "..", "public", "index.html")}` : "http://localhost:3000"

  window.loadURL(url).catch((err) => {
    console.error(JSON.stringify(err))
  })

  // toOutput("MAIN", { channel: "OUTPUT", data: "true" })
  // window.webContents.send("MAIN", { channel: "OUTPUT" })
  // if (!isProd) window.webContents.openDevTools()

  window.on("ready-to-show", () => {
    mainWindow?.focus()
    window?.setMenu(null)
  })

  window.on("close", (e) => {
    if (!dialogClose) e.preventDefault()
  })

  return window
}

export function displayOutput(data: any) {
  let window: BrowserWindow = outputWindows[data.output?.id]

  if (data.enabled === "toggle") data.enabled = !window?.isVisible()

  if (!data.enabled) {
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

  // console.log("Display: ", bounds?.x, bounds?.y, bounds?.width, bounds?.height)

  // && JSON.stringify(bounds) !== JSON.stringify(outputWindow?.getBounds())
  let xDif = bounds?.x - mainWindow!.getBounds().x
  let yDif = bounds?.y - mainWindow!.getBounds().y

  let windowNotCoveringMain: boolean = xDif > 50 || yDif < -50 || (xDif < -50 && yDif > 50)
  // console.log(bounds, xDif, yDif, windowNotCoveringMain)
  if (bounds && (data.force || windowNotCoveringMain)) {
    // , !data.force
    showWindow(window)

    if (bounds) {
      window?.setBounds(bounds)
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

// , fullscreen: boolean = false
function showWindow(window: BrowserWindow) {
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

  // if (process.platform === "darwin") {
  //   setTimeout(() => {
  //     window.maximize()
  //     if (fullscreen) {
  //       // ... ??
  //       // window.setFullScreen(true)
  //     }
  //     setTimeout(() => {
  //       // focus on mac
  //       mainWindow?.focus()
  //     }, 10)
  //   }, 100)
  // }

  window.moveTop()
}

function hideWindow(window: BrowserWindow) {
  if (!window) return

  // if (process.platform === "darwin") {
  //   // window.setFullScreen(false)
  //   // setTimeout(() => {
  //   window.minimize()
  //   // }, 100)
  // }
  window.hide()
}

export function updateBounds(data: any) {
  let window: BrowserWindow = outputWindows[data.id]
  if (!window) return

  // let wasVisible: boolean = window.isVisible()
  // window.setKiosk(data.kiosk)
  // if (!data.kiosk) {
  window.setBounds({ ...data.bounds, height: data.bounds.height - 1 })
  // window.setAspectRatio(data.bounds.width / data.bounds.height)
  setTimeout(() => {
    window.setBounds(data.bounds)

    // TODO: creating "ghost" window when kiosk is diasabled
    // setTimeout(() => {
    //   console.log(window.isVisible(), !wasVisible)
    //   if (window.isVisible() && !wasVisible) hideWindow(window)
    // }, 500)
  }, 10)
  // } else window.setBounds(data.bounds)
}

// temporary function to test on mac
export function toggleValue({ id, key }: any) {
  let window: BrowserWindow = outputWindows[id]
  if (key === "maximize") window.isMaximized() ? window.unmaximize() : window.maximize()
  else if (key === "minimize") window.isMinimized() ? false : window.minimize()
  else if (key === "fullscreen") window.setFullScreen(!window.isFullScreen())
  else if (key === "kiosk") window.setKiosk(window.isKiosk())
  else if (key === "hide") window.isVisible() ? window.hide() : window.show()
  else if (key === "disabled") window.setEnabled(!window.isEnabled())
  else if (key === "menubar") window.setAutoHideMenuBar(!window.isMenuBarAutoHide())
  else if (key === "workspaces") window.setVisibleOnAllWorkspaces(!window.isVisibleOnAllWorkspaces())
  else if (key === "alwaysontop") window.isAlwaysOnTop() ? window.setAlwaysOnTop(false) : window.setAlwaysOnTop(true, "screen-saver", 1)
  else if (key === "alwaysontop2") window.isAlwaysOnTop() ? window.setAlwaysOnTop(false) : window.setAlwaysOnTop(true, "pop-up-menu", 1)
  // window.setVisibleOnAllWorkspaces(true, {visibleOnFullScreen: true});

  let state = {
    maximized: window.isMaximized(),
    minimized: window.isMinimized(),
    fullscreen: window.isFullScreen(),
    kiosk: window.isKiosk(),
    visible: window.isVisible(),
    enabled: window.isEnabled(),
    autoHideMenuBar: window.isMenuBarAutoHide(),
    allWorkspaces: window.isVisibleOnAllWorkspaces(),
  }

  console.log("state", JSON.stringify(state))
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

// RESPONSES

const outputResponses: any = {
  CREATE: (data: any) => createOutput(data),
  DISPLAY: (data: any) => displayOutput(data),
  UPDATE: (data: any) => updateOutput(data),
  UPDATE_BOUNDS: (data: any) => updateBounds(data),
  TOGGLE_VALUE: (data: any) => toggleValue(data),
  TO_FRONT: (data: any) => moveToFront(data),
}

export function receiveOutput(_e: any, msg: Message) {
  if (msg.channel.includes("MAIN")) return toApp(OUTPUT, msg)
  if (outputResponses[msg.channel]) return outputResponses[msg.channel](msg.data)
  sendToOutputWindow(msg)
}

// LISTENERS

export function displayAdded(_e: any) {
  // , display
  // TODO: !outputWindow?.isEnabled()
  // if (true) toApp(OUTPUT, { channel: "SCREEN_ADDED", data: display.id.toString() })

  toApp(OUTPUT, { channel: "GET_DISPLAYS", data: screen.getAllDisplays() })
}

export function displayRemoved(_e: any) {
  // TODO: ...
  // let outputMonitor = screen.getDisplayNearestPoint({ x: outputWindow!.getBounds().x, y: outputWindow!.getBounds().y })
  // let mainMonitor = screen.getDisplayNearestPoint({ x: mainWindow!.getBounds().x, y: mainWindow!.getBounds().y })
  // if (outputMonitor.id === mainMonitor.id) {
  //   // if (outputScreenId === display.id.toString()) {
  //   outputWindow?.hide()
  //   if (process.platform === "darwin") {
  //     outputWindow?.setFullScreen(false)
  //     setTimeout(() => {
  //       outputWindow?.minimize()
  //     }, 100)
  //   }
  //   toApp(OUTPUT, { channel: "DISPLAY", data: { enabled: false } })
  // }

  toApp(OUTPUT, { channel: "GET_DISPLAYS", data: screen.getAllDisplays() })
}
