import os from "os"
import Slideshow from "slideshow"
import { toApp } from "../.."
import { MAIN } from "../../../types/Channels"

// from "slideshow" - "connector.js"
const connectors: any = {
    darwin: ["keynote", "keynote5", "keynote6", "powerpoint", "powerpoint2011", "powerpoint2016"],
    win32: ["powerpoint", "powerpoint2010", "powerpoint2013"],
}

export function getPresentationApplications() {
    let list = connectors[os.platform()] || []
    return list
}

type SupportedPrograms = "powerpoint" | "keynote"
export function startSlideshow(data: { path: string; program: SupportedPrograms }) {
    initPresentation(data.path, data.program)
}

let closing = false
function stopSlideshow() {
    if (!currentSlideshow || closing) return
    closing = true

    currentSlideshow
        .stop()
        .then(() => currentSlideshow!.close())
        .then(() => currentSlideshow!.quit())
        .then(end)
        .catch((err) => {
            console.error("Error when closing:", err)
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
}

let currentSlideshow: Slideshow | null = null
let openedPresentation: string = ""
async function initPresentation(path: string, program: SupportedPrograms = "powerpoint") {
    // check if actually presenting...
    if (closing || openedPresentation === path) return

    if (currentSlideshow) {
        try {
            await currentSlideshow.stop()
            await currentSlideshow.close()
            // await currentSlideshow.quit()
        } catch (err) {
            if (err !== "still no running slideshow" && err !== "still no active presentation") {
                console.error("CLOSE", err)
            }
        }
    }

    // WIP keynote etc.
    try {
        currentSlideshow = new Slideshow(program)
    } catch (err) {
        if (err.includes("unsupported platform")) {
            toApp(MAIN, { channel: "ALERT", data: "Presentation app could not start, try opening it manually!" })
        } else {
            console.error("INIT", err)
            toApp(MAIN, { channel: "ALERT", data: err })
        }
        return
    }

    try {
        await currentSlideshow.boot(path)
    } catch (err) {
        console.error("BOOT", err)
        // WIP send toast to main
        if (err === "application still not running") {
            toApp(MAIN, { channel: "ALERT", data: "Presentation app could not start, try opening it manually!" })
        } else {
            toApp(MAIN, { channel: "ALERT", data: err })
        }
    }

    openedPresentation = path

    // if (openedPresentation !== path) {
    // try {
    //     await currentSlideshow.open(path)
    // } catch (err) {
    //     console.error("OPEN", err)
    //     if (err === "Something went wrong with the presentation controller") {
    //         toApp(MAIN, { channel: "ALERT", data: "Presentation app could not start, try opening it manually!" })
    //     } else {
    //         toApp(MAIN, { channel: "ALERT", data: err })
    //     }
    // }
    // }

    try {
        await currentSlideshow.start()
    } catch (err) {
        console.error("START", err)
        toApp(MAIN, { channel: "ALERT", data: err })
        return
    }

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

async function updateState() {
    if (!currentSlideshow) return
    let state: any = { id: openedPresentation }

    try {
        state.stat = await currentSlideshow.stat()
    } catch (err) {
        console.log("STAT", err)
        return
    }

    try {
        state.info = await currentSlideshow.info()
    } catch (err) {
        console.log("INFO", err)
        return
    }

    // try {
    //     state.thumbnail = await currentSlideshow.thumbs(thumbPath)
    // } catch (err) {
    //     console.log("THUMB", err)
    //     return
    // }

    // return state
    toApp(MAIN, { channel: "PRESENTATION_STATE", data: state })
}
