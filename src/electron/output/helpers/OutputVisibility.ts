import type { BrowserWindow, Rectangle } from "electron"
import { screen } from "electron"
import { mainWindow, toApp } from "../.."
import { MAIN, OUTPUT } from "../../../types/Channels"
import type { Output } from "../../../types/Output"
import { OutputHelper } from "../OutputHelper"
import { OutputBounds } from "./OutputBounds"

export class OutputVisibility {
    static toggleOutputs(data: { outputs: (Output & { id: string })[]; state: boolean; force?: boolean; autoStartup?: boolean; autoPosition?: boolean }) {
        const newStates: { id: string; active: boolean | "invisible" }[] = []

        data.outputs.forEach((output) => {
            const force = !!(data.force || output.allowMainScreen || output.boundsLocked)
            const newState = OutputVisibility.toggleOutput(output, data.state, force, data.autoStartup, data.autoPosition)
            newStates.push({ id: output.id, active: newState })
        })

        toApp(OUTPUT, { channel: "OUTPUT_STATE", data: newStates })
    }

    static toggleOutput(output: Output & { id: string }, state: boolean, force?: boolean, autoStartup?: boolean, autoPosition?: boolean) {
        if (!output?.id) return false

        let window: BrowserWindow = OutputHelper.getOutput(output.id)?.window

        if (!window || window.isDestroyed()) {
            OutputHelper.Lifecycle.createOutput(output)
            window = OutputHelper.getOutput(output.id)?.window
            if (!window || window.isDestroyed()) return false
        }

        if (output.invisible) {
            OutputHelper.setOutput(output.id, { ...OutputHelper.getOutput(output.id), invisible: true })
            if (window.isVisible()) this.hideWindow(window)
            return "invisible"
        }

        let bounds: Rectangle = output.bounds

        // don't auto position on mac (because of virtual)
        if (autoPosition && !force && process.platform !== "darwin") bounds = this.getSecondDisplay(bounds)
        const windowNotCoveringMain = this.amountCovered(bounds, mainWindow!.getBounds()) < 0.5

        if (state === true && (force || window.isAlwaysOnTop() === false || windowNotCoveringMain)) {
            this.showWindow(window)

            OutputHelper.Bounds.updateBounds({ id: output.id, bounds })
            return true
        } else {
            this.hideWindow(window, output)

            if (state === true && !autoStartup) toApp(MAIN, { channel: "ALERT", data: "error.display" })
            return false
        }
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

        // seems to be fixed:
        if (!data) return

        // // this is only needed if the output is being captured!! (has to reset for capture to work when window is hidden)
        // const captureEnabled = Object.values(OutputHelper.getOutput(data.id!)?.captureOptions?.options || {}).find((a) => a === true)
        // if (!captureEnabled) return

        // console.info("RESTARTING OUTPUT:", data.id)
        // toApp(OUTPUT, { channel: "RESTART", data: { id: data.id } })
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
