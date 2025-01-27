import { get } from "svelte/store"
import { MAIN, OUTPUT, STARTUP, STORE } from "../../types/Channels"
import { checkStartupActions } from "../components/actions/actions"
import { currentWindow, loaded, loadedState, special } from "../stores"
import { startTracking } from "./analytics"
import { wait } from "./common"
import { setLanguage } from "./language"
import { storeSubscriber } from "./listeners"
import { receiveOUTPUTasOUTPUT, remoteListen, setupMainReceivers } from "./receivers"
import { destroy, receive, send } from "./request"
import { save, unsavedUpdater } from "./save"
import { getTimeFromInterval } from "../components/helpers/time"

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
    let interval = get(special).autoBackup || "never"
    if (interval === "never") return

    let now = Date.now()
    let lastBackup = get(special).autoBackupPrevious || 0
    let minTimeToBackup = getTimeFromInterval(interval)

    if (now - lastBackup > minTimeToBackup) {
        save(false, { backup: true, silent: true })
        special.update((a) => {
            a.autoBackupPrevious = now
            return a
        })
    }
}

function connect() {
    send(MAIN, ["PCO_STARTUP_LOAD"])
}

function getMainData() {
    send(MAIN, ["VERSION", "IS_DEV", "GET_OS", "GET_TEMP_PATHS", "DEVICE_ID", "MAXIMIZED", "DISPLAY"])
}

async function getStoredData() {
    send(STORE, ["SYNCED_SETTINGS", "STAGE_SHOWS", "PROJECTS", "OVERLAYS", "TEMPLATES", "EVENTS", "MEDIA", "THEMES", "DRIVE_API_KEY", "HISTORY", "USAGE", "CACHE"])

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
