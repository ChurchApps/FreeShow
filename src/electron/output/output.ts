import { BrowserWindow, screen } from "electron"
import { OUTPUT_CONSOLE, isMac, loadWindowContent, mainWindow, toApp } from ".."
import { OUTPUT } from "../../types/Channels"
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

export async function createOutput(output: Output) {
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
    DISPLAY: (data: any) => OutputHelper.Visibility.displayOutput(data),
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
