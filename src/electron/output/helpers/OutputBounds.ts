import { screen, type BrowserWindow, type Rectangle } from "electron"
import { toApp } from "../.."
import { OUTPUT } from "../../../types/Channels"
import { OutputHelper } from "../OutputHelper"

export class OutputBounds {
    // BOUNDS

    static moveEnabled = false
    static updatingBounds = false
    private static boundsTimeout: NodeJS.Timeout | null = null

    static disableWindowMoveListener() {
        this.updatingBounds = true

        if (this.boundsTimeout) clearTimeout(this.boundsTimeout)
        this.boundsTimeout = setTimeout(() => {
            this.updatingBounds = false
            this.boundsTimeout = null
        }, 1000)
    }

    static updateBounds(data: { id: string; bounds: Rectangle }) {
        const output = OutputHelper.getOutput(data.id)
        if (!output || !output.window || output.window.isDestroyed()) return

        // keep the configured (logical) resolution as the intent
        output.intendedBounds = data.bounds

        // actual window size to render at (DPI-corrected for invisible/capture outputs)
        const bounds = this.getRenderBounds(output, data.bounds)

        this.disableWindowMoveListener()
        output.window.setBounds(bounds)

        // has to be set twice to work first time
        setTimeout(() => {
            if (!output.window || output.window.isDestroyed()) return
            output.window.setBounds(bounds)
        }, 10)

        // ensure bounds are set properly
        setTimeout(() => {
            if (!output.window || output.window.isDestroyed()) return
            output.window.setBounds(bounds)
            OutputHelper.Lifecycle.updateWindowConstraints(data.id)
        }, 80)
    }

    // HiDPI capture fix:
    // Hidden/Capturing: Scale bounds by 1/scaleFactor to match config resolution.
    // Visible: Keep raw bounds to fill the display and avoid double-scaling.
    static getRenderBounds(output: { invisible?: boolean; window?: BrowserWindow }, bounds: Rectangle): Rectangle {
        // shown on a physical display -> keep configured bounds (window created hidden has no window yet)
        const shownOnDisplay = !output?.invisible && !!output?.window && !output.window.isDestroyed() && output.window.isVisible()
        if (shownOnDisplay) return bounds

        const scaleFactor = screen.getDisplayMatching(bounds).scaleFactor || 1
        if (scaleFactor === 1) return bounds

        return {
            x: bounds.x,
            y: bounds.y,
            width: Math.round(bounds.width / scaleFactor),
            height: Math.round(bounds.height / scaleFactor)
        }
    }

    static moveToFront(id: string) {
        const window: BrowserWindow = OutputHelper.getOutput(id)?.window
        if (!window || window.isDestroyed()) return

        window.moveTop()
    }

    static alignWithScreens() {
        OutputHelper.getKeys().forEach((outputId) => {
            const output = OutputHelper.getOutput(outputId)
            if (output.boundsLocked) return
            if (output.invisible) return // capture-only outputs have no physical screen to align to (and are DPI-corrected)
            if (!output.window || output.window.isDestroyed()) return

            const wBounds = output.window.getBounds()
            const centerLeft = wBounds.x + wBounds.width / 2
            const centerTop = wBounds.y + wBounds.height / 2

            const point = { x: centerLeft, y: centerTop }
            const closestScreen = screen.getDisplayNearestPoint(point)

            if (JSON.stringify(wBounds) === JSON.stringify(closestScreen.bounds)) return

            output.window.setBounds(closestScreen.bounds)
            toApp(OUTPUT, { channel: "MOVE", data: { id: outputId, bounds: closestScreen.bounds } })
        })
    }
}
