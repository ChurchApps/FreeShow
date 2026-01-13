import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"
import { activePopup, activeShow, alertMessage, cloudSyncData, popupData, providerConnections, shows, showsCache } from "../stores"
import { confirmCustom } from "./popup"
import { save } from "./save"
import { newToast } from "./common"
import { loadShows } from "../components/helpers/setShow"

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
        chooseTeam({ id: teams[0].id, churchId: teams[0].churchId, name: teams[0].name })
        return
    }

    const teamsOptions = teams.map((a) => ({ id: a.id, churchId: a.churchId, name: a.name, icon: "people" }))
    popupData.set({ type: "choose_team", teams: teamsOptions })
    activePopup.set("cloud_sync")
}

export async function chooseTeam(team: { id: string; churchId: string; name: string }) {
    const id = "churchApps"

    cloudSyncData.update((a) => {
        a = { ...a, id, enabled: true, team }
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

    newToast("cloud.syncing")

    isSyncing = true
    const timeout = 5 * 60 * 1000 // 5 minutes
    const status = await requestMain(Main.CLOUD_SYNC, { id: data.id as any, churchId: data.team.churchId, teamId: data.team.id, method }, () => {}, timeout)
    isSyncing = false

    if (!status.success) {
        newToast("Error: " + (status.error || "Sync failed"))
        return false
    }

    newToast("cloud.sync_complete")

    // reset cached shows as they might have changed
    showsCache.set({})

    // reload current show
    const currentlyActive = get(activeShow)?.id || ""
    if (get(shows)[currentlyActive]) loadShows([currentlyActive])

    // console.log(status.changedFiles)

    // lastSync = Date.now()
    return true
}
