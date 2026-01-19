import { get } from "svelte/store"
import type { ContentProviderId } from "../../electron/contentProviders/base/types"
import { OUTPUT, STARTUP } from "../../types/Channels"
import { Main } from "../../types/IPC/Main"
import { checkStartupActions } from "../components/actions/actions"
import { getTimeFromInterval } from "../components/helpers/time"
import { requestMain, requestMainMultiple, sendMain, sendMainMultiple } from "../IPC/main"
import { cameraManager } from "../media/cameraManager"
import { activePopup, alertMessage, cachePath, contentProviderData, currentWindow, deviceId, driveKeys, isDev, language, loaded, loadedState, os, providerConnections, scriptures, shows, special, version, windowState } from "../stores"
import { startTracking } from "./analytics"
import { wait, waitUntilValueIsDefined } from "./common"
import { getDefaultElements } from "./createData"
import { setLanguage } from "./language"
import { storeSubscriber } from "./listeners"
import { autoOpenLastUsedProfile, openProfileByName } from "./profile"
import { receiveOUTPUTasOUTPUT, remoteListen, setupMainReceivers } from "./receivers"
import { destroy, receive, send } from "./request"
import { save, unsavedUpdater } from "./save"

let initialized = false
let startupProfile = ""

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
    else autoOpenLastUsedProfile()

    storeSubscriber()
    remoteListen()
    checkStartupActions()
    autoBackup()
    startTracking()
    contentProviderSync()

    // custom alert
    if (get(language) === "no" && !get(activePopup) && !Object.values(get(scriptures)).find((a) => ["eea18ccd2ca05dde-01", "7bcaa2f2e77739d5-01"].includes(a.id || "")) && Math.random() < 0.2) {
        alertMessage.set('Bibel 2011 Bokmål/Nynorsk er nå tilgjengelig som API i "Bibel"-menyen!')
        activePopup.set("alert")
    }

    await wait(5000)
    unsavedUpdater()
    cameraManager.initializeCameraWarming()

    // CHECK LISTENERS
    // console.log(window.api.getListeners())

    // RAM MONITOR (every 10 minutes)
    setTimeout(() => checkRamUsage(), 10000)
    setInterval(() => checkRamUsage(), 600000)
}

async function checkRamUsage() {
    const ram = await requestMain(Main.CHECK_RAM_USAGE)
    if (ram.performanceMode ? ram.performanceMode !== get(special).optimizedMode : get(special).optimizedMode) special.set({ ...get(special), optimizedMode: ram.performanceMode })
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
        { providerId: "planningcenter" as ContentProviderId, scope: "services" },
        { providerId: "churchApps" as ContentProviderId, scope: "plans", data: { shows: get(shows), categories: get(contentProviderData).churchApps?.syncCategories || [] } },
        { providerId: "amazinglife" as ContentProviderId, scope: "openid profile email" }
    ]

    providers.forEach(({ providerId, scope, data }) => {
        const cloudOnly = providerId === "churchApps" && get(special).churchAppsCloudOnly
        sendMain(Main.PROVIDER_STARTUP_LOAD, { providerId, scope, data, cloudOnly })
    })

    setTimeout(() => {
        const hasDriveSync = typeof get(driveKeys) === "object" && Object.keys(get(driveKeys)).length
        if (!Object.keys(get(providerConnections)).length && !get(activePopup) && Math.random() < (hasDriveSync ? 0.5 : 0.2)) {
            alertMessage.set("You can now set up free cloud sync with ChurchApps! Go to Settings>Files to log in." + (hasDriveSync ? "<br>It's recommended to switch over from your current Google Sync!" : ""))
            activePopup.set("alert")
        }
    }, 2000)
}

function getMainData() {
    requestMainMultiple({
        [Main.VERSION]: (a) => version.set(a),
        [Main.IS_DEV]: (a) => isDev.set(a),
        [Main.GET_OS]: (a) => os.set(a),
        [Main.GET_CACHE_PATH]: (a) => cachePath.set(a),
        [Main.DEVICE_ID]: (a) => deviceId.set(a),
        [Main.MAXIMIZED]: (a) => windowState.set({ ...windowState, maximized: a })
    })
}

async function getStoredData() {
    sendMainMultiple([Main.SYNCED_SETTINGS, Main.STAGE, Main.PROJECTS, Main.OVERLAYS, Main.TEMPLATES, Main.EVENTS, Main.MEDIA, Main.THEMES, Main.DRIVE_API_KEY, Main.HISTORY, Main.CACHE, Main.USAGE])

    await waitUntilValueIsDefined(() => get(loadedState).includes("synced_settings"), 200, 8000)
    sendMain(Main.SETTINGS)

    // LOAD SHOWS FROM FOLDER
    sendMain(Main.SHOWS)

    getDefaultElements()
}

async function startupOutput() {
    setLanguage() // this is only needed for the context menu (and stage display)
    receive(OUTPUT, receiveOUTPUTasOUTPUT)

    // wait a bit on slow computers
    await wait(200)

    send(OUTPUT, ["REQUEST_DATA_MAIN"])
}
