import { BrowserWindow } from "electron"
import { OUTPUT_CONSOLE, isMac, loadWindowContent, mainWindow, toApp } from "../.."
import { Output } from "../../../types/Output"
import { NdiSender } from "../../ndi/NdiSender"
import { setDataNDI } from "../../ndi/talk"
import { outputOptions } from "../../utils/windowOptions"
import { OutputHelper } from "../OutputHelper"
import { OUTPUT } from "../../../types/Channels"
import { CaptureHelper } from "../../capture/CaptureHelper"

export class OutputLifecycle {
    static async createOutput(output: Output) {
        let id: string = output.id || ""

        if (OutputHelper.getOutput(id)) {
            CaptureHelper.Lifecycle.stopCapture(id)
            this.removeOutput(id, output)
            return
        }

        const outputWindow = this.createOutputWindow({ ...output.bounds, alwaysOnTop: output.alwaysOnTop !== false, kiosk: output.kioskMode === true, backgroundColor: output.transparent ? "#00000000" : "#000000" }, id, output.name)
        //const previewWindow = this.createPreviewWindow({ ...output.bounds, backgroundColor: "#000000" })

        OutputHelper.setOutput(id, { window: outputWindow, invisible: output.invisible })
        //OutputHelper.setOutput(id, { window: outputWindow, previewWindow: previewWindow })
        OutputHelper.Bounds.updateBounds(output)

        //OutputHelper.Bounds.updatePreviewBounds()

        if (output.stageOutput && !CaptureHelper.Transmitter.stageWindows.includes(id)) CaptureHelper.Transmitter.stageWindows.push(id)

        setTimeout(() => {
            CaptureHelper.Lifecycle.startCapture(id, { ndi: output.ndi || false })
        }, 1200)

        // NDI
        if (output.ndi) await NdiSender.createSenderNDI(id, output.name)
        if (output.ndiData) setDataNDI({ id, ...output.ndiData })
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
        await CaptureHelper.Lifecycle.stopCapture(id)
        NdiSender.stopSenderNDI(id)

        if (!OutputHelper.getOutput(id)) return
        if (OutputHelper.getOutput(id).window.isDestroyed()) {
            OutputHelper.deleteOutput(id)
            if (reopen) this.createOutput(reopen)
            return
        }

        OutputHelper.getOutput(id).window.on("closed", () => {
            OutputHelper.deleteOutput(id)
            if (reopen) this.createOutput(reopen)
        })

        try {
            const output = OutputHelper.getOutput(id)
            output?.window?.destroy()
            //output?.previewWindow?.destroy()
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
        await Promise.all(OutputHelper.getKeys().map(this.removeOutput))
    }
}
