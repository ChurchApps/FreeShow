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
        const window: BrowserWindow = OutputHelper.getOutput(data.id)?.window
        if (!window || window.isDestroyed()) return

        this.disableWindowMoveListener()
        window.setBounds(data.bounds)

        // has to be set twice to work first time
        setTimeout(() => {
            if (!window || window.isDestroyed()) return
            window.setBounds(data.bounds)
        }, 10)
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
