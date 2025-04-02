import { get } from "svelte/store"
import { OUTPUT, STARTUP } from "../../types/Channels"
import { Main } from "../../types/IPC/Main"
import { checkStartupActions } from "../components/actions/actions"
import { getTimeFromInterval } from "../components/helpers/time"
import { requestMainMultiple, sendMain, sendMainMultiple } from "../IPC/main"
import { activePopup, alertMessage, currentWindow, dataPath, deviceId, isDev, language, loaded, loadedState, os, scriptures, special, tempPath, version, windowState } from "../stores"
import { startTracking } from "./analytics"
import { wait } from "./common"
import { setLanguage } from "./language"
import { storeSubscriber } from "./listeners"
import { receiveOUTPUTasOUTPUT, remoteListen, setupMainReceivers } from "./receivers"
import { destroy, receive, send } from "./request"
import { save, unsavedUpdater } from "./save"

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

    // custom alert
    if (get(language) === "no" && !get(activePopup) && !Object.values(get(scriptures)).find((a) => ["eea18ccd2ca05dde-01", "7bcaa2f2e77739d5-01"].includes(a.id || ""))) {
        alertMessage.set('Bibel 2011 Bokmål/Nynorsk er nå tilgjengelig som API i "Bibel"-menyen!')
        activePopup.set("alert")
    }

    await wait(5000)
    unsavedUpdater()

    // CHECK LISTENERS
    // console.log(window.api.getListeners())
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
    sendMain(Main.PCO_STARTUP_LOAD, { dataPath: get(dataPath) })
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
}

async function getStoredData() {
    sendMainMultiple([Main.SYNCED_SETTINGS, Main.STAGE_SHOWS, Main.PROJECTS, Main.OVERLAYS, Main.TEMPLATES, Main.EVENTS, Main.MEDIA, Main.THEMES, Main.DRIVE_API_KEY, Main.HISTORY, Main.CACHE, Main.USAGE])

    await waitUntilDefined(() => get(loadedState).includes("synced_settings"))
    sendMain(Main.SETTINGS)
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
