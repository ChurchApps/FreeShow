import { BrowserWindow, screen } from "electron"
import { OutputHelper } from "../OutputHelper"

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

            let wBounds = output.window.getBounds()
            let centerLeft = wBounds.x + wBounds.width / 2
            let centerTop = wBounds.y + wBounds.height / 2

            let point = { x: centerLeft, y: centerTop }
            let closestScreen = screen.getDisplayNearestPoint(point)

            output.window.setBounds(closestScreen.bounds)
        })
    }

    /*
    static getPreviewBounds(mainWidth: number, mainHeight: number) {
        if (mainWidth || mainHeight) return { width: 320, height: 180 }
        else return { width: 320, height: 180 }
    }

    static updatePreviewBounds() {
        const mainBounds = mainWindow?.getBounds()
        const devFrameOffsetY = 50 //TODO: Remove hack
        const devFrameOffsetX = 8
        if (mainBounds) {
            OutputHelper.getKeys().forEach((outputId) => {
                const output = OutputHelper.getOutput(outputId)
                if (output.previewWindow) {
                    const bounds: Electron.Rectangle = {
                        x: (output.previewBounds?.x || 0) + mainBounds?.x + devFrameOffsetX,
                        y: (output.previewBounds?.y || 0) + mainBounds?.y + devFrameOffsetY,
                        width: output.previewBounds?.width || 320,
                        height: output.previewBounds?.height || 180,
                    }
                    output.previewWindow.setBounds(bounds)
                }
            })
        }
    }

    static setPreviewBounds(data: any) {
        const output = OutputHelper.getOutput(data.id)
        if (output) {
            output.previewBounds = {
                x: data.x,
                y: data.y,
                width: data.width,
                height: data.height,
            }

            this.updatePreviewBounds()
        }
    }
    */
}
