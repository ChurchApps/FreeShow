import { BrowserWindow } from "electron"
import { OUTPUT_CONSOLE, getMainWindow, isMac, loadWindowContent, toApp } from "../.."
import { OUTPUT } from "../../../types/Channels"
import type { Output } from "../../../types/Output"
import { CaptureHelper } from "../../capture/CaptureHelper"
import { NdiSender } from "../../ndi/NdiSender"
import { setDataNDI } from "../../ndi/talk"
import { wait } from "../../utils/helpers"
import { outputOptions } from "../../utils/windowOptions"
import { OutputHelper } from "../OutputHelper"

export class OutputLifecycle {
    static async createOutput(output: Output) {
        let id: string = output.id || ""

        if (OutputHelper.getOutput(id)) {
            CaptureHelper.Lifecycle.stopCapture(id)
            this.removeOutput(id, output)
            return
        }

        const outputWindow = this.createOutputWindow({ ...output.bounds, alwaysOnTop: output.alwaysOnTop !== false, kiosk: output.kioskMode === true, backgroundColor: output.transparent ? "#00000000" : "#000000" }, id, output.name, output)
        //const previewWindow = this.createPreviewWindow({ ...output.bounds, backgroundColor: "#000000" })

        OutputHelper.setOutput(id, { window: outputWindow, invisible: output.invisible, boundsLocked: output.boundsLocked })
        //OutputHelper.setOutput(id, { window: outputWindow, previewWindow: previewWindow })
        OutputHelper.Bounds.updateBounds(output)

        //OutputHelper.Bounds.updatePreviewBounds()

        if (output.stageOutput && !CaptureHelper.Transmitter.stageWindows.includes(id)) CaptureHelper.Transmitter.stageWindows.push(id)

        setTimeout(() => {
            if (!CaptureHelper.Lifecycle) return // window closed before timeout finished
            CaptureHelper.Lifecycle.startCapture(id, { ndi: output.ndi || false })
        }, 1200)

        // NDI
        if (output.ndi) {
            await NdiSender.createSenderNDI(id, output.name)
            if (output.ndiData) setDataNDI({ id, ...output.ndiData })
        }
    }

    /*
    private static createPreviewWindow(options: any) {
        const mainBounds = mainWindow?.getBounds()

        options = { ...outputOptions, ...options }
        options.x = 0
        options.y = 0
        options.width = 320
        options.height = 180
        options.show = true
        if (mainBounds) {
            options.x = mainBounds.x + mainBounds.width - options.width - 20 - 300
            options.y = mainBounds.y + 100
        }

        let window: BrowserWindow | null = new BrowserWindow(options)
        window.setSkipTaskbar(options.skipTaskbar) // hide from taskbar
        if (isMac) window.minimize() // hide on mac
        loadWindowContent(window, true)
        window.showInactive()
        window.moveTop()
        return window
    }*/

    private static createOutputWindow(options: any, id: string, name: string, extra: any) {
        options = { ...outputOptions, ...options }

        if (options.alwaysOnTop === false) {
            options.skipTaskbar = false
            if (!extra.boundsLocked) options.resizable = true
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

        loadWindowContent(window, "output")
        this.setWindowListeners(window, { id, name })

        // open devtools
        if (OUTPUT_CONSOLE) window.webContents.openDevTools({ mode: "detach" })

        return window
    }

    static async removeOutput(id: string, reopen: any = null) {
        await CaptureHelper.Lifecycle.stopCapture(id)
        NdiSender.stopSenderNDI(id)

        const output = OutputHelper.getOutput(id)
        if (!output) return

        if (output.window.isDestroyed()) {
            OutputHelper.deleteOutput(id)
            if (reopen) OutputLifecycle.createOutput(reopen)
            return
        }

        output.window.once("closed", () => {
            OutputHelper.deleteOutput(id)
            if (reopen) OutputLifecycle.createOutput(reopen)
        })

        try {
            // this has to be called to actually remove the process!
            output.window.removeAllListeners("close")
            output.window.close()
            await wait(80)
        } catch (error) {
            console.log(error)
        }
    }

    static focusOutput(id: string) {
        OutputHelper.getOutput(id)?.window?.focus()
    }

    static setWindowListeners(window: BrowserWindow, { id, name }: { [key: string]: string }) {
        window.on("ready-to-show", () => {
            getMainWindow()?.focus()

            window.setMenu(null)
            window.setTitle(name || "Output")
        })

        // Building the app does not like this for some reason:
        // Argument of type '"move"' is not assignable to parameter of type '"will-resize"'.
        // @ts-ignore
        window.on("move", (e: any) => {
            if (!OutputHelper.Bounds.moveEnabled || OutputHelper.Bounds.updatingBounds || OutputHelper.getOutput(id).boundsLocked) return e.preventDefault()

            let bounds = window.getBounds()
            toApp(OUTPUT, { channel: "MOVE", data: { id, bounds } })
        })

        // @ts-ignore
        window.on("resize", (e: any) => {
            if (OutputHelper.Bounds.moveEnabled || OutputHelper.Bounds.updatingBounds || OutputHelper.getOutput(id).boundsLocked) return e.preventDefault()

            let bounds = window.getBounds()
            toApp(OUTPUT, { channel: "MOVE", data: { id, bounds } })
        })
    }

    static async closeAllOutputs() {
        await Promise.all(OutputHelper.getKeys().map(this.removeOutput))
    }
}
