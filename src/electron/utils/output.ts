import { BrowserWindow, screen } from "electron"
import { join } from "path"
import { mainWindow, toApp } from ".."
import { MAIN, OUTPUT } from "../../types/Channels"
import { Message } from "../../types/Socket"
import { Output } from "./../../types/Output"
import { outputOptions } from "./windowOptions"
import { createSenderNDI, stopSenderNDI } from "../ndi/ndi"
import { startCapture, stopCapture } from "../ndi/capture"

const isProd: boolean = process.env.NODE_ENV === "production" || !/[\\/]electron/.exec(process.execPath)

export let outputWindows: { [key: string]: BrowserWindow } = {}
export function createOutput(output: Output) {
    let id: string = output.id || ""

    if (outputWindows[id]) outputWindows[id].close()

    outputWindows[id] = createOutputWindow({ ...output.bounds, alwaysOnTop: output.alwaysOnTop !== false, kiosk: output.kioskMode === true }, id)
    // outputWindows[id].on("closed", () => removeOutput(id))
}

export function closeAllOutputs() {
    Object.keys(outputWindows).forEach(removeOutput)
}

export function updateOutput(data: any) {
    let window = outputWindows[data.id]
    let bounds = window.getBounds()
    disableWindowMoveListener()
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

    stopSenderNDI(id)
    stopCapture(id)
}

function createOutputWindow(options: any, id: string) {
    options = { ...outputOptions, ...options }
    if (options.alwaysOnTop === false) {
        options.skipTaskbar = false
        options.resizable = true
    }

    let window: BrowserWindow | null = new BrowserWindow(options)

    // only win & linux
    // window.removeMenu() // hide menubar
    // window.setAutoHideMenuBar(true) // hide menubar

    window.setSkipTaskbar(options.skipTaskbar) // hide from taskbar
    if (process.platform === "darwin") window.minimize() // hide on mac

    if (options.alwaysOnTop) window.setAlwaysOnTop(true, "pop-up-menu", 1)
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

    window.on("move", (e: any) => {
        if (!moveEnabled || updatingBounds) return e.preventDefault()
        let bounds = window?.getBounds()
        toApp(OUTPUT, { channel: "MOVE", data: { id, bounds } })
    })

    window.on("close", () => {
        toApp(OUTPUT, { channel: "DISPLAY", data: { enabled: false } })
    })
    window.on("closed", () => {
        delete outputWindows[id]
    })

    return window
}

export async function displayOutput(data: any) {
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

    window.setTitle(data.output?.name || "FreeShow")
    let bounds = data.output.bounds
    disableWindowMoveListener()

    // /////////////////////

    // TODO: set output screen + pos, if nothing set on startup

    // console.log("Display: ", bounds?.x, bounds?.y, bounds?.width, bounds?.height)

    // && JSON.stringify(bounds) !== JSON.stringify(outputWindow?.getBounds())
    let xDif = bounds?.x - mainWindow!.getBounds().x
    let yDif = bounds?.y - mainWindow!.getBounds().y

    let windowNotCoveringMain: boolean = xDif > 50 || yDif < -50 || (xDif < -50 && yDif > 50)

    // WIP Enabling output window over internal screen never working on mac!
    // if (!windowNotCoveringMain && process.platform === "darwin")

    // console.log(bounds, xDif, yDif, windowNotCoveringMain)
    if (bounds && (data.force || window.isAlwaysOnTop() === false || windowNotCoveringMain)) {
        // , !data.force
        showWindow(window)

        if (bounds) {
            window?.setBounds(bounds)
            // has to be set twice to work first time
            setTimeout(() => {
                window?.setBounds(bounds)
            }, 10)
        }

        ///// NDI

        if (data.output?.ndi) {
            await createSenderNDI(data.output.id, window.getTitle())
            startCapture(data.output.id)
        }
    } else {
        hideWindow(window)
        data.enabled = false
        if (!data.auto) toApp(MAIN, { channel: "ALERT", data: "error.display" })
    }

    toApp(OUTPUT, { channel: "DISPLAY", data })
}

// MacOS Menu Bar
// https://stackoverflow.com/questions/39091964/remove-menubar-from-electron-app
// https://stackoverflow.com/questions/69629262/how-can-i-hide-the-menubar-from-an-electron-app
// https://github.com/electron/electron/issues/1415
// https://github.com/electron/electron/issues/1054

function showWindow(window: BrowserWindow) {
    if (!window) return
    window.showInactive()

    window.moveTop()
}

function hideWindow(window: BrowserWindow) {
    if (!window) return

    window.setKiosk(false)
    window.hide()
}

let moveEnabled: boolean = false
let updatingBounds: boolean = false
let boundsTimeout: any = null
function disableWindowMoveListener() {
    updatingBounds = true
    if (boundsTimeout) clearTimeout(boundsTimeout)
    boundsTimeout = setTimeout(() => {
        updatingBounds = false
        boundsTimeout = null
    }, 1000)
}

export function updateBounds(data: any) {
    let window: BrowserWindow = outputWindows[data.id]
    if (!window) return

    disableWindowMoveListener()

    window.setBounds({ ...data.bounds, height: data.bounds.height - 1 })
    setTimeout(() => {
        window.setBounds(data.bounds)
    }, 10)
}

export async function setValue({ id, key, value }: any) {
    let window: BrowserWindow = outputWindows[id]
    if (!window) return

    if (key === "ndi") {
        if (!window.isVisible()) return

        if (value) {
            await createSenderNDI(id, window.getTitle())
            startCapture(id)
        } else {
            stopSenderNDI(id)
            stopCapture(id)
        }

        return
    }

    if (key === "alwaysOnTop") {
        window.setAlwaysOnTop(value)
        window.setResizable(!value)
        window.setSkipTaskbar(value)
    } else if (key === "kioskMode") window.setKiosk(value)
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
    MOVE: (data: any) => (moveEnabled = data.enabled),
    CREATE: (data: any) => createOutput(data),
    DISPLAY: (data: any) => displayOutput(data),
    UPDATE: (data: any) => updateOutput(data),
    UPDATE_BOUNDS: (data: any) => updateBounds(data),
    SET_VALUE: (data: any) => setValue(data),
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
