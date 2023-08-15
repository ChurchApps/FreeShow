import { BrowserWindow } from "electron"
import { join } from "path"
import { isProd, mainWindow, toApp } from ".."
import { MAIN, OUTPUT, STARTUP } from "../../types/Channels"
import { Message } from "../../types/Socket"
import { startCapture, stopCapture, updatePreviewResolution } from "../ndi/capture"
import { createSenderNDI, stopSenderNDI } from "../ndi/ndi"
import { Output } from "./../../types/Output"
import { outputOptions } from "./windowOptions"
import { setDataNDI } from "../ndi/talk"

export let outputWindows: { [key: string]: BrowserWindow } = {}

// CREATE

async function createOutput(output: Output) {
    let id: string = output.id || ""

    if (outputWindows[id]) {
        // WIP has to restart because capture don't work when window is hidden...
        stopCapture(id)
        removeOutput(id, output)

        return
    }

    outputWindows[id] = createOutputWindow({ ...output.bounds, alwaysOnTop: output.alwaysOnTop !== false, kiosk: output.kioskMode === true, backgroundColor: output.transparent ? "#00000000" : "#000000" }, id, output.name)
    updateBounds(output)

    setTimeout(() => {
        startCapture(id, { ndi: output.ndi || false })
    }, 1200)

    // NDI
    if (output.ndi) await createSenderNDI(id, output.name)
    if (output.ndiData) setDataNDI({ id, ...output.ndiData })
}

function createOutputWindow(options: any, id: string, name: string) {
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

    window.on("ready-to-show", () => {
        mainWindow?.focus()
        window!.setMenu(null)
        window!.setTitle(name || "Output")
    })

    window.webContents.on("did-finish-load", () => {
        window!.webContents.send(STARTUP, { channel: "TYPE", data: "output" })
    })

    window.on("move", (e: any) => {
        if (!moveEnabled || updatingBounds) return e.preventDefault()

        let bounds = window?.getBounds()
        toApp(OUTPUT, { channel: "MOVE", data: { id, bounds } })
    })

    // open devtools
    // if (!isProd) window.webContents.openDevTools()

    return window
}

// REMOVE

export function closeAllOutputs() {
    Object.keys(outputWindows).forEach(removeOutput)
}

function removeOutput(id: string, reopen: any = null) {
    if (!outputWindows[id]) return

    stopCapture(id)
    stopSenderNDI(id)

    try {
        outputWindows[id].close()
    } catch (error) {
        console.log(error)
    }

    outputWindows[id].on("closed", () => {
        delete outputWindows[id]

        if (reopen) createOutput(reopen)
    })
}

// SHOW/HIDE

function displayOutput(data: any) {
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

    if (!window || window.isDestroyed()) {
        if (!data.output) return

        createOutput(data.output)
        window = outputWindows[data.output.id]
        if (!window) return
    }

    /////

    let bounds = data.output.bounds
    let xDif = bounds?.x - mainWindow!.getBounds().x
    let yDif = bounds?.y - mainWindow!.getBounds().y

    const margin = 50
    let windowNotCoveringMain: boolean = xDif > margin || yDif < -margin || (xDif < -margin && yDif > margin)

    if (bounds && (data.force || window.isAlwaysOnTop() === false || windowNotCoveringMain)) {
        showWindow(window)

        if (bounds) updateBounds(data.output)
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
    if (!window || window.isDestroyed()) return
    window.showInactive()

    window.moveTop()
}

function hideWindow(window: BrowserWindow) {
    if (!window || window.isDestroyed()) return

    window.setKiosk(false)
    window.hide()

    toApp(OUTPUT, { channel: "RESTART" })
}

// BOUNDS

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

function updateBounds(data: any) {
    let window: BrowserWindow = outputWindows[data.id]
    if (!window || window.isDestroyed()) return

    disableWindowMoveListener()

    window.setBounds(data.bounds)
    // has to be set twice to work first time
    setTimeout(() => {
        if (!window || window.isDestroyed()) return

        window.setBounds(data.bounds)
    }, 10)
}

// UPDATE

const setValues: any = {
    ndi: async (value: boolean, window: BrowserWindow, id: string) => {
        if (value) await createSenderNDI(id, window.getTitle())
        else stopSenderNDI(id)

        setValues.capture({ key: "ndi", value }, window, id)
    },
    capture: async (data: any, _window: BrowserWindow, id: string) => {
        startCapture(id, { [data.key]: data.value })
        // if (data.value) sendFrames(id, storedFrames[id], {[data.key]: true})
    },
    transparent: (value: boolean, window: BrowserWindow) => {
        window.setBackgroundColor(value ? "#00000000" : "#000000")
    },
    alwaysOnTop: (value: boolean, window: BrowserWindow) => {
        window.setAlwaysOnTop(value)
        window.setResizable(!value)
        window.setSkipTaskbar(value)
    },
    kioskMode: (value: boolean, window: BrowserWindow) => {
        window.setKiosk(value)
    },
}

async function updateValue({ id, key, value }: any) {
    let window: BrowserWindow = outputWindows[id]
    if (!window || window.isDestroyed()) return

    if (!setValues[key]) return
    setValues[key](value, window, id)
}

function moveToFront(id: string) {
    let window: BrowserWindow = outputWindows[id]
    if (!window || window.isDestroyed()) return

    window.moveTop()
}

// RESPONSES

const outputResponses: any = {
    CREATE: (data: any) => createOutput(data),
    REMOVE: (data: any) => removeOutput(data.id),
    DISPLAY: (data: any) => displayOutput(data),

    MOVE: (data: any) => (moveEnabled = data.enabled),

    UPDATE_BOUNDS: (data: any) => updateBounds(data),
    SET_VALUE: (data: any) => updateValue(data),
    TO_FRONT: (data: any) => moveToFront(data),

    PREVIEW_RESOLUTION: (data: any) => updatePreviewResolution(data),
}

export function receiveOutput(_e: any, msg: Message) {
    if (msg.channel.includes("MAIN")) return toApp(OUTPUT, msg)
    if (outputResponses[msg.channel]) return outputResponses[msg.channel](msg.data)

    sendToOutputWindow(msg)
}

function sendToOutputWindow(msg: any) {
    Object.entries(outputWindows).forEach(([id, window]: any) => {
        let tempMsg: any = JSON.parse(JSON.stringify(msg))

        // only send output with matching id
        if (msg.channel === "OUTPUTS") {
            if (!msg.data?.[id]) return
            tempMsg.data = { [id]: msg.data[id] }
        }

        if (msg.data?.id && msg.data.id !== id) return

        window.webContents.send(OUTPUT, tempMsg)
    })
}
