import { get } from "svelte/store"
import type { ContentProviderId } from "../../electron/contentProviders/base/types"
import { OUTPUT, STARTUP } from "../../types/Channels"
import { Main } from "../../types/IPC/Main"
import { checkStartupActions } from "../components/actions/actions"
import { getTimeFromInterval } from "../components/helpers/time"
import { requestMainMultiple, sendMain, sendMainMultiple } from "../IPC/main"
import { cameraManager } from "../media/cameraManager"
import { activePopup, alertMessage, contentProviderData, currentWindow, dataPath, deviceId, isDev, language, loaded, loadedState, os, scriptures, shows, showsPath, special, tempPath, version, windowState } from "../stores"
import { startTracking } from "./analytics"
import { wait, waitUntilValueIsDefined } from "./common"
import { setLanguage } from "./language"
import { storeSubscriber } from "./listeners"
import { openProfileByName } from "./profile"
import { receiveOUTPUTasOUTPUT, remoteListen, setupMainReceivers } from "./receivers"
import { destroy, receive, send } from "./request"
import { save, unsavedUpdater } from "./save"

let initialized = false
let startupProfile: string = ""

export function startup() {
    window.api.receive(
        STARTUP,
        (msg) => {
            if (initialized || msg.channel !== "TYPE") return
            initialized = true // only call this once per window
            destroy(STARTUP, "startup")

            const type = msg.data
            currentWindow.set(type)

            if (type) loaded.set(true)

            if (type === "pdf") return
            if (type === "output") {
                startupOutput()
                return
            }

            startupProfile = msg.autoProfile

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

    await waitUntilValueIsDefined(() => get(loaded), 100, 8000)

    if (startupProfile) openProfileByName(startupProfile)

    storeSubscriber()
    remoteListen()
    checkStartupActions()
    autoBackup()
    startTracking()
    contentProviderSync()

    // custom alert
    if (get(language) === "no" && !get(activePopup) && !Object.values(get(scriptures)).find((a) => ["eea18ccd2ca05dde-01", "7bcaa2f2e77739d5-01"].includes(a.id || "")) && Math.random() < 0.4) {
        alertMessage.set('Bibel 2011 Bokmål/Nynorsk er nå tilgjengelig som API i "Bibel"-menyen!')
        activePopup.set("alert")
    }

    await wait(5000)
    unsavedUpdater()
    cameraManager.initializeCameraWarming()

    // CHECK LISTENERS
    // console.log(window.api.getListeners())
}

function autoBackup() {
    const interval = get(special).autoBackup || "weekly"
    if (interval === "never" || get(activePopup) === "initialize") return

    const now = Date.now()
    const lastBackup = get(special).autoBackupPrevious || 0
    const minTimeToBackup = getTimeFromInterval(interval)

    if (now - lastBackup > minTimeToBackup) {
        special.update((a) => {
            // subtract one hour from time to keep it relatively the same with each backup
            a.autoBackupPrevious = now - 3600000
            return a
        })

        // 20% chance of backing up all shows as well (just in case)
        save(false, { backup: true, isAutoBackup: true, backupShows: Math.random() < 0.2 })
    }
}

export function contentProviderSync() {
    const providers = [
        { providerId: "planningcenter" as ContentProviderId, scope: "services", data: { dataPath: get(dataPath) } },
        { providerId: "churchApps" as ContentProviderId, scope: "plans", data: { shows: get(shows), categories: get(contentProviderData).churchApps?.syncCategories || [], showsPath: get(showsPath) || "" } }
    ]

    providers.forEach(({ providerId, scope, data }) => {
        sendMain(Main.PROVIDER_STARTUP_LOAD, { providerId, scope, data })
    })
}


function getMainData() {
    requestMainMultiple({
        [Main.VERSION]: (a) => version.set(a),
        [Main.IS_DEV]: (a) => isDev.set(a),
        [Main.GET_OS]: (a) => os.set(a),
        [Main.GET_TEMP_PATHS]: (a) => tempPath.set(a.temp),
        [Main.DEVICE_ID]: (a) => deviceId.set(a),
        [Main.MAXIMIZED]: (a) => windowState.set({ ...windowState, maximized: a })
    })
}

async function getStoredData() {
    sendMainMultiple([Main.SYNCED_SETTINGS, Main.STAGE_SHOWS, Main.PROJECTS, Main.OVERLAYS, Main.TEMPLATES, Main.EVENTS, Main.MEDIA, Main.THEMES, Main.DRIVE_API_KEY, Main.HISTORY, Main.CACHE, Main.USAGE])

    await waitUntilValueIsDefined(() => get(loadedState).includes("synced_settings"), 200, 8000)
    sendMain(Main.SETTINGS)
}

async function startupOutput() {
    setLanguage() // this is only needed for the context menu (and stage display)
    receive(OUTPUT, receiveOUTPUTasOUTPUT)

    // wait a bit on slow computers
    await wait(200)

    send(OUTPUT, ["REQUEST_DATA_MAIN"])
}