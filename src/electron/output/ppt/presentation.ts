import os from "os"
import Slideshow from "slideshow"
import { getMainWindow, isProd } from "../.."
import { ToMain } from "../../../types/IPC/ToMain"
import { sendToMain } from "../../IPC/main"
import { OutputHelper } from "../OutputHelper"
import { OutputValues } from "../helpers/OutputValues"

// from "slideshow" - "connector.js"
const connectors = {
    darwin: ["Keynote", "Keynote 5", "Keynote 6", "PowerPoint"], // , "PowerPoint 2011", "PowerPoint 2016"
    win32: ["PowerPoint"] // , "PowerPoint 2010", "PowerPoint 2013"
}

export function getPresentationApplications() {
    const list: string[] = (connectors as any)[os.platform()] || []
    return list
}

let alwaysOnTopDisabled: string[] = []
let starting = false
export async function startSlideshow(data: { path: string; program: string }) {
    if (closing || starting) return
    starting = true

    await initPresentation(data.path, data.program.toLowerCase().replaceAll(" ", ""))

    if (alwaysOnTopDisabled.length) return
    OutputHelper.getAllOutputs().forEach(output => {
        if (output.window.isAlwaysOnTop()) {
            OutputValues.updateValue({ id: output.id, key: "alwaysOnTop", value: false })
            alwaysOnTopDisabled.push(output.id)
        }
    })
}

let closing = false
function stopSlideshow() {
    if (!currentSlideshow || closing || starting) return
    closing = true
    if (stateUpdater) clearTimeout(stateUpdater)

    currentSlideshow
        .stop()
        // closing does not work, so leave it open to remove confusion
        // .then(() => currentSlideshow!.close())
        // .then(() => currentSlideshow!.quit())
        .then(end)
        .catch(err => {
            if (err !== "still no running slideshow" && err !== "still no active presentation") {
                console.error("Error when closing:", err)
            }
            end()
        })
    // .done()

    function end() {
        try {
            currentSlideshow!.end()
        } catch (err) {
            console.error("Error when ending:", err)
        }

        currentSlideshow = null
        closing = false
        openedPresentation = ""

        setTimeout(() => {
            alwaysOnTopDisabled.forEach(id => {
                OutputValues.updateValue({ id, key: "alwaysOnTop", value: true })
            })
            alwaysOnTopDisabled = []
        })
    }
}

let currentSlideshow: Slideshow | null = null
let openedPresentation = ""
async function initPresentation(path: string, program = "powerpoint") {
    if (currentSlideshow) {
        try {
            await currentSlideshow.stop()
            // closing does not work, so leave it open to remove confusion
            // if (openedPresentation !== path) {
            //     await currentSlideshow.close()
            // }
            // await currentSlideshow.quit()
        } catch (err) {
            if (err !== "still no running slideshow" && err !== "still no active presentation") {
                console.error("CLOSE", err)
            }
        }
    }

    try {
        currentSlideshow = new Slideshow(program, isProd)

        // Fix encoding to allow non-English characters.
        ;(currentSlideshow as any).connector.c.stdin.setEncoding("latin1")
        ;(currentSlideshow as any).connector.c.stdout.setEncoding("latin1")
    } catch (err) {
        if ((err as Error).message.includes("unsupported platform")) {
            sendToMain(ToMain.ALERT, "Presentation app could not start, try opening it manually!")
        } else {
            console.error("INIT", err)
            sendToMain(ToMain.ALERT, String(err))
        }

        starting = false
        return
    }

    try {
        await currentSlideshow.boot(path)
    } catch (err) {
        console.error("BOOT", err)
        if (err === "application still not running") {
            sendToMain(ToMain.ALERT, "Presentation app could not start, try opening it manually!")
        } else {
            sendToMain(ToMain.ALERT, String(err))
        }
    }

    if (openedPresentation !== path) {
        try {
            await currentSlideshow.open(path)
        } catch (err) {
            console.error("OPEN", err)
            if (err === "Something went wrong with the presentation controller") {
                sendToMain(ToMain.ALERT, "Presentation app could not start, try opening it manually!")
            } else {
                sendToMain(ToMain.ALERT, String(err))
            }
        }
    }

    openedPresentation = path

    try {
        await currentSlideshow.start()
    } catch (err) {
        console.error("START", err)
        if (err === "still no active presentation") {
            sendToMain(ToMain.ALERT, "Could not start presentation, please open it manually and try again!")
        } else {
            sendToMain(ToMain.ALERT, String(err))
        }

        starting = false
        return
    }

    // focus on main window instead of PowerPoint window (seemingly not working)
    getMainWindow()?.focus()

    starting = false
    await updateState()
}

// prevent rapid changes
let navigationTimeout: NodeJS.Timeout | null = null
const navigationWait = 50
const presentationActions = {
    next: async () => {
        if (navigationTimeout) return
        if (stat && stat.position >= stat.slides) return

        await currentSlideshow!.next()

        navigationTimeout = setTimeout(() => {
            navigationTimeout = null
        }, navigationWait)
    },
    previous: async () => {
        if (navigationTimeout) return

        await currentSlideshow!.prev()

        navigationTimeout = setTimeout(() => {
            navigationTimeout = null
        }, navigationWait)
    },
    // WIP black screen not working
    // black: () => {
    //     if (isPaused) currentSlideshow!.resume()
    //     else currentSlideshow!.pause()

    //     isPaused = !isPaused
    // },
    first: () => currentSlideshow!.first(),
    last: () => currentSlideshow!.last(),
    // goto: (index: number) => currentSlideshow!.goto(index),
    stop: () => stopSlideshow()
}

export async function presentationControl(data: { action: string }) {
    if (!currentSlideshow) return

    try {
        if (data.action in presentationActions) await presentationActions[data.action as keyof typeof presentationActions]()
        else console.error("MISSING PRESENTATION CONTROL")
    } catch (err) {
        console.error("Could not execute action:", err)
    }

    setTimeout(updateState)
}

let stateUpdater: NodeJS.Timeout | null = null
let stat: null | { state: string; position: number; slides: number } = null
async function updateState() {
    if (!currentSlideshow) return
    if (stateUpdater) clearTimeout(stateUpdater)
    const state: { id: string; stat: any; info: any } = { id: openedPresentation, stat: {}, info: {} }

    try {
        state.stat = await currentSlideshow?.stat()
        stat = state.stat
    } catch (err) {
        if (currentSlideshow) console.info("STAT", err)
        return
    }

    try {
        state.info = await currentSlideshow?.info()
    } catch (err) {
        if (currentSlideshow) console.info("INFO", err)
        return
    }

    // return state
    sendToMain(ToMain.PRESENTATION_STATE, state)

    // update state every once in a while in case presentation window is in focus
    if (stateUpdater) clearTimeout(stateUpdater)
    stateUpdater = setTimeout(updateState, 5000)
}
