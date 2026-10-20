import type { BrowserWindow, Rectangle } from "electron"
import { screen } from "electron"
import { isMac, mainWindow, toApp } from "../.."
import { MAIN, OUTPUT } from "../../../types/Channels"
import type { Output } from "../../../types/Output"
import { OutputHelper } from "../OutputHelper"
import { setOutputAlwaysOnTop } from "./OutputAlwaysOnTop"
import { OutputBounds } from "./OutputBounds"

export class OutputVisibility {
    static async toggleOutputs(data: { outputs: (Output & { id: string })[]; state: boolean; force?: boolean; autoStartup?: boolean; autoPosition?: boolean }) {
        const newStates: { id: string; active: boolean | "invisible" }[] = []

        // The list is in display order, which decides stacking, so it is not reordered. Creation order is
        // separate: an offscreen output must exist before a displayed one of the same content, or that one
        // finds no render to join. Awaited, so the loop below does not create these a second time.
        const needsWindow = (o: Output & { id: string }) => {
            const win = OutputHelper.getOutput(o.id)?.window
            return !win || win.isDestroyed()
        }
        for (const output of data.outputs.filter(needsWindow).filter(OutputVisibility.rendersOffscreen)) {
            await OutputHelper.Lifecycle.createOutput(output)
        }

        data.outputs.forEach((output) => {
            const autoPosition = output.boundsLocked ? false : data.autoPosition
            const newState = OutputVisibility.toggleOutput(output, data.state, data.autoStartup, autoPosition)
            newStates.push({ id: output.id, active: newState })
        })

        toApp(OUTPUT, { channel: "OUTPUT_STATE", data: newStates })
    }

    static rendersOffscreen(o: Output) {
        return !!(o.ndi || o.omt || o.webrtc || o.rtmp || o.blackmagic || o.invisible)
    }

    static toggleOutput(output: Output & { id: string }, state: boolean, autoStartup?: boolean, autoPosition?: boolean) {
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
            // no window to show, but the toggle applies all the same: off sends black and silence
            OutputHelper.Lifecycle.setOutputOn(output.id, state)
            return state ? "invisible" : false
        }

        const displays = screen.getAllDisplays()
        const isSingleScreenAutoStartup = autoStartup && displays.length <= 1
        if (isSingleScreenAutoStartup) return this.windowNotShown(output, state)

        const bounds: Rectangle = this.resolveOutputBounds(output, autoPosition)

        const windowCoveringMain = this.amountCovered(bounds, mainWindow!.getBounds()) > 0.5
        const invalidWindowPosition = windowCoveringMain && autoPosition && window.isAlwaysOnTop() === true

        if (state === true && !invalidWindowPosition) {
            this.showWindow(window, output.alwaysOnTop !== false)

            OutputHelper.Bounds.updateBounds({ id: output.id, bounds })
            OutputHelper.Lifecycle.setOutputOn(output.id, true)
            return true
        } else {
            this.hideWindow(window, output)
            // returning to capture-only: render at the configured resolution (DPI-corrected)
            OutputBounds.updateBounds({ id: output.id, bounds: output.bounds })

            if (state === true && !autoStartup) toApp(MAIN, { channel: "ALERT", data: "error.display" })
            return this.windowNotShown(output, state)
        }
    }

    // The window stays hidden, but an output that also sends elsewhere (NDI, Blackmagic...) is still turned on
    // or off as asked: only its window could not be shown, and turning it off would send black.
    private static windowNotShown(output: Output & { id: string }, state: boolean): "invisible" | false {
        const on = state && this.rendersOffscreen(output)
        OutputHelper.Lifecycle.setOutputOn(output.id, on)
        return on ? "invisible" : false
    }

    static resolveOutputBounds(output: Partial<Output> & { bounds: Rectangle; boundsLocked?: boolean; screen?: string | null }, autoPosition = false): Rectangle {
        const displays = screen.getAllDisplays()
        const primaryBounds = displays.length ? displays[0].bounds : { x: 0, y: 0, width: 1920, height: 1080 }
        const hasValidBounds = !!(output.bounds?.width && output.bounds?.height)
        const outputBounds = hasValidBounds ? output.bounds : primaryBounds

        // never auto position locked bounds
        if (output.boundsLocked) return outputBounds

        // 1. Primary: Preserve valid coordinates if already within an active physical display
        if (displays.length > 0 && hasValidBounds && output.bounds) {
            const isCenterOnDisplay = displays.some((d) => {
                const centerX = output.bounds.x + output.bounds.width / 2
                const centerY = output.bounds.y + output.bounds.height / 2
                return centerX >= d.bounds.x && centerX < d.bounds.x + d.bounds.width && centerY >= d.bounds.y && centerY < d.bounds.y + d.bounds.height
            })

            if (isCenterOnDisplay) return output.bounds
        }

        // 2. Secondary fallback: Look up by target display ID if coordinates are off-screen (e.g. topology changed)
        if (displays.length > 0 && output.screen) {
            const isCoveringMain = this.amountCovered(outputBounds, mainWindow!.getBounds()) > 0.5
            const targetDisplay = isCoveringMain ? null : displays.find((d) => d.id.toString() === output.screen)
            if (targetDisplay) return { ...targetDisplay.bounds }
        }

        // fallback to second display auto positioning if not locked and autoPosition requested or bounds are undefined
        // (not on macOS due to window detection quirks)
        if ((autoPosition || !hasValidBounds) && displays.length > 1 && !isMac) {
            return this.getSecondDisplay(outputBounds)
        }

        return outputBounds
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
