import { get } from "svelte/store"
import { uid } from "uid"
import { CLOUD } from "../../types/Channels"
import type { DriveData } from "../../types/Main"
import { activePopup, driveData, driveKeys, popupData } from "../stores"
import { newToast } from "./common"
import { send } from "./request"
import { save } from "./save"

export function validateKeys(file: string) {
    const keys = JSON.parse(file)

    // check keys
    let error = ""
    if (!keys.client_id) error = "Invalid key file: Missing 'client_id'"
    else if (!keys.private_key) error = "Invalid key file: Missing 'private_key'"
    else if (!keys.project_id) error = "Invalid key file: Missing 'project_id'"

    if (error) {
        activePopup.set(null)
        newToast(error)
        return
    }

    // set media id
    driveData.update(a => {
        if (!a.mediaId || a.mediaId === "default") a.mediaId = uid(8)
        return a
    })

    driveKeys.set(keys)
    save()
}

export function driveConnect(keys: any) {
    if (typeof keys !== "object" || !Object.keys(keys).length) return

    // give time for the keys file to save
    setTimeout(() => {
        send(CLOUD, ["DRIVE_CONNECT"])
    }, 100)
}

// force = manual sync OR first sync
export function syncDrive(force = false, closeWhenFinished = false, startup = false) {
    const autoSyncDisabled = get(driveData).disabled === true
    const notStartingAndNotClosing = !startup && !closeWhenFinished
    if (!force && (notStartingAndNotClosing || autoSyncDisabled)) return

    let method = get(driveData).initializeMethod
    if (get(driveData).disableUpload) method = "download"
    send(CLOUD, ["SYNC_DATA"], { mainFolderId: get(driveData).mainFolderId, method, closeWhenFinished } as DriveData)

    if (force || closeWhenFinished) {
        popupData.set({})
        activePopup.set("cloud_update")
        return
    }

    newToast("cloud.syncing")
}
