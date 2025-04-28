import type { BrowserWindow, Rectangle } from "electron"
import { screen } from "electron"
import { mainWindow, toApp } from "../.."
import { MAIN, OUTPUT } from "../../../types/Channels"
import type { Output } from "../../../types/Output"
import { OutputHelper } from "../OutputHelper"
import { OutputBounds } from "./OutputBounds"

export class OutputVisibility {
    static displayOutput(data: { output: Output; enabled?: "toggle" | boolean; force?: boolean; autoPosition?: boolean; auto?: boolean; one?: boolean }) {
        let window: BrowserWindow = OutputHelper.getOutput(data.output?.id || "")?.window

        if (!window || window.isDestroyed()) {
            if (!data.output) return

            OutputHelper.Lifecycle.createOutput(data.output)
            window = OutputHelper.getOutput(data.output?.id || "")?.window
            if (!window || window.isDestroyed()) return
        }

        if (data.enabled === "toggle") data.enabled = !window.isVisible()
        if (data.enabled !== false) data.enabled = true

        /// //

        if (data.output?.invisible) {
            if (window.isVisible()) this.hideWindow(window)
            // if just one output, send a message explaining why the button does not turn on?
            return
        }

        // don't auto position on mac (because of virtual)
        if (data.autoPosition && !data.force && !data.output?.forcedResolution?.width && process.platform !== "darwin") data.output.bounds = this.getSecondDisplay(data.output.bounds)
        const bounds: Rectangle = data.output.bounds
        const windowNotCoveringMain: boolean = this.amountCovered(bounds, mainWindow!.getBounds()) < 0.5

        if (data.enabled && bounds && (data.force || window.isAlwaysOnTop() === false || windowNotCoveringMain)) {
            this.showWindow(window)

            if (bounds) OutputHelper.Bounds.updateBounds({ id: data.output.id!, bounds: data.output.bounds })
        } else {
            this.hideWindow(window, data.output)

            if (data.enabled && !data.auto) toApp(MAIN, { channel: "ALERT", data: "error.display" })
            // if (data.enabled && !data.auto) sendToMain(ToMain.ALERT, "error.display") // this will cause loading issues
            data.enabled = false
        }

        if (data.one !== true) toApp(OUTPUT, { channel: "DISPLAY", data })
    }

    static getSecondDisplay(bounds: Rectangle) {
        const displays = screen.getAllDisplays()
        if (displays.length !== 2) return bounds

        const mainWindowBounds = mainWindow!.getBounds()
        const amountCoveredByWindow = this.amountCovered(displays[1].bounds, mainWindowBounds)

        let secondDisplay = displays[1]
        if (amountCoveredByWindow > 0.5) secondDisplay = displays[0]

        const newBounds = secondDisplay.bounds

        // window zoomed (sometimes it's correct even with custom scaling, but not always)
        // if windows overlap then something is wrong with the scaling
        const scale = secondDisplay.scaleFactor || 1
        if (scale !== 1 && this.amountCovered(displays[0].bounds, displays[1].bounds) > 0) {
            newBounds.width /= scale
            newBounds.height /= scale
        }

        return newBounds
    }

    static amountCovered(displayBounds: Rectangle, windowBounds: Rectangle) {
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

    static showWindow(window: BrowserWindow) {
        if (!window || window.isDestroyed()) return

        window.showInactive()
        window.moveTop()
    }

    static hideWindow(window: BrowserWindow, data: Output | null = null) {
        if (!window || window.isDestroyed()) return

        OutputBounds.disableWindowMoveListener()

        window.setKiosk(false)
        window.hide()

        if (!data) return

        // this is only needed if the output is being captured!! (has to reset for capture to work when window is hidden)
        const captureEnabled = Object.values(OutputHelper.getOutput(data.id!)?.captureOptions?.options || {}).find((a) => a === true)
        if (!captureEnabled) return

        console.info("RESTARTING OUTPUT:", data.id)
        toApp(OUTPUT, { channel: "RESTART", data: { id: data.id } })
    }

    /*
    static hideAllPreviews() {
        OutputHelper.getKeys().forEach((outputId) => {
            let output = OutputHelper.getOutput(outputId)
            if (output.previewWindow) output.previewWindow.hide()
        })
    }

    static showAllPreviews() {
        OutputHelper.getKeys().forEach((outputId) => {
            let output = OutputHelper.getOutput(outputId)
            if (output.previewWindow) output.previewWindow.showInactive()
        })
    }
    */
}
