import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { isLocalFile } from "../components/helpers/media"
import { loadShows } from "../components/helpers/setShow"
import { requestMain, sendMain } from "../IPC/main"
import { activeEdit, activePage, activePopup, activeShow, alertMessage, cloudSyncData, cloudUsers, deletedShows, popupData, providerConnections, renamedShows, saved, scripturesCache, shows, showsCache, special } from "../stores"
import { isMainWindow, newToast, setStatus } from "./common"
import { confirmCustom } from "./popup"
import { save } from "./save"
import { SocketHelper } from "./SocketHelper"

export async function setupCloudSync(auto: boolean = false) {
    if (auto && get(cloudSyncData).id) {
        syncWithCloud()
        return
    }
    if (!(await requestMain(Main.CAN_SYNC))) return

    const teams = await requestMain(Main.GET_TEAMS)
    if (!teams.length) {
        const addTeam = "Get added to a team, or create one in B1.church>Serving>Plans>Ministry>Teams!"
        alertMessage.set(auto ? "You can setup cloud sync with ChurchApps, but no teams were found in your account. " + addTeam : "No teams were found in your account. " + addTeam)
        activePopup.set("alert")
        return
    }

    if (auto && !(await confirmCustom("You can sync your data with FreeShow Cloud! Do you want to enable cloud sync now?"))) return

    if (teams.length === 1) {
        chooseTeam({ id: teams[0].id, churchId: teams[0].churchId, name: teams[0].name, count: 1 })
        return
    }

    const teamsOptions = teams.map((a) => ({ id: a.id, churchId: a.churchId, name: a.name, icon: "people" }))
    popupData.set({ type: "choose_team", teams: teamsOptions })
    activePopup.set("cloud_sync")
}

export async function changeTeam() {
    const teams = await requestMain(Main.GET_TEAMS)
    const currentTeam = get(cloudSyncData).enabled ? get(cloudSyncData).team?.id : ""
    const teamsOptions = teams.map((a) => ({ id: a.id, churchId: a.churchId, name: a.name, icon: "people", disabled: a.id === currentTeam }))

    popupData.set({ type: "choose_team", teams: teamsOptions })
    activePopup.set("cloud_sync")
}

export async function chooseTeam(team: { id: string; churchId: string; name: string; count?: number }) {
    const id = "churchApps"
    const deviceName = get(cloudSyncData).deviceName || (await requestMain(Main.GET_DEVICE_NAME))

    socketDisconnect()

    cloudSyncData.update((a) => {
        a = { ...a, id, enabled: true, deviceName, team }
        return a
    })

    const existingData = await requestMain(Main.CLOUD_DATA, { id, churchId: team.churchId, teamId: team.id })
    if (existingData) {
        // ensure previous popup is closed first to prevent Svelte bug "locking" popup
        setTimeout(() => activePopup.set("cloud_method"), 250)
        return
    }

    syncWithCloud(true)
}

let isSyncing = false
// let lastSync = 0
export async function syncWithCloud(initialize: boolean = false) {
    if (!get(providerConnections).churchApps) return false

    if (isSyncing) return false
    // skip if synced less than half a minute ago
    // if (!initialize && Date.now() - lastSync < 30000) return false

    const data = get(cloudSyncData)
    if (!data.enabled || !data.id || !data.team) return false

    const method = data.cloudMethod || "merge"

    if (initialize) {
        // save & backup
        save(false, { autosave: true, backup: true, isAutoBackup: true, backupShows: true })
        return false
    }

    if (method === "replace") {
        // reset cached data
        showsCache.set({})
        scripturesCache.set({})
        deletedShows.set([])
        renamedShows.set([])
        activeShow.set(null)
        activeEdit.set({ items: [] })
    }

    socketConnect()

    isSyncing = true
    setStatus("syncing")

    const timeout = 5 * 60 * 1000 // 5 minutes
    const status = await requestMain(Main.CLOUD_SYNC, { id: data.id as any, churchId: data.team.churchId, teamId: data.team.id, method }, () => {}, timeout)

    isSyncing = false

    // set back to merge
    if (method === "replace" || method === "upload") {
        cloudSyncData.update((a) => {
            a.cloudMethod = "merge"
            return a
        })
    }

    if (!status.success) {
        newToast("Error: " + (status.error || "Sync failed"))
        setStatus("error", 1)
        return false
    }

    setStatus("synced", 3)

    // reset cached shows as they might have changed
    const allShowIds = Object.keys(get(shows))
    const syncedShowIds = Object.keys(get(showsCache)).filter((id) => allShowIds.includes(id))
    showsCache.update((a) => {
        // only delete shows that were synced, so any shows created while syncing don't get deleted
        syncedShowIds.forEach((id) => {
            delete a[id]
        })
        return a
    })

    // reload current show
    const currentlyActive = get(activeShow)?.id || ""
    if (get(shows)[currentlyActive]) loadShows([currentlyActive])

    // set status back to saved
    setTimeout(() => saved.set(true), 100)

    // console.log(status.changedFiles)

    // lastSync = Date.now()
    return true
}

