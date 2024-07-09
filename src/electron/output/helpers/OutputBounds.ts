import { BrowserWindow, screen } from "electron"
import { OutputHelper } from "./OutputHelper"

export class OutputBounds {
    // BOUNDS

    static moveEnabled: boolean = false
    static updatingBounds: boolean = false
    private static boundsTimeout: any = null

    static disableWindowMoveListener() {
        this.updatingBounds = true

        if (this.boundsTimeout) clearTimeout(this.boundsTimeout)
        this.boundsTimeout = setTimeout(() => {
            this.updatingBounds = false
            this.boundsTimeout = null
        }, 1000)
    }

    static updateBounds(data: any) {
        let window: BrowserWindow = OutputHelper.outputWindows[data.id]
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
        let window: BrowserWindow = OutputHelper.outputWindows[id]
        if (!window || window.isDestroyed()) return

        window.moveTop()
    }

    static alignWithScreens() {
        Object.keys(OutputHelper.outputWindows).forEach((outputId) => {
            let output = OutputHelper.outputWindows[outputId]

            let wBounds = output.getBounds()
            let centerLeft = wBounds.x + wBounds.width / 2
            let centerTop = wBounds.y + wBounds.height / 2

            let point = { x: centerLeft, y: centerTop }
            let closestScreen = screen.getDisplayNearestPoint(point)

            output.setBounds(closestScreen.bounds)
        })
    }
}
