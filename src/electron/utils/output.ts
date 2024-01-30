import { BrowserWindow, Rectangle, screen } from "electron"
import { isMac, loadWindowContent, mainWindow, toApp } from ".."
import { MAIN, OUTPUT } from "../../types/Channels"
import { Message } from "../../types/Socket"
import { startCapture, stopCapture, updatePreviewResolution } from "../ndi/capture"
import { createSenderNDI, stopSenderNDI } from "../ndi/ndi"
import { setDataNDI } from "../ndi/talk"
import { Output } from "./../../types/Output"
import { outputOptions, screenIdentifyOptions } from "./windowOptions"

export let outputWindows: { [key: string]: BrowserWindow } = {}

// CREATE

async function createOutput(output: Output) {
    let id: string = output.id || ""

    if (outputWindows[id]) return removeOutput(id, output)

    outputWindows[id] = createOutputWindow({ ...output.bounds, alwaysOnTop: output.alwaysOnTop !== false, kiosk: output.kioskMode === true, backgroundColor: output.transparent ? "#00000000" : "#000000" }, id, output.name)
    updateBounds(output)

    if (output.stageOutput) stageWindows.push(id)

    setTimeout(() => {
        startCapture(id, { ndi: output.ndi || false }, (output as any).rate)
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
    if (isMac) window.minimize() // hide on mac

    if (options.alwaysOnTop) window.setAlwaysOnTop(true, "pop-up-menu", 1)
    // window.setVisibleOnAllWorkspaces(true)

    loadWindowContent(window, true)
    setWindowListeners(window, { id, name })

    // open devtools
    // if (!isProd) window.webContents.openDevTools()

    return window
}

function setWindowListeners(window: BrowserWindow, { id, name }: { [key: string]: string }) {
    window.on("ready-to-show", () => {
        mainWindow?.focus()
        window.setMenu(null)
        window.setTitle(name || "Output")
    })

    window.on("move", (e: any) => {
        if (!moveEnabled || updatingBounds) return e.preventDefault()

        let bounds = window.getBounds()
        toApp(OUTPUT, { channel: "MOVE", data: { id, bounds } })
    })
}

export async function closeAllOutputs() {
    await Promise.all(Object.keys(outputWindows).map(removeOutput))
}

async function removeOutput(id: string, reopen: any = null) {
    await stopCapture(id)
    stopSenderNDI(id)

    if (!outputWindows[id]) return
    if (outputWindows[id].isDestroyed()) {
        delete outputWindows[id]
        if (reopen) createOutput(reopen)
        return
    }

    outputWindows[id].on("closed", () => {
        delete outputWindows[id]
        if (reopen) createOutput(reopen)
    })

    try {
        outputWindows[id].destroy()
    } catch (error) {
        console.log(error)
    }
}

// SHOW/HIDE

function displayOutput(data: any) {
    let window: BrowserWindow = outputWindows[data.output?.id]

    if (data.enabled === "toggle") data.enabled = !window?.isVisible()
    if (data.enabled !== false) data.enabled = true

    if (!window || window.isDestroyed()) {
        if (!data.output) return

        createOutput(data.output)
        window = outputWindows[data.output.id]
        if (!window || window.isDestroyed()) return
    }

    /////

    if (data.autoPosition && !data.force) data.output.bounds = getSecondDisplay(data.output.bounds)
    let bounds: Rectangle = data.output.bounds
    let windowNotCoveringMain: boolean = isNotCovered(mainWindow!.getBounds(), bounds)

    if (data.enabled && bounds && (data.force || window.isAlwaysOnTop() === false || windowNotCoveringMain)) {
        showWindow(window)

        if (bounds) updateBounds(data.output)
    } else {
        hideWindow(window, data.output)

        if (data.enabled && !data.auto) toApp(MAIN, { channel: "ALERT", data: "error.display" })
        data.enabled = false
    }

    if (data.one !== true) toApp(OUTPUT, { channel: "DISPLAY", data })
}

function getSecondDisplay(bounds: Rectangle) {
    let displays = screen.getAllDisplays()
    if (displays.length !== 2) return bounds

    let mainWindowBounds = mainWindow!.getBounds()
    let amountCoveredByWindow = amountCovered(displays[1].bounds, mainWindowBounds)

    let secondDisplay = displays[1]
    if (amountCoveredByWindow > 0.5) secondDisplay = displays[0]

    return secondDisplay.bounds
}

function isNotCovered(mainBounds: Rectangle, secondBounds: Rectangle) {
    let xDif = secondBounds?.x - mainBounds.x
    let yDif = secondBounds?.y - mainBounds.y

    const margin = 50
    let secondNotCoveringMain: boolean = xDif > margin || yDif < -margin || (xDif < -margin && yDif > margin)
    return secondNotCoveringMain
}

function amountCovered(displayBounds: Rectangle, windowBounds: Rectangle) {
    const overlapX = Math.max(0, Math.min(displayBounds.x + displayBounds.width, windowBounds.x + windowBounds.width) - Math.max(displayBounds.x, windowBounds.x))
    const overlapY = Math.max(0, Math.min(displayBounds.y + displayBounds.height, windowBounds.y + windowBounds.height) - Math.max(displayBounds.y, windowBounds.y))
    const overlapArea = overlapX * overlapY

    const totalArea = displayBounds.width * displayBounds.height
    const overlapAmount = overlapArea / totalArea

    return overlapAmount
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

function hideWindow(window: BrowserWindow, data: any) {
    if (!window || window.isDestroyed()) return

    window.setKiosk(false)
    window.hide()

    // WIP has to restart because window is unresponsive when hidden again (until showed again)...
    console.log("RESTARTING OUTPUT:", data.id)
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
        startCapture(id, { [data.key]: data.value }, data.rate)
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

    IDENTIFY_SCREENS: (data: any) => identifyScreens(data),
}

export function receiveOutput(_e: any, msg: Message) {
    if (msg.channel.includes("MAIN")) return toApp(OUTPUT, msg)
    if (outputResponses[msg.channel]) return outputResponses[msg.channel](msg.data)

    sendToOutputWindow(msg)
}

function sendToOutputWindow(msg: any) {
    Object.entries(outputWindows).forEach(sendToWindow)

    function sendToWindow([id, window]: any) {
        if ((msg.data?.id && msg.data.id !== id) || window.isDestroyed()) return

        let tempMsg: any = JSON.parse(JSON.stringify(msg))
        if (msg.channel === "OUTPUTS") tempMsg = onlySendToMatchingId(tempMsg, id)

        window.webContents.send(OUTPUT, tempMsg)
    }

    function onlySendToMatchingId(tempMsg: any, id: string) {
        if (!msg.data?.[id]) return tempMsg

        tempMsg.data = { [id]: msg.data[id] }
        return tempMsg
    }
}

let stageWindows: string[] = []
export function sendToStageOutputs(msg: any) {
    ;[...new Set(stageWindows)].forEach((id) => {
        let window = outputWindows[id]
        if (!window || window.isDestroyed()) return

        window.webContents.send(OUTPUT, msg)
    })
}

// create numbered outputs for each screen
let identifyActive: boolean = false
const IDENTIFY_TIMEOUT: number = 3000
function identifyScreens(screens: any[]) {
    if (identifyActive) return
    identifyActive = true

    let activeWindows: any[] = screens.map(createIdentifyScreen)

    setTimeout(() => {
        activeWindows.forEach((window) => {
            window.destroy()
        })

        identifyActive = false
    }, IDENTIFY_TIMEOUT)
}

function createIdentifyScreen(screen: any, i: number) {
    let window: BrowserWindow | null = new BrowserWindow(screenIdentifyOptions)
    window.setBounds(screen.bounds)
    window.loadFile("public/identify.html")

    window.webContents.on("did-finish-load", sendNumberToScreen)
    function sendNumberToScreen() {
        window!.webContents.send("NUMBER", i + 1)
    }

    return window
}