// copy media files to one media sync folder for easy syncing
export function addToMediaFolder(filePath: string) {
    // ensure it's a valid local file path
    if (!isLocalFile(filePath)) return
    if (filePath.includes("freeshow-cache") || filePath.includes("media-cache")) return
    if (!isMainWindow()) return

    if (!get(special).cloudSyncMediaFolder) return
    sendMain(Main.MEDIA_FOLDER_COPY, { paths: [filePath] })
}

// SOCKET

let cloudSocketHelper: SocketHelper | null = null
let cachedConversationId: string | null = null

function getCloudSocket() { return cloudSocketHelper}

async function createCloudSocket(): Promise<SocketHelper | null> {
    if (cloudSocketHelper) return cloudSocketHelper

    const team = get(cloudSyncData).team
    if (!team) return null

    const name = get(cloudSyncData).deviceName || ""
    if (!cachedConversationId) cachedConversationId = await requestMain(Main.GET_CONVERSATION_ID, { teamId: team.id })

    try {
        cloudSocketHelper = new SocketHelper({ churchId: team.churchId, teamId: team.id, displayName: name, conversationId: cachedConversationId || undefined })
        return cloudSocketHelper
    } catch (err) {
        console.error("Failed to create cloud socket:", err)
        return null
    }
}

function socketDisconnect() {
    if (!cloudSocketHelper) return
    const socket = cloudSocketHelper

    clearStoreListeners()

    cloudSyncMessage("presence", { action: "bye" })

    // clear local reference immediately so new connections create a new socket
    cloudSocketHelper = null
    cachedConversationId = null
    cloudUsers.set([])

    // disconnect the actual socket instance after a delay
    setTimeout(() => {
        socket.disconnect()
    }, 1000)
}

async function socketConnect() {
    const socket = await createCloudSocket()
    if (!socket) return

    // initialize receivers
    socket.addHandler("presence", CLOUD_RECEIVERS.presence)

    // announce self and get responses from all users
    broadcastPresence("iamnew")

    // setup listeners
    setupStoreListeners()
}

let presenceUnsubscribers: (() => void)[] = []
function setupStoreListeners() {
    clearStoreListeners()
    presenceUnsubscribers.push(activePage.subscribe(() => broadcastPresence()))
    presenceUnsubscribers.push(activeShow.subscribe(() => broadcastPresence()))
}

function clearStoreListeners() {
    presenceUnsubscribers.forEach((u) => u())
    presenceUnsubscribers = []
}

function broadcastPresence(action: string = "update") {
    const page = get(activePage)
    const show = get(activeShow)

    cloudSyncMessage("presence", { action, activePage: page, activeShow: show })
}

export async function cloudSyncMessage(id: string = "", data: { [key: string]: any } = {}) {
    const socket = getCloudSocket() || (await createCloudSocket())
    if (!socket) return

    if (!(await socket.waitUntilConnected())) return

    socket.sendMessage(id, data)
}

// RECEIVERS

const CLOUD_RECEIVERS = {
    presence: (data: { socketId?: string; displayName?: string; action?: string; activePage?: string; activeShow?: string }) => {
        if (!data.socketId || !data.displayName) return

        const isBye = data.action === "bye"
        const isNewUser = data.action === "iamnew"
        const userData = { socketId: data.socketId, displayName: data.displayName, activePage: data.activePage, activeShow: data.activeShow }

        cloudUsers.update((users) => {
            const existingIndex = users.findIndex((u) => u.socketId === data.socketId)

            // remove user
            if (isBye) {
                if (existingIndex < 0) return users
                users.splice(existingIndex, 1)
                return users
            }

            // add/update user
            if (existingIndex < 0) return [...users, userData]
            users[existingIndex] = userData
            return users
        })

        if (isNewUser) broadcastPresence("iamhere")
    }
}
