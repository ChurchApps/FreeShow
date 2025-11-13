<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { activePopup, autosave, dataPath, driveData, driveKeys, showsPath, special } from "../../../stores"
    import { previousAutosave, startAutosave } from "../../../utils/common"
    import { syncDrive, validateKeys } from "../../../utils/drive"
    import { translateText } from "../../../utils/language"
    import { save } from "../../../utils/save"
    import { convertAutosave } from "../../../values/autosave"
    import T from "../../helpers/T.svelte"
    import { getTimeFromInterval, joinTimeBig } from "../../helpers/time"
    import Title from "../../input/Title.svelte"
    import Link from "../../inputs/Link.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialMediaPicker from "../../inputs/MaterialFilePicker.svelte"
    import MaterialFolderPicker from "../../inputs/MaterialFolderPicker.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import { confirmCustom } from "../../../utils/popup"

    function updateSpecial(value, key) {
        special.update((a) => {
            if (!value) delete a[key]
            else a[key] = value

            return a
        })
    }

    let refreshInput = 0
    async function toggle(checked: boolean, key: string) {
        if (key === "customUserDataLocation") {
            let existingData = false
            if (checked) {
                // Are you sure?
                if (!(await confirmCustom(translateText("settings.user_data_location_confirm")))) {
                    // revert toggle switch
                    refreshInput++
                    return
                }

                existingData = (await requestMain(Main.DOES_PATH_EXIST, { path: "data_config", dataPath: $dataPath }))?.exists
                if (existingData) activePopup.set("user_data_overwrite")
            }
            if (!existingData) {
                updateSpecial(checked, key)
                save(false, { backup: true, isAutoBackup: true, changeUserData: { reset: !checked, dataPath: $dataPath } })
            }

            return
        }

        updateSpecial(checked, key)
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
    //         if (customLocation) save(false, { changeUserData: { reset: true, dataPath: path } })
    //     })
    //     requestMain(Main.SHOWS_PATH, undefined, (path) => {
    //         showsPath.set(path)
    //         sendMain(Main.SHOWS, { showsPath: path })
    //     })
    // }

    // get times
    let nextAutosave = 0
    let nextAutobackup = 0

    let updater: NodeJS.Timeout | null = null
    onMount(() => {
        checkTimes()
        updater = setInterval(checkTimes, 1000)
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
</script>

<MaterialDropdown label="settings.autosave{autosaveInfo}" value={$autosave} defaultValue="15min" options={autosaveList} on:change={updateAutosave} />
<MaterialDropdown label="settings.auto_backup{autoBackupInfo}" value={autoBackup} defaultValue="weekly" options={autobackupList} on:change={(e) => updateSpecial(e.detail, "autoBackup")} />

<!-- changing the "Data loction" should also change "Shows" location if it's the correct path ? -->
<MaterialFolderPicker label="settings.data_location" value={$dataPath} on:change={(e) => dataPath.set(e.detail)} />
<!-- shows path should be a "Shows" folder inside of "Data location" -->
<!-- {#if !$showsPath?.includes($dataPath) || !$showsPath?.includes("Shows")} -->
<MaterialFolderPicker label="settings.show_location" value={$showsPath || ""} on:change={(e) => showsPath.set(e.detail)} />
<!-- {/if} -->

{#key refreshInput}
    <MaterialToggleSwitch label="settings.user_data_location" disabled={!$dataPath} checked={$special.customUserDataLocation || false} defaultValue={false} on:change={(e) => toggle(e.detail, "customUserDataLocation")} />
{/key}

<!-- cloud -->
<Title label="settings.cloud" icon="cloud" title="cloud.info" />

<MaterialMediaPicker label="cloud.google_drive_api" title="cloud.select_key" value={validKeys ? translateText("cloud.update_key") : ""} filter={{ name: "Key file", extensions: ["json"] }} icon="key" on:change={receiveKeysFile} allowEmpty />
<!-- better name: "Read only" -->
<MaterialToggleSwitch label="cloud.disable_upload" checked={$driveData.disableUpload} defaultValue={false} on:change={(e) => toggleData(e.detail, "disableUpload")} />

{#if validKeys}
    <MaterialToggleSwitch label="cloud.enable" checked={!$driveData.disabled} defaultValue={true} on:change={(e) => toggleData(e.detail, "disabled", true)} />
    <!-- <MaterialTextInput label="cloud.media_id" value={$driveData?.mediaId || "default"} defaultValue="default" on:change={(e) => updateValue(e.detail, "mediaId")} /> -->
    <MaterialTextInput
        label="cloud.main_folder{$driveData?.mainFolderId ? `<span style="margin-left: 10px;font-size: 0.7em;opacity: 0.5;color: var(--text);">drive.google.com/drive/folders/</span>` : ''}"
        value={$driveData?.mainFolderId || ""}
        on:change={(e) => updateValue(e.detail, "mainFolderId")}
    />

    <!-- TODO: media folder -->
    <!-- <div>
        <p><T id="cloud.media_folder" /></p>
        <span style="display: flex;align-items: center;overflow: auto;">
            <p style="font-size: 0.9em;opacity: 0.7;">drive.google.com/drive/folders/</p>
            <TextInput style="width: 300px;padding: 3px;border-bottom: 2px solid var(--secondary);background-color: var(--primary-darkest);" value={$driveData?.mediaFolderId || ""} on:change={updateMediaFolder} />
        </span>
    </div> -->

    <MaterialButton
        style="width: 100%;"
        icon="cloud_sync"
        title="Note: Shows and projects should sync both ways. Other elements like settings will be uploaded when using this. Enable auto sync for better syncing."
        on:click={() => {
            save()
            setTimeout(() => syncDrive(true), 2000)
        }}
    >
        <T id="cloud.sync" />
    </MaterialButton>

    <!-- Probably never used: -->
    <!-- <CombinedInput>
        <Button on:click={() => driveConnect($driveKeys)} disabled={!validKeys} style="width: 100%;" center>
            <Icon id="refresh" right />
            <T id="cloud.reconnect" />
        </Button>
    </CombinedInput> -->
{:else}
    <span class="guide" style="display: block;margin-top: 8px;">
        <!-- Keep in mind you have a 750 GB limit per day, and 20,000 queries per second which should be plenty. -->
        <p><T id="cloud.tip_api" /></p>
        <p><T id="cloud.tip_how" />&nbsp;<Link url={"https://freeshow.app/docs/drive"}><T id="cloud.tip_guide" /></Link></p>
    </span>
{/if}

<style>
    /* cloud */
    .guide p {
        white-space: normal;
        /* font-style: italic; */
        opacity: 0.6;
        font-size: 0.7em;
    }
</style>
