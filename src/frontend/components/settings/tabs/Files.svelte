<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import type { ContentProviderId } from "../../../../electron/contentProviders/base/types"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activePopup, autosave, cloudSyncData, dataPath, driveData, driveKeys, providerConnections, saved, special, statusIndicator } from "../../../stores"
    import { changeTeam, setupCloudSync } from "../../../utils/cloudSync"
    import { previousAutosave, startAutosave, wait } from "../../../utils/common"
    import { validateKeys } from "../../../utils/drive"
    import { translateText } from "../../../utils/language"
    import { save } from "../../../utils/save"
    import { convertAutosave } from "../../../values/autosave"
    import T from "../../helpers/T.svelte"
    import { getTimeFromInterval, joinTimeBig } from "../../helpers/time"
    import InputRow from "../../input/InputRow.svelte"
    import Title from "../../input/Title.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialMediaPicker from "../../inputs/MaterialFilePicker.svelte"
    import MaterialFolderPicker from "../../inputs/MaterialFolderPicker.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    function updateSpecial(value, key) {
        special.update((a) => {
            if (!value) delete a[key]
            else a[key] = value

            return a
        })
    }

    const autosaveList = [
        { value: "never", label: translateText("settings.never") },
        { value: "2min", label: translateText("2 settings.minutes") },
        { value: "5min", label: translateText("5 settings.minutes") },
        { value: "10min", label: translateText("10 settings.minutes") },
        { value: "15min", label: translateText("15 settings.minutes") },
        { value: "30min", label: translateText("30 settings.minutes") }
    ]

    // NOTE: monthly is misspelled as "mothly"
    const autobackupList = [
        { value: "never", label: translateText("settings.never") },
        { value: "daily", label: translateText("interval.daily") },
        { value: "weekly", label: translateText("interval.weekly") },
        { value: "mothly", label: translateText("interval.mothly") }
    ]

    // RESET

    // function reset() {
    //     const customLocation = !!$special.customUserDataLocation
    //     if (customLocation) save(false, { backup: true, isAutoBackup: true })

    //     autosave.set("15min")
    //     special.update((a) => {
    //         delete a.autoBackup
    //         delete a.customUserDataLocation
    //         return a
    //     })

    //     requestMain(Main.DATA_PATH, undefined, (path) => {
    //         dataPath.set(path)
    //     })
    // }

    let mediaFolderPath = ""
    async function updateMediaFolderPath(e: any) {
        mediaFolderPath = e.detail || ""
        sendMain(Main.SET_MEDIA_FOLDER_PATH, mediaFolderPath)

        // get default path again if reset
        if (!mediaFolderPath) mediaFolderPath = await requestMain(Main.GET_MEDIA_FOLDER_PATH)
    }

    // get times
    let nextAutosave = 0
    let nextAutobackup = 0

    let updater: NodeJS.Timeout | null = null
    onMount(async () => {
        checkTimes()
        updater = setInterval(checkTimes, 1000)

        if ($special.cloudSyncMediaFolder) mediaFolderPath = await requestMain(Main.GET_MEDIA_FOLDER_PATH)
    })
    onDestroy(() => {
        if (updater) clearInterval(updater)
    })
    function checkTimes() {
        const now = Date.now()

        // autosave
        const as = $autosave || "15min"
        if (previousAutosave && as !== "never") {
            const saveInterval = convertAutosave[as]
            nextAutosave = now - previousAutosave - saveInterval
        } else {
            nextAutosave = 0
        }

        // auto backup
        const interval = $special.autoBackup || "weekly"
        if (interval === "never" || $activePopup === "initialize") {
            nextAutobackup = 0
            return
        }
        if (nextAutobackup < 0) return
        const lastBackup = $special.autoBackupPrevious || 0
        const minTimeToBackup = getTimeFromInterval(interval)
        nextAutobackup = minTimeToBackup - (now - lastBackup)
        if (nextAutobackup < 0) nextAutobackup = -1
    }

    // CLOUD

    async function receiveKeysFile(e: any) {
        const path = e.detail
        if (!path) {
            driveKeys.set({})
            driveData.set({ mainFolderId: null, disabled: false, initializeMethod: null, disableUpload: false })
            return
        }

        const contents = (await requestMain(Main.READ_FILE, { path })).content
        if (contents) validateKeys(contents)
    }

    $: validKeys = typeof $driveKeys === "object" && Object.keys($driveKeys).length

    function updateValue(e: any, key: string) {
        let value = e?.target?.value ?? e
        if (key === "mediaId" && !value) value = "default"
        if (!value) return

        // mainFolderId: It seems the character length is 33 for drive folders and 44 for files.
        driveData.update((a) => {
            a[key] = value
            return a
        })
    }

    function toggleData(checked: boolean, key, invert = false) {
        driveData.update((a) => {
            a[key] = invert ? !checked : checked
            return a
        })
    }

    function updateAutosave(e) {
        autosave.set(e.detail)
        startAutosave()
    }

    const infoStyle = "color: var(--text);opacity: 0.5;font-weight: normal;font-size: 0.8em;margin-left: 10px;"
    $: autosaveInfo = nextAutosave ? `<span style="${infoStyle}">${joinTimeBig(nextAutosave / 1000)}<span>` : ""
    $: autoBackupInfo = nextAutobackup ? `<span style="${infoStyle}">${joinTimeBig(nextAutobackup < 0 ? 0 : nextAutobackup / 1000)}<span>` : ""
    $: autoBackup = $special.autoBackup || "weekly"

    async function updateDataPath(e: any) {
        if (!$saved) {
            // save files first and backup just in case
            save(false, { backup: true, isAutoBackup: true })
            await wait(1500)
        }

        const oldPath = $dataPath
        const newPath = e.detail

        sendMain(Main.UPDATE_DATA_PATH, { newPath, oldPath })
        dataPath.set(newPath)

        sendMain(Main.REFRESH_SHOWS)
    }

    // CLOUD

    function updateCloudData(key: string, value: any) {
        cloudSyncData.update((a) => {
            a[key] = value
            return a
        })
    }

    function contentProviderConnect(providerId: ContentProviderId) {
        if (!$providerConnections[providerId]) {
            special.update((a) => {
                a.churchAppsCloudOnly = true
                return a
            })

            sendMain(Main.PROVIDER_LOAD_SERVICES, { providerId, cloudOnly: true })
        } else {
            requestMain(Main.PROVIDER_DISCONNECT, { providerId }, (a) => {
                if (!a.success) return
                providerConnections.update((c) => {
                    c[providerId] = false
                    return c
                })
            })
        }
    }

    let resetValue = 0
    $: if ($activePopup) resetValue++
    function toggleSync(e) {
        const enabled = e.detail
        if (enabled) {
            setupCloudSync()
        } else {
            updateCloudData("enabled", false)
        }
    }

    function syncNow() {
        saved.set(false)
        save(false, { autosave: true })
    }

    // function deleteCloudData() {
    //     console.log(1)
    // }

    let bundled = false
    async function toggleMediaFolder(e: any) {
        updateSpecial(e.detail, "cloudSyncMediaFolder")

        if (e.detail) {
            if (bundled) return
            bundled = true

            // alertMessage.set("media.media_sync_folder_tip")
            // activePopup.set("alert")

            sendMain(Main.BUNDLE_MEDIA_FILES, { openFolder: true })
            mediaFolderPath = await requestMain(Main.GET_MEDIA_FOLDER_PATH)
        }
    }
