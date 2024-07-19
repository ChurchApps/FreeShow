import { BrowserWindow } from "electron"
import { screenIdentifyOptions } from "../../utils/windowOptions"

export class OutputIdentify {
    // create numbered outputs for each screen
    private static identifyActive: boolean = false
    private static IDENTIFY_TIMEOUT: number = 3000

    static identifyScreens(screens: any[]) {
        if (this.identifyActive) return
        this.identifyActive = true

        let activeWindows: any[] = screens.map(this.createIdentifyScreen)

        setTimeout(() => {
            activeWindows.forEach((window) => {
                window.destroy()
            })
            this.identifyActive = false
        }, this.IDENTIFY_TIMEOUT)
    }

    private static createIdentifyScreen(screen: any, i: number) {
        let window: BrowserWindow | null = new BrowserWindow(screenIdentifyOptions)
        window.setBounds(screen.bounds)
        window.loadFile("public/identify.html")

        window.webContents.on("did-finish-load", sendNumberToScreen)
        function sendNumberToScreen() {
            window!.webContents.send("NUMBER", i + 1)
        }

        return window
    }
}
