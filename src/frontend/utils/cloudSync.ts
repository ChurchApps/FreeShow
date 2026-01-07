import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"
import { activePopup, alertMessage, cloudSyncData, popupData } from "../stores"
import { confirmCustom } from "./popup"
import { save } from "./save"
import { newToast } from "./common"

export async function setupCloudSync(auto: boolean = false) {
    if (auto && get(cloudSyncData).id) {
        syncWithCloud()
        return
    }
    if (!(await requestMain(Main.CAN_SYNC))) return

    const teams = await requestMain(Main.GET_TEAMS)
    if (!teams.length) {
        alertMessage.set("You can setup cloud sync with ChurchApps, but no teams were found in your account. Add in Serving>Plans>Ministries>Teams!")
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
    console.log("Existing data:", existingData)

    if (!existingData) {
        syncWithCloud(true)
        return
    }

    activePopup.set("cloud_method")
}

let isSyncing = false
export async function syncWithCloud(initialize: boolean = false) {
    if (isSyncing) return false

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
    const status = await requestMain(Main.CLOUD_SYNC, { id: data.id as any, churchId: data.team.churchId, teamId: data.team.id, method })
    isSyncing = false

    if (status.success) newToast("cloud.sync_complete")
    else newToast("Error: " + (status.error || "Sync failed"))

    // console.log(status.changedFiles)

    return true
}
