import { BrowserWindow } from "electron"
import { OUTPUT_CONSOLE, isMac, loadWindowContent, mainWindow, toApp } from "../.."
import { Output } from "../../../types/Output"
import { NdiSender } from "../../ndi/NdiSender"
import { setDataNDI } from "../../ndi/talk"
import { outputOptions } from "../../utils/windowOptions"
import { CaptureTransmitter } from "../CaptureTransmitter"
import { startCapture, stopCapture } from "../capture"
import { OutputHelper } from "./OutputHelper"
import { OUTPUT } from "../../../types/Channels"

export class OutputLifecycle {
    static async createOutput(output: Output) {
        let id: string = output.id || ""

        if (OutputHelper.outputWindows[id]) return this.removeOutput(id, output)

        OutputHelper.outputWindows[id] = this.createOutputWindow({ ...output.bounds, alwaysOnTop: output.alwaysOnTop !== false, kiosk: output.kioskMode === true, backgroundColor: output.transparent ? "#00000000" : "#000000" }, id, output.name)
        OutputHelper.Bounds.updateBounds(output)

        if (output.stageOutput) CaptureTransmitter.stageWindows.push(id)

        setTimeout(() => {
            startCapture(id, { ndi: output.ndi || false }, (output as any).rate)
        }, 1200)

        // NDI
        if (output.ndi) await NdiSender.createSenderNDI(id, output.name)
        if (output.ndiData) setDataNDI({ id, ...output.ndiData })
    }

    private static createOutputWindow(options: any, id: string, name: string) {
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
        this.setWindowListeners(window, { id, name })

        // open devtools
        if (OUTPUT_CONSOLE) window.webContents.openDevTools({ mode: "detach" })

        return window
    }

    static async removeOutput(id: string, reopen: any = null) {
        await stopCapture(id)
        NdiSender.stopSenderNDI(id)

        if (!OutputHelper.outputWindows[id]) return
        if (OutputHelper.outputWindows[id].isDestroyed()) {
            delete OutputHelper.outputWindows[id]
            if (reopen) this.createOutput(reopen)
            return
        }

        OutputHelper.outputWindows[id].on("closed", () => {
            delete OutputHelper.outputWindows[id]
            if (reopen) this.createOutput(reopen)
        })

        try {
            OutputHelper.outputWindows[id].destroy()
        } catch (error) {
            console.log(error)
        }
    }

    static setWindowListeners(window: BrowserWindow, { id, name }: { [key: string]: string }) {
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

    static async closeAllOutputs() {
        await Promise.all(Object.keys(OutputHelper.outputWindows).map(this.removeOutput))
    }
}
