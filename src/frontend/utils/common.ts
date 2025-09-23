import { get } from "svelte/store"
import { OUTPUT } from "../../types/Channels"
import { Main } from "../../types/IPC/Main"
import type { ErrorLog } from "../../types/Main"
import { removeDuplicates } from "../components/helpers/array"
import { getContrast } from "../components/helpers/color"
import { getActiveOutputs, toggleOutputs } from "../components/helpers/output"
import { sendMain } from "../IPC/main"
import {
    activeTriggerFunction,
    autosave,
    currentWindow,
    disabledServers,
    drawer,
    errorHasOccurred,
    focusedArea,
    os,
    outputs,
    quickSearchActive,
    resized,
    serverData,
    special,
    theme,
    themes,
    toastMessages,
    version
} from "../stores"
import { convertAutosave } from "../values/autosave"
import { send } from "./request"
import { save } from "./save"

export const DEFAULT_WIDTH = 290 // --navigation-width (global.css) | resized (stores.ts & defaults.ts)
export const DEFAULT_DRAWER_HEIGHT = 300
export const MENU_BAR_HEIGHT = 25 // main (ManuBar.svelte) - Windows

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

// wait until input value is true
export async function waitUntilValueIsDefined(value: () => any, intervalTime = 50, timeoutValue = 5000) {
    return new Promise(async (resolve) => {
        let currentValue = await value()
        if (currentValue) resolve(currentValue)

        const timeout = setTimeout(() => {
            exit()
            resolve(null)
        }, timeoutValue)

        const interval = setInterval(async () => {
            currentValue = await value()
            if (!currentValue) return

            exit()
            resolve(currentValue)
        }, intervalTime)

        function exit() {
            clearTimeout(timeout)
            clearInterval(interval)
        }
    })
}

// hide output window
export function hideDisplay() {
    toggleOutputs(null, { state: false })
}

export function mainClick(e: any) {
    // open links externally
    if (e.target?.closest("a.open")) {
        e.preventDefault()
        const href = e.target.getAttribute("href")
        if (href) sendMain(Main.URL, href)
    }
}

// select all focus
export function focusArea(e: any) {
    if (get(quickSearchActive) && !e.target.closest(".quicksearch")) quickSearchActive.set(false)

    if (e.target.closest(".menus") || e.target.closest(".contextMenu")) return
    focusedArea.set(e.target.closest(".selectElem")?.id || e.target.querySelector(".selectElem")?.id || "")
}

