import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { sendMain } from "../IPC/main"
import { activePopup, contentProviderData, saved } from "../stores"

// After connecting, nothing is synced until the user has chosen how songs should be synced.
// The pending state is saved, so closing the popup or the app can't start a sync in the wrong mode.

export function isPcoSyncModePending() {
    return !!get(contentProviderData).planningcenter?.syncModePending
}

export function connectPlanningCenter() {
    updatePcoSettings({ syncModePending: true })
    sendMain(Main.PROVIDER_LOAD_SERVICES, { providerId: "planningcenter", connectScope: "services" })
}

/** asks for the sync mode if none has been chosen since connecting */
export function promptPcoSyncMode() {
    if (!isPcoSyncModePending()) return false

    activePopup.set("pco_sync_mode")
    return true
}

export function startFirstPcoSync(songOrigin: string) {
    updatePcoSettings({ songOrigin, syncModePending: false })
    activePopup.set(null)

    const syncFolderIds = get(contentProviderData).planningcenter?.syncFolderIds || []
    sendMain(Main.PROVIDER_LOAD_SERVICES, { providerId: "planningcenter", data: { syncFolderIds, songOrigin } })
}

function updatePcoSettings(settings: { [key: string]: any }) {
    contentProviderData.update((a) => ({ ...a, planningcenter: { ...a.planningcenter, ...settings } }))
    saved.set(false)
}
