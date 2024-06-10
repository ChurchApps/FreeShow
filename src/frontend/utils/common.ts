import { get } from "svelte/store"
import { MAIN, OUTPUT } from "../../types/Channels"
import { getActiveOutputs } from "../components/helpers/output"
import { activeEdit, activePage, activeShow, allOutputs, autosave, currentWindow, disabledServers, focusedArea, os, outputDisplay, outputs, serverData, special, toastMessages, version } from "../stores"
import { convertAutosave } from "../values/autosave"
import { send } from "./request"
import { save } from "./save"
import { removeDuplicates } from "../components/helpers/array"

// create toast popup
export function newToast(msg: string) {
    if (!msg) return
    toastMessages.set(removeDuplicates([...get(toastMessages), msg]))
}

// async wait (instead of timeouts)
export function wait(ms: number) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve("ended")
        }, Number(ms))
    })
}

// hide output window
export function hideDisplay(ctrlKey: boolean = true) {
    if (!ctrlKey) return
    outputDisplay.set(false)

    let outputsList: any[] = getActiveOutputs(get(allOutputs), false)
    outputsList.forEach((id) => {
        let output: any = { id, ...get(allOutputs)[id] }
        send(OUTPUT, ["DISPLAY"], { enabled: false, output })
    })
}

// select all focus
export function focusArea(e: any) {
    if (e.target.closest(".menus") || e.target.closest(".contextMenu")) return
    focusedArea.set(e.target.closest(".selectElem")?.id || e.target.querySelector(".selectElem")?.id || "")
}

// auto save
let autosaveTimeout: any = null
export function startAutosave() {
    if (get(currentWindow)) return
    if (autosaveTimeout) clearTimeout(autosaveTimeout)

    let saveInterval = convertAutosave[get(autosave)]
    if (!saveInterval) {
        autosaveTimeout = null
        return
    }

    autosaveTimeout = setTimeout(() => {
        save()
        startAutosave()
    }, saveInterval)
}

// error logger
const ERROR_FILTER = [
    "Failed to execute 'drawImage' on 'CanvasRenderingContext2D'", // canvas media cache
    "Failed to construct 'ImageData'", // invalid image size
    "Failed to load because no supported source was found.", // media file doesn't exists
    "The element has no supported sources.", // audio error
    "The play() request was interrupted by a call to pause().", // video transitions
    "The play() request was interrupted because the media was removed from the document.", // video transitions
    "Failed to fetch", // probably offline
    "Uncaught IndexSizeError: Failed to execute 'setStart' on 'Range'", // caret update/reset (pos larger than content)
    "Uncaught IndexSizeError: Failed to execute 'setEnd' on 'Range'", // caret update/reset (pos larger than content)
    " is not defined\n    at eval", // inputting text into number input
]
export function logerror(err) {
    let msg = err.type === "unhandledrejection" ? err.reason?.message : err.message
    if (!msg || ERROR_FILTER.find((a) => msg.includes(a))) return

    let log = {
        time: new Date(),
        os: get(os).platform || "Unknown",
        version: get(version),
        active: { window: get(currentWindow) || "main", page: get(activePage), show: get(activeShow), edit: get(activeEdit) },
        // lastUndo: get(undoHistory)[get(undoHistory).length - 1],
        type: err.type,
        source: err.type === "unhandledrejection" ? "See stack" : `${err.filename} - ${err.lineno}:${err.colno}`,
        message: msg,
        stack: err.reason?.stack || err.error?.stack,
    }

    send(MAIN, ["LOG_ERROR"], log)
}

// stream to OutputShow
export function toggleRemoteStream() {
    let value = { key: "server", value: false }
    let captureOutputId = get(serverData)?.output_stream?.outputId
    if (!captureOutputId || !get(outputs)[captureOutputId]) captureOutputId = getActiveOutputs(get(outputs), true, true)[0]
    if (get(disabledServers).output_stream === false) value.value = true

    setTimeout(() => {
        send(OUTPUT, ["SET_VALUE"], { id: captureOutputId, key: "capture", value, rate: get(special).previewRate || "auto" })
    }, 1800)
}
