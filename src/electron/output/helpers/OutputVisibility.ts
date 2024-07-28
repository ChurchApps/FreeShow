import { BrowserWindow, Rectangle, screen } from "electron"
import { mainWindow, toApp } from "../.."
import { OutputHelper } from "../OutputHelper"
import { MAIN, OUTPUT } from "../../../types/Channels"

export class OutputVisibility {
    static displayOutput(data: any) {
        let window: BrowserWindow = OutputHelper.getOutput(data.output?.id)?.window

        if (data.enabled === "toggle") data.enabled = !window?.isVisible()
        if (data.enabled !== false) data.enabled = true

        if (!window || window.isDestroyed()) {
            if (!data.output) return

            OutputHelper.Lifecycle.createOutput(data.output)
            window = OutputHelper.getOutput(data.output?.id)?.window
            if (!window || window.isDestroyed()) return
        }

        /////

        // don't auto position on mac (because of virtual)
        if (data.autoPosition && !data.force && process.platform !== "darwin") data.output.bounds = this.getSecondDisplay(data.output.bounds)
        let bounds: Rectangle = data.output.bounds
        let windowNotCoveringMain: boolean = this.amountCovered(bounds, mainWindow!.getBounds()) < 0.5

        if (data.enabled && bounds && (data.force || window.isAlwaysOnTop() === false || windowNotCoveringMain)) {
            this.showWindow(window)

            if (bounds) OutputHelper.Bounds.updateBounds(data.output)
        } else {
            this.hideWindow(window, data.output)

            if (data.enabled && !data.auto) toApp(MAIN, { channel: "ALERT", data: "error.display" })
            data.enabled = false
        }

        if (data.one !== true) toApp(OUTPUT, { channel: "DISPLAY", data })
    }

    static getSecondDisplay(bounds: Rectangle) {
        let displays = screen.getAllDisplays()
        if (displays.length !== 2) return bounds

        let mainWindowBounds = mainWindow!.getBounds()
        let amountCoveredByWindow = this.amountCovered(displays[1].bounds, mainWindowBounds)

        let secondDisplay = displays[1]
        if (amountCoveredByWindow > 0.5) secondDisplay = displays[0]

        let newBounds = secondDisplay.bounds

        // window zoomed (sometimes it's correct even with custom scaling, but not always)
        // if windows overlap then something is wrong with the scaling
        let scale = secondDisplay.scaleFactor || 1
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

    static hideWindow(window: BrowserWindow, data: any) {
        if (!window || window.isDestroyed()) return

        window.setKiosk(false)
        window.hide()

        // this is only needed if the output is being captured!! (has to reset for capture to work when window is hidden)
        let captureEnabled = Object.values(OutputHelper.getOutput(data.id)?.captureOptions?.options || {}).find((a) => a === true)
        if (!captureEnabled) return

        console.log("RESTARTING OUTPUT:", data.id)
        toApp(OUTPUT, { channel: "RESTART" })
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
