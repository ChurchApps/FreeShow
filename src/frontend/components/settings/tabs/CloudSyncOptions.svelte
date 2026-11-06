<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activePopup, alertMessage, cloudSyncData, special, statusIndicator } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialFolderPicker from "../../inputs/MaterialFolderPicker.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    // options shared by all cloud sync providers

    function updateCloudData(key: string, value: any) {
        cloudSyncData.update((a) => {
            a[key] = value
            return a
        })
    }

    function updateSpecial(value, key) {
        special.update((a) => {
            if (!value) delete a[key]
            else a[key] = value

            return a
        })
    }

    let mediaFolderPath = ""
    onMount(async () => {
        if ($cloudSyncData.enabled && $special.cloudSyncMediaFolder) mediaFolderPath = (await requestMain(Main.GET_MEDIA_FOLDER_PATH)) || ""
    })

    async function updateMediaFolderPath(e: any) {
        mediaFolderPath = e.detail || ""
        sendMain(Main.SET_MEDIA_FOLDER_PATH, mediaFolderPath)

        // get default path again if reset
        if (!mediaFolderPath) mediaFolderPath = (await requestMain(Main.GET_MEDIA_FOLDER_PATH)) || ""
        else sendMain(Main.BUNDLE_MEDIA_FILES, { outputPath: mediaFolderPath })
    }

    let bundled = false
    async function toggleMediaFolder(e: any) {
        updateSpecial(e.detail, "cloudSyncMediaFolder")

        if (e.detail) {
            if (bundled) return
            bundled = true

            if (!mediaFolderPath) mediaFolderPath = (await requestMain(Main.GET_MEDIA_FOLDER_PATH)) || ""
            sendMain(Main.BUNDLE_MEDIA_FILES, { openFolder: true, outputPath: mediaFolderPath })
        }
    }

    async function restoreCloudBackupState() {
        const id = $cloudSyncData.id === "s3" ? "s3" : "churchApps"
        if (!$cloudSyncData.id || !$cloudSyncData.team?.churchId || !$cloudSyncData.team?.id) return

        const result = await requestMain(Main.RESTORE_CLOUD_BACKUP, { id, churchId: $cloudSyncData.team.churchId, teamId: $cloudSyncData.team.id })

        alertMessage.set(result?.success ? "Cloud backup restored." : result?.error || "Could not restore cloud backup.")
        activePopup.set("alert")
    }
</script>

<!-- changing team directly without toggling "Enable sync" off/on -->
<MaterialToggleSwitch label="cloud.read_only" title="cloud.readonly_tip" checked={$cloudSyncData.cloudMethod === "read_only"} defaultValue={false} on:change={(e) => updateCloudData("cloudMethod", e.detail ? "read_only" : "merge")} />

<!-- Documents/FreeShow/Media -->
<!-- This should only be needed if no custom media management is already existing -->
<!-- Custom drives should work without as long as the path location is the same -->
<!-- Files in this folder will automatically be checked to find missing files -->
<MaterialToggleSwitch label="media.media_sync_folder" title="media.media_sync_folder_tip" style="width: 100%;" checked={$special.cloudSyncMediaFolder} defaultValue={false} on:change={toggleMediaFolder} />

{#if $special.cloudSyncMediaFolder}
    <MaterialFolderPicker label="media.media_sync_folder" value={mediaFolderPath} on:change={updateMediaFolderPath} allowEmpty={!mediaFolderPath.endsWith("Documents\\FreeShow\\Media") && !mediaFolderPath.endsWith("Documents/FreeShow/Media")} />
{/if}

<!-- <MaterialButton variant="outlined" icon="delete" on:click={deleteCloudData} red white>Delete cloud data</MaterialButton> -->

<MaterialButton variant="outlined" icon="import" disabled={$statusIndicator === "syncing"} on:click={restoreCloudBackupState}>
    <p><T id="cloud.restore_weekly_backup" /></p>
</MaterialButton>
