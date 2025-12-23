import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"
import { activePopup, alertMessage, cloudSyncData, popupData } from "../stores"
import { confirmCustom } from "./popup"

export async function setupCloudSync() {
    if (get(cloudSyncData).id) return
    if (!(await requestMain(Main.CAN_SYNC))) return

    const teams = await requestMain(Main.GET_TEAMS)
    if (!teams.length) {
        alertMessage.set("You can setup cloud sync with ChurchApps, but no teams were found in your account. Add in Serving>Plans>Ministries>Teams!")
        activePopup.set("alert")
        return
    }

    if (!(await confirmCustom("You can sync your data with FreeShow Cloud! Do you want to enable cloud sync now?"))) return

    if (teams.length === 1) {
        chooseTeam({ id: teams[0].id, churchId: teams[0].churchId, name: teams[0].name })
        return
    }

    const teamsOptions = teams.map((a) => ({ id: a.id, churchId: a.churchId, name: a.name, icon: "people" }))
    popupData.set({ type: "choose_team", teams: teamsOptions })
    activePopup.set("cloud_sync")
}

export function chooseTeam(team: { id: string; churchId: string; name: string }) {
    cloudSyncData.update((a) => {
        a = { ...a, id: "churchApps", enabled: true, team }
        return a
    })

    // WIP take backup

    syncWithCloud()
}

export async function syncWithCloud() {
    const data = get(cloudSyncData)
    if (!data.enabled || !data.id || !data.team) return

    // save ??

    const status = await requestMain(Main.CLOUD_SYNC, { id: data.id as any, churchId: data.team.churchId, teamId: data.team.id })
    console.log(status)
}
