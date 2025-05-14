<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activePopup, autosave, dataPath, dictionary, driveData, driveKeys, showsCache, showsPath, special } from "../../../stores"
    import { syncDrive } from "../../../utils/drive"
    import { save } from "../../../utils/save"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import FolderPicker from "../../inputs/FolderPicker.svelte"
    import Link from "../../inputs/Link.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import { getTimeFromInterval, joinTimeBig } from "../../helpers/time"
    import { previousAutosave } from "../../../utils/common"
    import { convertAutosave } from "../../../values/autosave"

    function updateSpecial(value, key) {
        special.update((a) => {
            if (!value) delete a[key]
            else a[key] = value

            return a
        })
    }

    async function toggle(e: any, key: string) {
        let checked = e.target.checked

        if (key === "customUserDataLocation") {
            let existingData = false
            if (checked) {
                existingData = (await requestMain(Main.DOES_PATH_EXIST, { path: "data_config", dataPath: $dataPath }))?.exists
                if (existingData) activePopup.set("user_data_overwrite")
            }
            if (!existingData) {
                updateSpecial(checked, key)
                save(false, { backup: true, isAutoBackup: true, changeUserData: { reset: !checked, dataPath: $dataPath } })
            }
        } else {
            updateSpecial(checked, key)
        }
    }

    const autosaveList = [
        { id: "never", name: "$:settings.never:$" },
        { id: "2min", name: "2 $:settings.minutes:$" },
        { id: "5min", name: "5 $:settings.minutes:$" },
        { id: "10min", name: "10 $:settings.minutes:$" },
        { id: "15min", name: "15 $:settings.minutes:$" },
        { id: "30min", name: "30 $:settings.minutes:$" }
    ]

    const autobackupList = [
        { id: "never", name: "$:settings.never:$" },
        { id: "daily", name: "$:interval.daily:$" },
        { id: "weekly", name: "$:interval.weekly:$" },
        { id: "mothly", name: "$:interval.mothly:$" }
    ]

    // backup
    function backup() {
        save(false, { backup: true })
    }

    function restore() {
        if (!$showsPath) return

        showsCache.set({})
        sendMain(Main.RESTORE, { showsPath: $showsPath })
    }

    // RESET

    // function reset() {
    //     const customLocation = !!$special.customUserDataLocation
    //     if (customLocation) save(false, { backup: true, isAutoBackup: true })

    //     autosave.set("never")
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
        if (previousAutosave && ($autosave || "never") !== "never") {
            const saveInterval = convertAutosave[$autosave]
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

    function getKeysFile() {
        // activePopup.set("cloud_update")
        sendMain(Main.OPEN_FILE, { channel: "GOOGLE_KEYS", id: "keys", title: "Select keys file", filter: { name: "JSON", extensions: ["json"] }, multiple: false, read: true })
    }

    $: validKeys = typeof $driveKeys === "object" && Object.keys($driveKeys).length

    function updateValue(e: any, key: string) {
        let value = e.target.value
        if (key === "mediaId" && !value) value = "default"
        if (!value) return

        // mainFolderId: It seems the character length is 33 for drive folders and 44 for files.
        driveData.update((a) => {
            a[key] = value
            return a
        })
    }

    function toggleData(e: any, key, invert = false) {
        let checked: boolean = e.target.checked || false

        driveData.update((a) => {
            a[key] = invert ? !checked : checked
            return a
        })
    }

    function resetCloud() {
        driveKeys.set({})
        driveData.set({ mainFolderId: null, disabled: false, initializeMethod: null, disableUpload: false })
    }
</script>

<CombinedInput>
    <p><T id="settings.autosave" /><span style="opacity: 0.6;display: flex;align-items: center;padding-left: 10px;font-size: 0.8em;">{nextAutosave ? `(${joinTimeBig(nextAutosave / 1000)})` : ""}</span></p>
    <Dropdown options={autosaveList} value={autosaveList.find((a) => a.id === ($autosave || "never"))?.name || ""} on:click={(e) => autosave.set(e.detail.id)} />
</CombinedInput>

<CombinedInput style="border-bottom: 3px solid var(--primary-lighter);">
    <p><T id="settings.auto_backup" /><span style="opacity: 0.6;display: flex;align-items: center;padding-left: 10px;font-size: 0.8em;">{nextAutobackup ? `(${joinTimeBig(nextAutobackup < 0 ? 0 : nextAutobackup / 1000)})` : ""}</span></p>
    <Dropdown options={autobackupList} value={autobackupList.find((a) => a.id === ($special.autoBackup || "weekly"))?.name || ""} on:click={(e) => updateSpecial(e.detail.id, "autoBackup")} />
</CombinedInput>

<CombinedInput textWidth={30}>
    <p><T id="settings.data_location" /></p>
    <span class="path" title={$dataPath || ""}>
        <FolderPicker style="width: 100%;" id="DATA" center={false} path={$dataPath}>
            <Icon id="folder" style="margin-inline-start: 0.5em;" right />
            <p>
                {#if $dataPath}
                    {$dataPath}
                {:else}
                    <T id="inputs.change_folder" />
                {/if}
            </p>
        </FolderPicker>
        <Button title={$dictionary.main?.system_open} on:click={() => sendMain(Main.SYSTEM_OPEN, $dataPath)}>
            <Icon id="launch" white />
        </Button>
    </span>
</CombinedInput>

<CombinedInput textWidth={30}>
    <p><T id="settings.show_location" /></p>
    <span class="path" title={$showsPath || ""}>
        <!-- <p style="font-size: 0.9em;opacity: 0.7;">{$showsPath}</p> -->
        <!-- title={$dictionary.inputs?.change_folder} -->
        <FolderPicker style="width: 100%;" id="SHOWS" center={false} path={$showsPath || ""}>
            <Icon id="folder" style="margin-inline-start: 0.5em;" right />
            <p>
                {#if $showsPath}
                    {$showsPath}
                {:else}
                    <T id="inputs.change_folder" />
                {/if}
            </p>
        </FolderPicker>
        <Button
            title={$dictionary.main?.system_open}
            on:click={() => {
                if ($showsPath) sendMain(Main.SYSTEM_OPEN, $showsPath)
            }}
        >
            <Icon id="launch" white />
        </Button>
    </span>
</CombinedInput>

<CombinedInput>
    <p><T id="settings.user_data_location" /></p>
    <div class="alignRight">
        <Checkbox disabled={!$dataPath} checked={$special.customUserDataLocation || false} on:change={(e) => toggle(e, "customUserDataLocation")} />
    </div>
</CombinedInput>

<h3 title={$dictionary.cloud?.info}>
    <Icon id="cloud" white />
    <T id="settings.cloud" />
</h3>

<CombinedInput>
    <p><T id="cloud.google_drive_api" /></p>
    <Button on:click={getKeysFile}>
        <Icon id="key" style="margin-inline-start: 0.5em;" right />
        <p>
            {#if validKeys}
                <T id="cloud.update_key" />
            {:else}
                <T id="cloud.select_key" />
            {/if}
        </p>
    </Button>
    {#if validKeys}
        <Button title={$dictionary.actions?.remove} on:click={resetCloud} redHover>
            <Icon id="close" size={1.2} white />
        </Button>
    {/if}
</CombinedInput>

<CombinedInput>
    <p><T id="cloud.disable_upload" /></p>
    <div class="alignRight">
        <Checkbox checked={$driveData.disableUpload} on:change={(e) => toggleData(e, "disableUpload")} />
    </div>
</CombinedInput>

{#if validKeys}
    <CombinedInput>
        <p><T id="cloud.enable" /></p>
        <div class="alignRight">
            <Checkbox checked={!$driveData.disabled} on:change={(e) => toggleData(e, "disabled", true)} />
        </div>
    </CombinedInput>

    <CombinedInput>
        <p>
            <T id="cloud.media_id" />
        </p>
        <TextInput style="z-index: 1;" value={$driveData?.mediaId || "default"} on:change={(e) => updateValue(e, "mediaId")} />
    </CombinedInput>

    <CombinedInput>
        <p>
            <T id="cloud.main_folder" />
            <span style="font-size: 0.7em;opacity: 0.7;display: flex;align-items: center;justify-content: end;overflow: hidden;">drive.google.com/drive/folders/</span>
        </p>
        <TextInput style="z-index: 1;" value={$driveData?.mainFolderId || ""} on:change={(e) => updateValue(e, "mainFolderId")} />
    </CombinedInput>
    <!-- TODO: media folder -->
    <!-- <div>
        <p><T id="cloud.media_folder" /></p>
        <span style="display: flex;align-items: center;overflow: auto;">
            <p style="font-size: 0.9em;opacity: 0.7;">drive.google.com/drive/folders/</p>
            <TextInput style="width: 300px;padding: 3px;border-bottom: 2px solid var(--secondary);background-color: var(--primary-darkest);" value={$driveData?.mediaFolderId || ""} on:change={updateMediaFolder} />
        </span>
    </div> -->

    <CombinedInput>
        <Button
            on:click={() => {
                save()
                setTimeout(() => syncDrive(true), 2000)
            }}
            disabled={!validKeys}
            style="width: 100%;"
            center
        >
            <Icon id="cloud_sync" right />
            <T id="cloud.sync" />
        </Button>
    </CombinedInput>
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

<div class="filler" />
<div class="bottom" style="font-size: 1.2em;">
    <!-- <Button style="width: 100%;" on:click={reset} center>
        <Icon id="reset" right />
        <T id="actions.reset" />
    </Button> -->
    <CombinedInput style="background-color: initial;border-bottom: 0;">
        <Button style="width: 50%;padding: 8px !important;" on:click={backup} center>
            <span style="display: flex;align-items: center;">
                <Icon id="export" style="margin-inline-start: 0.5em;" size={1.3} right />
                <p><T id="settings.backup_all" /></p>
            </span>
        </Button>
        <Button style="padding: 8px !important;" on:click={restore} center>
            <span style="display: flex;align-items: center;">
                <Icon id="import" style="margin-inline-start: 0.5em;" size={1.3} right />
                <p><T id="settings.restore" /></p>
            </span>
        </Button>
    </CombinedInput>
</div>

<style>
    h3 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;

        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
    }

    .path {
        display: flex;
        align-items: center;
        max-width: 70%;
    }
    .path :global(button) {
        white-space: nowrap;
    }

    /* cloud */

    .guide p {
        white-space: normal;
        /* font-style: italic; */
        opacity: 0.8;
    }

    /* bottom */

    .filler {
        height: 80px;
    }
    .bottom {
        position: absolute;
        bottom: 0;
        inset-inline-start: 0;
        width: 100%;
        background-color: var(--primary-darkest);

        display: flex;
        flex-direction: column;
    }
</style>
