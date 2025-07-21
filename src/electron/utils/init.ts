import { app, screen, type BrowserWindow } from "electron"
import path from "path"
import { isProd, isWindows } from ".."
import { catchErrors } from "../IPC/responsesMain"
import { doesPathExist } from "./files"

// get LOADED message from frontend
export function mainWindowInitialize() {
    // midi
    // createVirtualMidi()

    // express
    require("../servers")

    // set app title to app name
    if (isWindows) app.setAppUserModelId(app.name)

    if (!isProd) return

    catchErrors()
}

export function openDevTools(window: BrowserWindow) {
    console.info('Opening DevTools... ("[ERROR:CONSOLE] Request Autofill" can be ignored)')
    window.webContents.openDevTools()
    // ERROR:CONSOLE(1)] "Request Autofill.enable failed. - can be ignored:
    // https://github.com/electron/electron/issues/41614
}

// wait until the main bundle exists or dev server is ready
export function waitForBundle() {
    const BUNDLE_PATH = path.resolve(__dirname, "..", "..", "..", "public/build/bundle.js")
    const CHECK_INTERVAL = 2 // every 2 seconds
    let tries = 0

    return new Promise((resolve) => {
        const interval = setInterval(async () => {
            // Check if bundle file exists (production build)
            if (doesPathExist(BUNDLE_PATH)) {
                console.info("Main bundle found! Loading interface...")
                clearInterval(interval)
                resolve(true)
                return
            }

            // For development, just wait a short time and assume Vite is ready
            console.log(`Development mode: waiting for Vite to be ready... (attempt ${tries + 1})`)
            if (tries >= 4) { // Wait 10 seconds (5 * 2 second intervals)
                console.info("Assuming Vite dev server is ready! Loading interface...")
                clearInterval(interval)
                resolve(true)
                return
            }

            tries += 1
            if (tries >= 60) { // 60 * 2 seconds = 120 seconds total timeout
                clearInterval(interval)
                app.quit()
                throw new Error("Could not load app content. Please check console for any errors!")
            }
        }, CHECK_INTERVAL * 1000)
    })
}

export function isWithinDisplayBounds(pos: { x: number; y: number }) {
    const displays = screen.getAllDisplays()
    return displays.reduce((result, display) => {
        const area = display.workArea
        return result || (pos.x >= area.x && pos.y >= area.y && pos.x < area.x + area.width && pos.y < area.y + area.height)
    }, false)
}
