import os from "os"
import Slideshow from "slideshow"
import { isProd, mainWindow, toApp } from "../.."
import { MAIN } from "../../../types/Channels"
import { OutputHelper } from "../OutputHelper"

// from "slideshow" - "connector.js"
const connectors: any = {
    darwin: ["Keynote", "Keynote 5", "Keynote 6", "PowerPoint"], // , "PowerPoint 2011", "PowerPoint 2016"
    win32: ["PowerPoint"], // , "PowerPoint 2010", "PowerPoint 2013"
}

export function getPresentationApplications() {
    let list = connectors[os.platform()] || []
    return list
}

let alwaysOnTopDisabled: string[] = []
let starting: boolean = false
export function startSlideshow(data: { path: string; program: string }) {
    if (closing || starting) return
    starting = true

    initPresentation(data.path, data.program.toLowerCase().replaceAll(" ", ""))

    if (alwaysOnTopDisabled.length) return
    OutputHelper.getAllOutputs().forEach(([id, output]) => {
        if (output.window.isAlwaysOnTop()) {
            output.window.setAlwaysOnTop(false)
            alwaysOnTopDisabled.push(id)
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
        .catch((err) => {
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
    }

    alwaysOnTopDisabled.forEach((id) => {
        OutputHelper.getOutput(id).window.setAlwaysOnTop(true)
    })
    alwaysOnTopDisabled = []
}

let currentSlideshow: Slideshow | null = null
let openedPresentation: string = ""
async function initPresentation(path: string, program: string = "powerpoint") {
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
    } catch (err) {
        if (err.includes("unsupported platform")) {
            toApp(MAIN, { channel: "ALERT", data: "Presentation app could not start, try opening it manually!" })
        } else {
            console.error("INIT", err)
            toApp(MAIN, { channel: "ALERT", data: err })
        }

        starting = false
        return
    }

    try {
        await currentSlideshow.boot(path)
    } catch (err) {
        console.error("BOOT", err)
        if (err === "application still not running") {
            toApp(MAIN, { channel: "ALERT", data: "Presentation app could not start, try opening it manually!" })
        } else {
            toApp(MAIN, { channel: "ALERT", data: err })
        }
    }

    if (openedPresentation !== path) {
        try {
            await currentSlideshow.open(path)
        } catch (err) {
            console.error("OPEN", err)
            if (err === "Something went wrong with the presentation controller") {
                toApp(MAIN, { channel: "ALERT", data: "Presentation app could not start, try opening it manually!" })
            } else {
                toApp(MAIN, { channel: "ALERT", data: err })
            }
        }
    }

    openedPresentation = path

    try {
        await currentSlideshow.start()
    } catch (err) {
        console.error("START", err)
        if (err === "still no active presentation") {
            toApp(MAIN, { channel: "ALERT", data: "Could not start presentation, please open it manually and try again!" })
        } else {
            toApp(MAIN, { channel: "ALERT", data: err })
        }

        starting = false
        return
    }

    // focus on main window instead of PowerPoint window (seemingly not working)
    mainWindow?.focus()

    starting = false
    updateState()
}

const presentationActions: any = {
    next: () => currentSlideshow!.next(),
    previous: () => currentSlideshow!.prev(),
    // WIP black screen not working
    // black: () => {
    //     if (isPaused) currentSlideshow!.resume()
    //     else currentSlideshow!.pause()

    //     isPaused = !isPaused
    // },
    first: () => currentSlideshow!.first(),
    last: () => currentSlideshow!.last(),
    // goto: (index: number) => currentSlideshow!.goto(index),
    stop: () => stopSlideshow(),
}

export function presentationControl(data: { action: string }) {
    if (!currentSlideshow) return

    try {
        if (presentationActions[data.action]) presentationActions[data.action]()
        else console.log("MISSING PRESENTATION CONTROL")
    } catch (err) {
        console.error("Could not execute action:", err)
    }

    setTimeout(updateState)
}

let stateUpdater: any = null
async function updateState() {
    if (!currentSlideshow) return
    if (stateUpdater) clearTimeout(stateUpdater)
    let state: any = { id: openedPresentation }

    try {
        state.stat = await currentSlideshow?.stat()
    } catch (err) {
        if (currentSlideshow) console.log("STAT", err)
        return
    }

    try {
        state.info = await currentSlideshow?.info()
    } catch (err) {
        if (currentSlideshow) console.log("INFO", err)
        return
    }

    // return state
    toApp(MAIN, { channel: "PRESENTATION_STATE", data: state })

    // update state every once in a while in case presentation window is in focus
    stateUpdater = setTimeout(updateState, 5000)
}
