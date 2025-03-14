import { get } from "svelte/store"
import { MAIN, OUTPUT, STARTUP, STORE } from "../../types/Channels"
import { checkStartupActions } from "../components/actions/actions"
import { getTimeFromInterval } from "../components/helpers/time"
import { requestMainMultiple } from "../IPC/main"
import {
    activePopup,
    currentWindow,
    dataPath,
    deviceId,
    driveKeys,
    events,
    folders,
    isDev,
    loaded,
    loadedState,
    media,
    os,
    overlays,
    projects,
    projectTemplates,
    redoHistory,
    special,
    stageShows,
    templates,
    tempPath,
    textCache,
    theme,
    themes,
    undoHistory,
    usageLog,
    version,
    windowState,
} from "../stores"
import { startTracking } from "./analytics"
import { wait } from "./common"
import { setLanguage } from "./language"
import { storeSubscriber } from "./listeners"
import { receiveOUTPUTasOUTPUT, remoteListen, setupMainReceivers } from "./receivers"
import { destroy, receive, send } from "./request"
import { save, unsavedUpdater } from "./save"
import { updateSyncedSettings, updateThemeValues } from "./updateSettings"
import { Main } from "../../types/IPC/Main"
import { clone } from "../components/helpers/array"
import { defaultThemes } from "../components/settings/tabs/defaultThemes"

let initialized: boolean = false
export function startup() {
    window.api.receive(
        STARTUP,
        (msg) => {
            if (initialized || msg.channel !== "TYPE") return
            initialized = true // only call this once per window
            destroy(STARTUP, "startup")

            let type = msg.data
            currentWindow.set(type)

            if (type) loaded.set(true)

            if (type === "pdf") return
            if (type === "output") {
                startupOutput()
                return
            }

            startupMain()
        },
        "startup"
    )
}

async function startupMain() {
    setLanguage("", true)
    setupMainReceivers()
    getMainData()

    await wait(100)
    getStoredData()

    await waitUntilDefined(() => get(loaded))
    storeSubscriber()
    remoteListen()
    checkStartupActions()
    autoBackup()
    startTracking()
    connect()

    await wait(5000)
    unsavedUpdater()
}

function autoBackup() {
    let interval = get(special).autoBackup || "weekly"
    if (interval === "never" || get(activePopup) === "initialize") return

    let now = Date.now()
    let lastBackup = get(special).autoBackupPrevious || 0
    let minTimeToBackup = getTimeFromInterval(interval)

    if (now - lastBackup > minTimeToBackup) {
        special.update((a) => {
            a.autoBackupPrevious = now
            return a
        })
        save(false, { backup: true, silent: true })
    }
}

function connect() {
    pcoSync()
}

export function pcoSync() {
    send(MAIN, ["PCO_STARTUP_LOAD"], { dataPath: get(dataPath) })
}

function getMainData() {
    requestMainMultiple({
        [Main.VERSION]: (a) => version.set(a),
        [Main.IS_DEV]: (a) => isDev.set(a),
        [Main.GET_OS]: (a) => os.set(a),
        [Main.GET_TEMP_PATHS]: (a) => tempPath.set(a.temp),
        [Main.DEVICE_ID]: (a) => deviceId.set(a),
        [Main.MAXIMIZED]: (a) => windowState.set({ ...windowState, maximized: a }),
    })
    // send(MAIN, ["DISPLAY"])
}

async function getStoredData() {
    requestMainMultiple({
        [Main.SYNCED_SETTINGS]: (a) => updateSyncedSettings(a),
        [Main.STAGE_SHOWS]: (a) => stageShows.set(a),
        [Main.PROJECTS]: (a) => {
            projects.set(a.projects || {})
            folders.set(a.folders || {})
            projectTemplates.set(a.projectTemplates || {})
        },
        [Main.OVERLAYS]: (a) => overlays.set(a),
        [Main.TEMPLATES]: (a) => templates.set(a),
        [Main.EVENTS]: (a) => events.set(a),
        [Main.MEDIA]: (a) => media.set(a),
        [Main.THEMES]: (a) => {
            themes.set(Object.keys(a).length ? a : clone(defaultThemes))

            // update if themes are loaded after settings
            if (get(theme) !== "default") updateThemeValues(get(themes)[get(theme)])
        },
        [Main.DRIVE_API_KEY]: (a) => driveKeys.set(a),
        [Main.HISTORY]: (a) => {
            undoHistory.set(a.undo || [])
            redoHistory.set(a.redo || [])
        },
        [Main.USAGE]: (a) => usageLog.set(a),
        [Main.CACHE]: (a) => {
            textCache.set(a.text || {})
        },
    })

    // send(STORE, ["SYNCED_SETTINGS", "STAGE_SHOWS", "PROJECTS", "OVERLAYS", "TEMPLATES", "EVENTS", "MEDIA", "THEMES", "DRIVE_API_KEY", "HISTORY", "USAGE", "CACHE"])

    await waitUntilDefined(() => get(loadedState).includes("synced_settings"))
    send(STORE, ["SETTINGS"])
}

async function startupOutput() {
    setLanguage() // this is only needed for the context menu
    receive(OUTPUT, receiveOUTPUTasOUTPUT)

    // wait a bit on slow computers
    await wait(200)

    send(OUTPUT, ["REQUEST_DATA_MAIN"])
}

const UPDATE_INTERVAL = 200
const MAX_TIME = 8000
async function waitUntilDefined(getValue: any) {
    return new Promise((resolve) => {
        let timeWaited = 0
        const checkDefinedInterval = setInterval(checkValue, UPDATE_INTERVAL)

        function checkValue() {
            timeWaited += UPDATE_INTERVAL
            if (!getValue() && timeWaited < MAX_TIME) return

            clearInterval(checkDefinedInterval)
            resolve(true)
        }
    })
}
