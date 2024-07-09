import { BrowserWindow, Rectangle, screen } from "electron"
import { OUTPUT_CONSOLE, isMac, loadWindowContent, mainWindow, toApp } from ".."
import { MAIN, OUTPUT } from "../../types/Channels"
import { Output } from "../../types/Output"
import { Message } from "../../types/Socket"
import { NdiSender } from "../ndi/NdiSender"
import { setDataNDI } from "../ndi/talk"
import { outputOptions } from "../utils/windowOptions"
import { CaptureTransmitter } from "./CaptureTransmitter"
import { startCapture, stopCapture, updatePreviewResolution } from "./capture"
import { OutputHelper } from "./helpers/OutputHelper"

export let outputWindows: { [key: string]: BrowserWindow } = {}

// CREATE

async function createOutput(output: Output) {
    let id: string = output.id || ""

    if (outputWindows[id]) return removeOutput(id, output)

    outputWindows[id] = createOutputWindow({ ...output.bounds, alwaysOnTop: output.alwaysOnTop !== false, kiosk: output.kioskMode === true, backgroundColor: output.transparent ? "#00000000" : "#000000" }, id, output.name)
    OutputHelper.Bounds.updateBounds(output)

    if (output.stageOutput) CaptureTransmitter.stageWindows.push(id)

    setTimeout(() => {
        startCapture(id, { ndi: output.ndi || false }, (output as any).rate)
    }, 1200)

    // NDI
    if (output.ndi) await NdiSender.createSenderNDI(id, output.name)
    if (output.ndiData) setDataNDI({ id, ...output.ndiData })
}

function createOutputWindow(options: any, id: string, name: string) {
    options = { ...outputOptions, ...options }

    if (options.alwaysOnTop === false) {
        options.skipTaskbar = false
        options.resizable = true
    }

    if (OUTPUT_CONSOLE) options.webPreferences.devTools = true
    let window: BrowserWindow | null = new BrowserWindow(options)

    // only win & linux
    // window.removeMenu() // hide menubar
    // window.setAutoHideMenuBar(true) // hide menubar

    window.setSkipTaskbar(options.skipTaskbar) // hide from taskbar
    if (isMac) window.minimize() // hide on mac

    window.once("show", () => {
        if (options.alwaysOnTop) window?.setAlwaysOnTop(true, "pop-up-menu", 1)
    })
    // window.setVisibleOnAllWorkspaces(true)

    loadWindowContent(window, true)
    setWindowListeners(window, { id, name })

    // open devtools
    if (OUTPUT_CONSOLE) window.webContents.openDevTools({ mode: "detach" })

    return window
}

function setWindowListeners(window: BrowserWindow, { id, name }: { [key: string]: string }) {
    window.on("ready-to-show", () => {
        mainWindow?.focus()
        window.setMenu(null)
        window.setTitle(name || "Output")
    })

    window.on("move", (e: any) => {
        if (!OutputHelper.Bounds.moveEnabled || OutputHelper.Bounds.updatingBounds) return e.preventDefault()

        let bounds = window.getBounds()
        toApp(OUTPUT, { channel: "MOVE", data: { id, bounds } })
    })
}

export async function closeAllOutputs() {
    await Promise.all(Object.keys(outputWindows).map(removeOutput))
}

async function removeOutput(id: string, reopen: any = null) {
    await stopCapture(id)
    NdiSender.stopSenderNDI(id)

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

    // don't auto position on mac (because of virtual)
    if (data.autoPosition && !data.force && process.platform !== "darwin") data.output.bounds = getSecondDisplay(data.output.bounds)
    let bounds: Rectangle = data.output.bounds
    let windowNotCoveringMain: boolean = amountCovered(bounds, mainWindow!.getBounds()) < 0.5

    if (data.enabled && bounds && (data.force || window.isAlwaysOnTop() === false || windowNotCoveringMain)) {
        showWindow(window)

        if (bounds) OutputHelper.Bounds.updateBounds(data.output)
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

    let newBounds = secondDisplay.bounds

    // window zoomed (sometimes it's correct even with custom scaling, but not always)
    // if windows overlap then something is wrong with the scaling
    let scale = secondDisplay.scaleFactor || 1
    if (scale !== 1 && amountCovered(displays[0].bounds, displays[1].bounds) > 0) {
        newBounds.width /= scale
        newBounds.height /= scale
    }

    return newBounds
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

function moveToFront(id: string) {
    let window: BrowserWindow = outputWindows[id]
    if (!window || window.isDestroyed()) return

    window.moveTop()
}

function alignWithScreens() {
    Object.keys(outputWindows).forEach((outputId) => {
        let output = outputWindows[outputId]

        let wBounds = output.getBounds()
        let centerLeft = wBounds.x + wBounds.width / 2
        let centerTop = wBounds.y + wBounds.height / 2

        let point = { x: centerLeft, y: centerTop }
        let closestScreen = screen.getDisplayNearestPoint(point)

        output.setBounds(closestScreen.bounds)
    })
}

// RESPONSES

const outputResponses: any = {
    CREATE: (data: any) => createOutput(data),
    REMOVE: (data: any) => removeOutput(data.id),
    DISPLAY: (data: any) => displayOutput(data),
    ALIGN_WITH_SCREEN: () => alignWithScreens(),

    MOVE: (data: any) => (OutputHelper.Bounds.moveEnabled = data.enabled),

    UPDATE_BOUNDS: (data: any) => OutputHelper.Bounds.updateBounds(data),
    SET_VALUE: (data: any) => OutputHelper.Values.updateValue(data),
    TO_FRONT: (data: any) => moveToFront(data),

    PREVIEW_RESOLUTION: (data: any) => updatePreviewResolution(data),
    REQUEST_PREVIEW: (data: any) => CaptureTransmitter.requestPreview(data),

    IDENTIFY_SCREENS: (data: any) => OutputHelper.Identify.identifyScreens(data),
}

export function receiveOutput(_e: any, msg: Message) {
    if (msg.channel.includes("MAIN")) return toApp(OUTPUT, msg)
    if (outputResponses[msg.channel]) return outputResponses[msg.channel](msg.data)

    OutputHelper.Send.sendToOutputWindow(msg)
}
