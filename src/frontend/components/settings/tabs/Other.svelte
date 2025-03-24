<script lang="ts">
    import { onMount } from "svelte"
    import { EXPORT } from "../../../../types/Channels"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activePage, activePopup, alertMessage, alertUpdates, dataPath, deletedShows, dictionary, popupData, shows, showsCache, showsPath, special, usageLog } from "../../../stores"
    import { send } from "../../../utils/request"
    import { save } from "../../../utils/save"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import FolderPicker from "../../inputs/FolderPicker.svelte"

    onMount(() => {
        // getCacheSize()
        // getAudioOutputs()
        if ($showsPath) sendMain(Main.FULL_SHOWS_LIST, { path: $showsPath })
        requestMain(Main.GET_STORE_VALUE, { file: "config", key: "disableHardwareAcceleration" }, (a) => {
            if (a.key === "disableHardwareAcceleration") disableHardwareAcceleration = a.value
        })
        if ($showsPath)
            requestMain(Main.GET_EMPTY_SHOWS, { path: $showsPath, cached: $showsCache }, (a) => {
                if (a) emptyShows = a
            })
        getDuplicatedShows()
    })

    // const previewRates = [
    //     { id: "auto", name: "$:settings.auto:$ (1|30 fps)" },
    //     { id: "optimized", name: "$:settings.optimized:$ (1 fps)" },
    //     { id: "reduced", name: "$:settings.reduced:$ (10 fps)" },
    //     { id: "full", name: "$:settings.full:$ (60 fps)" },
    // ]

    function updateSpecial(value, key) {
        special.update((a) => {
            if (!value && key !== "autoUpdates") delete a[key]
            else a[key] = value

            return a
        })

        // if (key === "previewRate") restartOutputs()
    }

    const isChecked = (e: any) => e.target.checked

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
                save(false, { backup: true, changeUserData: { reset: !checked, dataPath: $dataPath } })
            }
        } else {
            updateSpecial(checked, key)
        }
    }

    // hardware acceleration
    let disableHardwareAcceleration = true
    function toggleHardwareAcceleration(e: any) {
        disableHardwareAcceleration = e.target.checked
        sendMain(Main.SET_STORE_VALUE, { file: "config", key: "disableHardwareAcceleration", value: disableHardwareAcceleration })

        alertMessage.set("settings.restart_for_change")
        activePopup.set("alert")
    }

    // shows in folder
    let hiddenShows: string[] = []
    let brokenShows: number = 0

    $: if (hiddenShows?.length) getBrokenShows()
    function getBrokenShows() {
        brokenShows = 0

        Object.entries($shows).forEach(([id, { name }]) => {
            if (!hiddenShows.includes(name + ".show") && !hiddenShows.includes(id + ".show")) brokenShows++
        })
    }

    // get all shows inside current shows folder (and remove missing)
    // function refreshShows() {
    //     sendMain(Main.REFRESH_SHOWS, { path: $showsPath })

    //     setTimeout(() => {
    //         sendMain(Main.FULL_SHOWS_LIST, { path: $showsPath })
    //     }, 800)
    // }

    // delete shows from folder that are not indexed
    function deleteShows() {
        if (!$showsPath) return

        sendMain(Main.DELETE_SHOWS_NI, { shows: $shows, path: $showsPath })

        setTimeout(() => {
            // this will not include newly created shows not saved yet, but it should not be an issue.
            requestMain(Main.FULL_SHOWS_LIST, { path: $showsPath }, (data) => {
                hiddenShows = data || []
                let deletedShowNames = $deletedShows.map((a) => a.name + ".show")
                hiddenShows = hiddenShows.filter((name) => !deletedShowNames.includes(name))
            })
        }, 800)
    }

    let emptyShows: { id: string; name: string }[] = []
    function deleteEmptyShows() {
        if (!$showsPath) return

        sendMain(Main.DELETE_SHOWS, { shows: emptyShows, path: $showsPath })
        // emptyShows = []
        activePage.set("show")
    }

    let duplicatedShows: { ids: string[] }[] = []
    function getDuplicatedShows() {
        let names: { [key: string]: string[] } = {}
        Object.entries($shows).forEach(([id, show]) => {
            // remove any numbers (less than 4 chars) at the end of name (but not if "1-3"|"-5" in case of scripture)
            let trimmedName = show.name
                .toLowerCase()
                .replace(/(?<![-\d])\d{1,3}$/, "")
                .trim()
            if (!trimmedName.length) return

            if (names[trimmedName]) names[trimmedName].push(id)
            else names[trimmedName] = [id]
        })

        duplicatedShows = Object.values(names)
            .filter((a) => a.length > 1)
            .map((ids) => ({ ids }))
    }
    function deleteDuplicatedShows() {
        popupData.set({ id: "delete_duplicated_shows", data: duplicatedShows })
        activePopup.set("delete_duplicated_shows")
        // duplicatedShows = []
    }

    // delete media thumbnail cache
    // function deleteCache() {
    //     if (!Object.keys($mediaCache).length) {
    //         newToast("$toast.empty_cache")
    //         return
    //     }

    //     newToast("$toast.deleted_cache")
    //     mediaCache.set({})
    //     cacheSize = "0 Bytes"
    // }

    // open log
    function openLog() {
        sendMain(Main.OPEN_LOG)
    }
    function openCache() {
        sendMain(Main.OPEN_CACHE)
    }

    // bundle media files
    function bundleMediaFiles() {
        if (!$showsPath) return
        sendMain(Main.BUNDLE_MEDIA_FILES, { showsPath: $showsPath, dataPath: $dataPath })
    }

    // backup
    function backup() {
        save(false, { backup: true })
    }

    function restore() {
        if (!$showsPath) return

        showsCache.set({})
        sendMain(Main.RESTORE, { showsPath: $showsPath })
    }

    const autobackupList = [
        { id: "never", name: "$:settings.never:$" },
        { id: "daily", name: "$:interval.daily:$" },
        { id: "weekly", name: "$:interval.weekly:$" },
        { id: "mothly", name: "$:interval.mothly:$" },
    ]

    // usage log

    let exportingUsageLog: boolean = false
    let usageLogExported: boolean = false
    function exportUsageLog() {
        exportingUsageLog = true
        setTimeout(() => (usageLogExported = true), 1000)
        send(EXPORT, ["USAGE"], { path: $dataPath, content: $usageLog })
    }
    function resetUsageLog() {
        usageLog.set({ all: [] })
    }
