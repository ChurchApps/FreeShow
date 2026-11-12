import { BrowserWindow, type Rectangle } from "electron"
import { screenIdentifyOptions } from "../../utils/windowOptions"
import { setOutputAlwaysOnTop } from "./OutputAlwaysOnTop"

export class OutputIdentify {
    // create numbered outputs for each screen
    private static identifyActive = false
    private static IDENTIFY_TIMEOUT = 3000

    static identifyScreens(screens: { bounds: Rectangle }[]) {
        if (this.identifyActive) return
        this.identifyActive = true

        const activeWindows: BrowserWindow[] = screens.map(this.createIdentifyScreen)

        setTimeout(() => {
            activeWindows.forEach((window) => {
                if (!window.isDestroyed()) window.destroy()
            })
            this.identifyActive = false
        }, this.IDENTIFY_TIMEOUT)
    }

    private static createIdentifyScreen(screen: { bounds: Rectangle }, i: number) {
        const window = new BrowserWindow(screenIdentifyOptions)
        window.setBounds(screen.bounds)
        setOutputAlwaysOnTop(window, true)
        window.moveTop()
        window.loadFile("public/identify.html")

        window.webContents.once("did-finish-load", sendNumberToScreen)
        function sendNumberToScreen() {
            if (window.isDestroyed() || window.webContents.isDestroyed()) return
            window.webContents.send("NUMBER", i + 1)
        }

        return window
    }
}
