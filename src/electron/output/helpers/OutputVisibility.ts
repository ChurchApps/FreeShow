import type { BrowserWindow, Rectangle } from "electron"
import { screen } from "electron"
import { mainWindow, toApp } from "../.."
import { MAIN, OUTPUT } from "../../../types/Channels"
import type { Output } from "../../../types/Output"
import { OutputHelper } from "../OutputHelper"
import { setOutputAlwaysOnTop } from "./OutputAlwaysOnTop"
import { OutputBounds } from "./OutputBounds"

export class OutputVisibility {
    static toggleOutputs(data: { outputs: (Output & { id: string })[]; state: boolean; force?: boolean; autoStartup?: boolean; autoPosition?: boolean }) {
        const newStates: { id: string; active: boolean | "invisible" }[] = []

        data.outputs.forEach((output) => {
            const force = !!(data.force || output.boundsLocked)
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
            // capture-only: render at the configured resolution (DPI-corrected)
            OutputBounds.updateBounds({ id: output.id, bounds: output.bounds })
            return "invisible"
        }

        let bounds: Rectangle = this.resolveOutputBounds(output, autoPosition && !force)
        const windowNotCoveringMain = this.amountCovered(bounds, mainWindow!.getBounds()) < 0.5

        if (state === true && (force || window.isAlwaysOnTop() === false || windowNotCoveringMain)) {
            this.showWindow(window, output.alwaysOnTop !== false)

            OutputHelper.Bounds.updateBounds({ id: output.id, bounds })
            return true
        } else {
            this.hideWindow(window, output)
            // returning to capture-only: render at the configured resolution (DPI-corrected)
            OutputBounds.updateBounds({ id: output.id, bounds: output.bounds })

            if (state === true && !autoStartup) toApp(MAIN, { channel: "ALERT", data: "error.display" })
            return false
        }
    }

    static resolveOutputBounds(output: Partial<Output> & { bounds: Rectangle; boundsLocked?: boolean }, autoPosition = false): Rectangle {
        const displays = screen.getAllDisplays()
        const primaryBounds = displays.length ? displays[0].bounds : { x: 0, y: 0, width: 1920, height: 1080 }
        const hasValidBounds = !!(output.bounds && output.bounds.width && output.bounds.height)

        // never auto position locked bounds
        if (output.boundsLocked && hasValidBounds) return output.bounds

        if (displays.length > 0) {
            // 1. Check screen ID first (if screen position/offset has moved, follow the target screen)
            if (output.screen) {
                const targetDisplay = displays.find((d) => d.id.toString() === output.screen)
                if (targetDisplay) return { ...targetDisplay.bounds }
            }

            // 2. If screen ID was not found, check if saved bounds center is currently on an active display
            if (hasValidBounds) {
                const isCenterOnDisplay = displays.some((d) => {
                    const centerX = output.bounds.x + output.bounds.width / 2
                    const centerY = output.bounds.y + output.bounds.height / 2
                    return centerX >= d.bounds.x && centerX < d.bounds.x + d.bounds.width && centerY >= d.bounds.y && centerY < d.bounds.y + d.bounds.height
                })

                if (isCenterOnDisplay) return output.bounds
            }
        }

        // 3. Fallback to second display auto positioning if requested or if bounds are undefined
        // (not on macOS due to window detection quirks)
        if ((autoPosition || !hasValidBounds) && displays.length > 0 && process.platform !== "darwin") {
            return this.getSecondDisplay(output.bounds || primaryBounds)
        }

        return hasValidBounds ? output.bounds : primaryBounds
    }

    static getSecondDisplay(bounds: Rectangle) {
        const displays = screen.getAllDisplays()
        if (displays.length !== 2) return bounds

        const mainWindowBounds = mainWindow!.getBounds()
        const amountCoveredByWindow = this.amountCovered(displays[1].bounds, mainWindowBounds)

        let secondDisplay = displays[1]
        if (amountCoveredByWindow > 0.5) secondDisplay = displays[0]

        return { ...secondDisplay.bounds }
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

    static showWindow(window: BrowserWindow, alwaysOnTop = true) {
        if (!window || window.isDestroyed()) return

        window.showInactive()
        if (alwaysOnTop) setOutputAlwaysOnTop(window, true)
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
