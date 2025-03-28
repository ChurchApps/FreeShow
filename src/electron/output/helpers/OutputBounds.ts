import { screen, type BrowserWindow, type Rectangle } from "electron"
import { toApp } from "../.."
import { OUTPUT } from "../../../types/Channels"
import { OutputHelper } from "../OutputHelper"

export class OutputBounds {
    // BOUNDS

    static moveEnabled: boolean = false
    static updatingBounds: boolean = false
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
        let window: BrowserWindow = OutputHelper.getOutput(data.id)?.window
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
        let window: BrowserWindow = OutputHelper.getOutput(id)?.window
        if (!window || window.isDestroyed()) return

        window.moveTop()
    }

    static alignWithScreens() {
        OutputHelper.getKeys().forEach((outputId) => {
            let output = OutputHelper.getOutput(outputId)
            if (output.boundsLocked) return

            let wBounds = output.window.getBounds()
            let centerLeft = wBounds.x + wBounds.width / 2
            let centerTop = wBounds.y + wBounds.height / 2

            let point = { x: centerLeft, y: centerTop }
            let closestScreen = screen.getDisplayNearestPoint(point)

            if (JSON.stringify(wBounds) === JSON.stringify(closestScreen.bounds)) return

            output.window.setBounds(closestScreen.bounds)
            toApp(OUTPUT, { channel: "MOVE", data: { id: outputId, bounds: closestScreen.bounds } })
        })
    }
}