// auto save
let autosaveTimeout: NodeJS.Timeout | null = null
export let previousAutosave = 0
export function startAutosave() {
    if (get(currentWindow)) return
    if (autosaveTimeout) clearTimeout(autosaveTimeout)

    const saveInterval = convertAutosave[get(autosave)]
    if (!saveInterval) {
        autosaveTimeout = null
        return
    }

    previousAutosave = Date.now()
    autosaveTimeout = setTimeout(() => {
        save(false, { autosave: true })
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
    "The play() request was interrupted because video-only background media was paused to save power.", // video issue
    "Failed to fetch", // probably offline
    "Uncaught IndexSizeError: Failed to execute 'setStart' on 'Range'", // caret update/reset (pos larger than content)
    "Uncaught IndexSizeError: Failed to execute 'setEnd' on 'Range'", // caret update/reset (pos larger than content)
    " is not defined\n    at eval", // inputting text into number input
]
export function logerror(err) {
    const msg = err.type === "unhandledrejection" ? err.reason?.message : err.message
    if (!msg || ERROR_FILTER.find((a) => msg.includes(a))) return

    const log: ErrorLog = {
        time: new Date(),
        os: get(os).platform || "Unknown",
        version: get(version),
        type: err.type,
        source: err.type === "unhandledrejection" ? "See stack" : `${err.filename} - ${err.lineno}:${err.colno}`,
        message: msg,
        stack: err.reason?.stack || err.error?.stack,
    }

    errorHasOccurred.set(true) // always show close popup if this has happened (so the user can choose to not save)
    sendMain(Main.LOG_ERROR, log)
}

// stream to OutputShow
export function toggleRemoteStream() {
    if (get(currentWindow) || get(special).optimizedMode) return

    const value = { key: "server", value: false }
    let captureOutputId = get(serverData)?.output_stream?.outputId
    if (!captureOutputId || !get(outputs)[captureOutputId]) captureOutputId = getActiveOutputs(get(outputs), true, true)[0]
    if (get(disabledServers).output_stream === false) value.value = true

    setTimeout(() => {
        // , rate: get(special).previewRate || "auto"
        send(OUTPUT, ["SET_VALUE"], { id: captureOutputId, key: "capture", value })
    }, 1800)
}

// dev specific commands
export function startDevMode() {
    // start svelte inspector
    const script = document.createElement("script")
    script.src = "http://localhost:5001/start"
    document.body.appendChild(script)
}

// toggle drawer & left/right panels
const minDrawerHeight = 40
const minPanelWidth = 4
let panelsManuallyClosed = false
export function togglePanels() {
    const drawerIsOpened = get(drawer).height > minDrawerHeight
    const leftPanelIsOpened = get(resized).leftPanel > minPanelWidth
    const rightPanelIsOpened = get(resized).rightPanel > minPanelWidth

    // close all
    if (drawerIsOpened || leftPanelIsOpened || rightPanelIsOpened) {
        drawer.set({ height: minDrawerHeight, stored: get(drawer).height })
        resized.set({ ...get(resized), leftPanel: minPanelWidth, rightPanel: minPanelWidth })
        panelsManuallyClosed = !leftPanelIsOpened && !rightPanelIsOpened
        return
    }

    // open all
    if (!drawerIsOpened) drawer.set({ height: get(drawer).stored || DEFAULT_DRAWER_HEIGHT, stored: null })
    if (!panelsManuallyClosed) resized.set({ ...get(resized), leftPanel: leftPanelIsOpened ? get(resized).leftPanel : DEFAULT_WIDTH, rightPanel: rightPanelIsOpened ? get(resized).rightPanel : DEFAULT_WIDTH })
}

// trigger functions in .svelte files (used to trigger big and old functions still in .svelte files)
const triggerTimeout: NodeJS.Timeout | null = null
export function triggerFunction(id: string) {
    activeTriggerFunction.set(id)

    if (triggerTimeout) clearTimeout(triggerTimeout)
    setTimeout(() => {
        activeTriggerFunction.set("")
    }, 100)
}

// get theme contrast color
// WIP similar to "secondary" in App.svelte
export function isDarkTheme() {
    const contrastColor = getContrast(get(themes)[get(theme)]?.colors?.primary || "")
    return contrastColor === "#FFFFFF"
}

const throttled: { [key: string]: any } = {}
export function throttle(id: string, value: any, callback: (v: any) => void, maxUpdatesPerSecond: number) {
    // value = clone(value)

    if (throttled[id] !== undefined) {
        throttled[id] = value
        return
    }

    callback(value)
    throttled[id] = "WAITING"

    setTimeout(() => {
        if (throttled[id] !== "WAITING") callback(throttled[id])
        delete throttled[id]
    }, 1000 / maxUpdatesPerSecond)
}

const limited: Record<string, { timeout: NodeJS.Timeout; pending: ((v: boolean) => void) }> = {}
export function hasNewerUpdate(id: string, maxUpdatesMs = 0): Promise<boolean> {
    // resolve any existing updates as false as there is a newer one
    if (limited[id]) {
        clearTimeout(limited[id].timeout)
        limited[id].pending(true)
    }

    return new Promise((resolve) => {
        limited[id] = {
            timeout: setTimeout(() => {
                delete limited[id]
                resolve(false)
            }, maxUpdatesMs),
            pending: resolve,
        }
    })
}
