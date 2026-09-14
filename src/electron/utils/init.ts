import { app, screen, type BrowserWindow } from "electron"
import { isProd, isWindows, setAutoProfile } from ".."
import { catchErrors } from "../IPC/responsesMain"
import { OutputHelper } from "../output/OutputHelper"
import { detectNewFiles } from "./files"
import { initSpotify } from "./spotify"

export function parseCommandLineArgs() {
    const result: { profile?: string } = {}
    if (!isProd) return result

    const args = process.argv.slice(1)
    for (const arg of args) {
        // support --profile=Name & -p=Name
        if (arg.startsWith("--profile=")) result.profile = arg.substring("--profile=".length)
        else if (arg.startsWith("-p=")) result.profile = arg.substring("-p=".length)
    }

    setAutoProfile(result.profile || "")

    return result
}

// get LOADED message from frontend
export function mainWindowInitialize() {
    // midi
    // createVirtualMidi()

    // servers are now started earlier in parallel in startApp() - no need to require here
    // require("../servers")

    // set app title to app name
    if (isWindows) app.setAppUserModelId(app.name)

    OutputHelper.init()

    detectNewFiles()

    initSpotify()

    if (!isProd) return

    catchErrors()
}

export function openDevTools(window: BrowserWindow) {
    console.info('Opening DevTools... ("[ERROR:CONSOLE] Request Autofill" can be ignored)')
    window.webContents.openDevTools()
    // ERROR:CONSOLE(1)] "Request Autofill.enable failed. - can be ignored:
    // https://github.com/electron/electron/issues/41614
}

export function isWithinDisplayBounds(pos: { x: number; y: number }) {
    const displays = screen.getAllDisplays()
    return displays.reduce((result, display) => {
        const area = display.workArea
        return result || (pos.x >= area.x && pos.y >= area.y && pos.x < area.x + area.width && pos.y < area.y + area.height)
    }, false)
}

// check if draggable top area of the window is visible and accessible on any display (to prevent windows from being inaccessible and unmovable)
export function isDraggableAreaVisible(bounds: { x: number; y: number }, width: number) {
    const displays = screen.getAllDisplays()
    const TITLE_BAR_HEIGHT = 35 // approximated

    return displays.some((display) => {
        const area = display.workArea

        // Check if title bar rectangle intersects with display work area
        const windowLeft = bounds.x
        const windowRight = bounds.x + width
        const windowTop = bounds.y
        const windowTitleBottom = bounds.y + TITLE_BAR_HEIGHT

        const displayLeft = area.x
        const displayRight = area.x + area.width
        const displayTop = area.y
        const displayBottom = area.y + area.height

        return windowLeft < displayRight && windowRight > displayLeft && windowTop < displayBottom && windowTitleBottom > displayTop
    })
}