</script>

<MaterialDropdown label="settings.autosave{autosaveInfo}" value={$autosave} defaultValue="15min" options={autosaveList} on:change={updateAutosave} />
<MaterialDropdown label="settings.auto_backup{autoBackupInfo}" value={autoBackup} defaultValue="weekly" options={autobackupList} on:change={(e) => updateSpecial(e.detail, "autoBackup")} />

<MaterialFolderPicker label="settings.data_location" value={$dataPath} on:change={updateDataPath} />

<!-- DEPRECATED -->
<!-- shows path should be a "Shows" folder inside of "Data location" -->
<!-- {#if !$showsPath?.includes($dataPath) || !$showsPath?.includes("Shows")} -->
<!-- <MaterialFolderPicker label="settings.show_location" value={$showsPath || ""} on:change={(e) => showsPath.set(e.detail)} /> -->
<!-- {/if} -->
<!-- {#key refreshInput}
    <MaterialToggleSwitch label="settings.user_data_location" disabled={!$dataPath} checked={$special.customUserDataLocation || false} defaultValue={false} on:change={(e) => toggle(e.detail, "customUserDataLocation")} />
{/key} -->

<!-- Enable without cloud sync? (People with existing custom media management/drives should know to not enable this) -->
<!-- <MaterialToggleSwitch label="media.media_sync_folder" title="media.media_sync_folder_tip" style="width: 100%;" checked={$special.cloudSyncMediaFolder} on:change={mediaFolder} /> -->

<!-- cloud -->
<Title label="settings.cloud" icon="cloud" title="cloud.info" />

{#if !$providerConnections.churchApps}
    <InputRow>
        <MaterialButton on:click={() => contentProviderConnect("churchApps")} style="flex: 1;" icon="login">
            <T id="settings.connect_to" replace={["ChurchApps"]} />
        </MaterialButton>
    </InputRow>
{:else}
    <InputRow>
        <MaterialButton on:click={() => contentProviderConnect("churchApps")} style="flex: 1;border-bottom: 2px solid var(--connected) !important;" icon="logout">
            <T id="settings.disconnect_from" replace={["ChurchApps"]} />
        </MaterialButton>
        {#if $cloudSyncData.enabled}
            <MaterialButton icon="cloud_sync" disabled={$statusIndicator === "syncing"} on:click={syncNow}>
                <T id="cloud.sync" />
            </MaterialButton>
        {/if}
    </InputRow>

    <InputRow arrow={$cloudSyncData.enabled}>
        <InputRow style="flex: 1;">
            {#key resetValue}
                <MaterialToggleSwitch label="Enable sync" data={$cloudSyncData?.team?.name} checked={$cloudSyncData.enabled} style="flex: 1;" on:change={toggleSync} />
            {/key}

            {#if $cloudSyncData.enabled && ($cloudSyncData.team?.count || 0) > 1}
                <MaterialButton variant="outlined" icon="people" on:click={changeTeam}><T id="cloud.change_team" /></MaterialButton>
            {/if}
        </InputRow>

        <svelte:fragment slot="menu">
            <MaterialTextInput label="inputs.name" value={$cloudSyncData.deviceName || ""} on:change={(e) => updateCloudData("deviceName", e.detail)} />

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
        </svelte:fragment>
    </InputRow>
{/if}

<!-- DEPRECATED: -->

{#if validKeys}
    <MaterialMediaPicker label="Google API service account key" title="Import keys file" value="Update keys file" filter={{ name: "Key file", extensions: ["json"] }} icon="key" on:change={receiveKeysFile} allowEmpty />
    <MaterialToggleSwitch label="Disable uploading data" checked={$driveData.disableUpload} defaultValue={false} on:change={(e) => toggleData(e.detail, "disableUpload")} />

    <MaterialToggleSwitch label="cloud.enable" checked={!$driveData.disabled} defaultValue={true} on:change={(e) => toggleData(e.detail, "disabled", true)} />
    <MaterialTextInput label="Set main folder manually{$driveData?.mainFolderId ? `<span style="margin-left: 10px;font-size: 0.7em;opacity: 0.5;color: var(--text);">drive.google.com/drive/folders/</span>` : ''}" value={$driveData?.mainFolderId || ""} on:change={(e) => updateValue(e.detail, "mainFolderId")} />
{/if}