</script>

<CombinedInput textWidth={30}>
    <p><T id="settings.data_location" /></p>
    <span class="path" title={$dataPath || ""}>
        <FolderPicker style="width: 100%;" id="DATA" center={false} path={$dataPath}>
            <Icon id="folder" style="margin-left: 0.5em;" right />
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
        <FolderPicker style="width: 100%;" id="SHOWS" center={false} path={$showsPath}>
            <Icon id="folder" style="margin-left: 0.5em;" right />
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

<CombinedInput>
    <p><T id="settings.auto_updates" /></p>
    <div class="alignRight">
        <Checkbox checked={$special.autoUpdates !== false} on:change={(e) => toggle(e, "autoUpdates")} />
    </div>
</CombinedInput>
<CombinedInput>
    <p><T id="settings.alert_updates" /></p>
    <div class="alignRight">
        <Checkbox checked={$alertUpdates} on:change={(e) => alertUpdates.set(isChecked(e))} />
    </div>
</CombinedInput>
{#if $alertUpdates}
    <CombinedInput>
        <p>Alert when a new beta version is available</p>
        <div class="alignRight">
            <Checkbox checked={$special.betaVersionAlert} on:change={(e) => updateSpecial(isChecked(e), "betaVersionAlert")} />
        </div>
    </CombinedInput>
{/if}

<CombinedInput>
    <p><T id="settings.popup_before_close" /></p>
    <div class="alignRight">
        <Checkbox disabled={!$dataPath} checked={$special.showClosePopup || false} on:change={(e) => toggle(e, "showClosePopup")} />
    </div>
</CombinedInput>

<CombinedInput>
    <p><T id="settings.disable_presenter_controller_keys" /></p>
    <div class="alignRight">
        <Checkbox checked={$special.disablePresenterControllerKeys || false} on:change={(e) => toggle(e, "disablePresenterControllerKeys")} />
    </div>
</CombinedInput>

<!-- disableHardwareAcceleration -->
<CombinedInput>
    <p><T id="settings.disable_hardware_acceleration" /></p>
    <div class="alignRight">
        <Checkbox checked={disableHardwareAcceleration} on:change={toggleHardwareAcceleration} />
    </div>
</CombinedInput>

<!-- WIP change frame rate on remote?? -->
<!-- <CombinedInput>
    <p><T id="settings.preview_frame_rate" /></p>
    <Dropdown options={previewRates} value={previewRates.find((a) => a.id === ($special.previewRate || "auto"))?.name} on:click={(e) => updateSpecial(e.detail.id, "previewRate")} />
</CombinedInput> -->

<!-- WIP custom metadata order -->
<!-- "Song: {title} - {author}, License: {ccli}" -->
<!-- or just allow to enter in a template... -->
<!-- <CombinedInput>
    <Button style="width: 100%;" on:click={() => activePopup.set("custom_metadata_order")}>
        <Icon id="meta" style="margin-left: 0.5em;" right />
        <p><T id="popup.custom_metadata_order" /></p>
    </Button>
</CombinedInput> -->

<!-- USED TO REFRESH SHOWS WITHOUT RESTARTING -->
<!-- WIP this could be used to refresh shows list from folder without restarting the program, but I don't think its necessary -->
<!-- {#if brokenShows > 0 || hiddenShows.length > Object.keys($shows).length}
    <CombinedInput>
        <Button style="width: 100%;" on:click={refreshShows}>
            <Icon id="refresh" style="margin-left: 0.5em;" right />
            <p>
                <T id="actions.refresh_all_shows" />
                <span style="display: flex;align-items: center;margin-left: 10px;opacity: 0.5;">({brokenShows || hiddenShows.length - Object.keys($shows).length})</span>
            </p>
        </Button>
    </CombinedInput>
{/if} -->
<!-- USED TO DELETE "BROKEN" SHOWS -->
{#if hiddenShows.length > Object.keys($shows).length}
    <CombinedInput>
        <Button style="width: 100%;" on:click={deleteShows}>
            <Icon id="delete" style="margin-left: 0.5em;" right />
            <p>
                <T id="actions.delete_shows_not_indexed" />
                <span style="display: flex;align-items: center;margin-left: 10px;opacity: 0.5;">({hiddenShows.length - Object.keys($shows).length})</span>
            </p>
        </Button>
    </CombinedInput>
{/if}

<!-- DELETE EMPTY SHOWS -->
{#if emptyShows.length}
    <CombinedInput>
        <Button style="width: 100%;" on:click={deleteEmptyShows}>
            <Icon id="delete" style="margin-left: 0.5em;" right />
            <p>
                <T id="actions.delete_empty_shows" />
                <span style="display: flex;align-items: center;margin-left: 10px;opacity: 0.5;">({emptyShows.length})</span>
            </p>
        </Button>
    </CombinedInput>
{/if}

<!-- REMOVE DUPLICATED SHOWS -->
{#if duplicatedShows.length}
    <CombinedInput>
        <Button style="width: 100%;" on:click={deleteDuplicatedShows}>
            <Icon id="delete" style="margin-left: 0.5em;" right />
            <p>
                <T id="popup.delete_duplicated_shows" />
                <span style="display: flex;align-items: center;margin-left: 10px;opacity: 0.5;">({duplicatedShows.length})</span>
            </p>
        </Button>
    </CombinedInput>
{/if}

<!-- <CombinedInput>
    <Button style="width: 100%;" on:click={deleteCache}>
        <Icon id="delete" style="margin-left: 0.5em;" right />
        <p>
            <T id="actions.delete_thumbnail_cache" />
            <span style="display: flex;align-items: center;margin-left: 10px;opacity: 0.5;">({cacheSize})</span>
        </p>
    </Button>
</CombinedInput> -->

<CombinedInput title={$dictionary.media?.bundle_media_files_tip}>
    <Button style="width: 100%;" on:click={bundleMediaFiles}>
        <Icon id="image" style="margin-left: 0.5em;" right />
        <p><T id="media.bundle_media_files" /></p>
    </Button>
</CombinedInput>

{#if $usageLog.all?.length}
    {#if usageLogExported}
        <CombinedInput title={$dictionary.actions?.reset_usage_log}>
            <Button style="width: 100%;" on:click={resetUsageLog}>
                <Icon id="reset" style="margin-left: 0.5em;" right />
                <p><T id="actions.reset_usage_log" /></p>
            </Button>
        </CombinedInput>
    {:else}
        <CombinedInput title={$dictionary.actions?.export_usage_log}>
            <Button disabled={exportingUsageLog} style="width: 100%;" on:click={exportUsageLog}>
                <Icon id="export" style="margin-left: 0.5em;" right />
                <p><T id="actions.export_usage_log" /></p>
            </Button>
        </CombinedInput>
    {/if}
{/if}

<CombinedInput>
    <Button style="width: 50%;" on:click={openLog}>
        <Icon id="document" style="margin-left: 0.5em;" right />
        <p><T id="actions.open_error_log" /></p>
    </Button>
    <Button on:click={openCache}>
        <Icon id="folder" style="margin-left: 0.5em;" right />
        <p><T id="actions.open_cache_folder" /></p>
    </Button>
</CombinedInput>

<CombinedInput>
    <Button style="width: 50%;" on:click={backup}>
        <Icon id="export" style="margin-left: 0.5em;" right />
        <p><T id="settings.backup_all" /></p>
    </Button>
    <Button on:click={restore}>
        <Icon id="import" style="margin-left: 0.5em;" right />
        <p><T id="settings.restore" /></p>
    </Button>
</CombinedInput>

<CombinedInput>
    <p><T id="settings.auto_backup" /></p>
    <Dropdown options={autobackupList} value={autobackupList.find((a) => a.id === ($special.autoBackup || "weekly"))?.name || ""} on:click={(e) => updateSpecial(e.detail.id, "autoBackup")} up />
</CombinedInput>

<CombinedInput>
    <Button style="width: 100%;" on:click={() => activePopup.set("reset_all")} center red>
        <Icon id="reset" right /><T id="settings.reset_all" />
    </Button>
</CombinedInput>

<div class="filler" />

<style>
    .path {
        display: flex;
        align-items: center;
        max-width: 70%;
    }
    .path :global(button) {
        white-space: nowrap;
    }

    /* hr {
        margin: 20px 0;
        border: none;
        height: 2px;
        background-color: var(--primary-lighter);
    } */

    .filler {
        height: 18px;
    }
</style>
