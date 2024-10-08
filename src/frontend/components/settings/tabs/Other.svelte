<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { MAIN, STORE } from "../../../../types/Channels"
    import { activePopup, alertMessage, alertUpdates, dataPath, deletedShows, dictionary, guideActive, popupData, shows, showsCache, showsPath, special } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import { save } from "../../../utils/save"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import FolderPicker from "../../inputs/FolderPicker.svelte"

    onMount(() => {
        // getCacheSize()
        // getAudioOutputs()
        send(MAIN, ["FULL_SHOWS_LIST"], { path: $showsPath })
        send(MAIN, ["GET_STORE_VALUE"], { file: "config", key: "disableHardwareAcceleration" })
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

    function toggle(e: any, key: string) {
        let checked = e.target.checked
        updateSpecial(checked, key)

        if (key === "customUserDataLocation") send(STORE, ["UPDATE_PATH"], { reset: !checked, dataPath: $dataPath })
    }

    // hardware acceleration
    let disableHardwareAcceleration = true
    function toggleHardwareAcceleration(e: any) {
        disableHardwareAcceleration = e.target.checked
        send(MAIN, ["SET_STORE_VALUE"], { file: "config", key: "disableHardwareAcceleration", value: disableHardwareAcceleration })

        alertMessage.set("settings.restart_for_change")
        activePopup.set("alert")
    }

    // shows in folder
    let hiddenShows: any[] = []
    let brokenShows: number = 0
    let listenerId = "OTHER_SETTINGS"
    receive(
        MAIN,
        {
            // this will not include newly created shows not saved yet, but it should not be an issue.
            FULL_SHOWS_LIST: (data: any) => {
                hiddenShows = data || []
                let deletedShowNames = $deletedShows.map((a) => a.name + ".show")
                hiddenShows = hiddenShows.filter((name) => !deletedShowNames.includes(name))
            },
            GET_STORE_VALUE: (data: any) => {
                if (data.key === "disableHardwareAcceleration") disableHardwareAcceleration = data.value
            },
        },
        listenerId
    )
    onDestroy(() => destroy(MAIN, listenerId))

    $: if (hiddenShows?.length) getBrokenShows()
    function getBrokenShows() {
        brokenShows = 0

        Object.entries($shows).forEach(([id, { name }]: any) => {
            if (!hiddenShows.includes(name + ".show") && !hiddenShows.includes(id + ".show")) brokenShows++
        })
    }

    // get all shows inside current shows folder (and remove missing)
    // function refreshShows() {
    //     send(MAIN, ["REFRESH_SHOWS"], { path: $showsPath })

    //     setTimeout(() => {
    //         send(MAIN, ["FULL_SHOWS_LIST"], { path: $showsPath })
    //     }, 800)
    // }

    // delete shows from folder that are not indexed
    function deleteShows() {
        send(MAIN, ["DELETE_SHOWS"], { shows: $shows, path: $showsPath })

        setTimeout(() => {
            send(MAIN, ["FULL_SHOWS_LIST"], { path: $showsPath })
        }, 800)
    }

    let duplicatedShows: { ids: string[] }[] = []
    function getDuplicatedShows() {
        let names: { [key: string]: string[] } = {}
        Object.entries($shows).forEach(([id, show]: any) => {
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
        send(MAIN, ["OPEN_LOG"])
    }
    function openCache() {
        send(MAIN, ["OPEN_CACHE"])
    }

    // bundle media files
    function bundleMediaFiles() {
        send(MAIN, ["BUNDLE_MEDIA_FILES"], { showsPath: $showsPath, dataPath: $dataPath })
    }

    // backup
    function backup() {
        alertMessage.set($dictionary.settings?.backup_started)
        activePopup.set("alert")
        save(false, true)
    }

    function restore() {
        showsCache.set({})
        alertMessage.set($dictionary.settings?.restore_started)
        activePopup.set("alert")
        send(MAIN, ["RESTORE"], { showsPath: $showsPath })
    }
</script>

<CombinedInput textWidth={30}>
    <p><T id="settings.data_location" /></p>
    <span class="path" title={$dataPath || ""}>
        <FolderPicker style="width: 100%;" id="DATA" center={false} path={$dataPath}>
            <Icon id="folder" right />
            {#if $dataPath}
                {$dataPath}
            {:else}
                <T id="inputs.change_folder" />
            {/if}
        </FolderPicker>
        <Button title={$dictionary.main?.system_open} on:click={() => send(MAIN, ["SYSTEM_OPEN"], $dataPath)}>
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
            <Icon id="folder" right />
            {#if $showsPath}
                {$showsPath}
            {:else}
                <T id="inputs.change_folder" />
            {/if}
        </FolderPicker>
        <Button title={$dictionary.main?.system_open} on:click={() => send(MAIN, ["SYSTEM_OPEN"], $showsPath)}>
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
        <Icon id="meta" style="border: 0;" right />
        <p style="padding: 0;"><T id="popup.custom_metadata_order" /></p>
    </Button>
</CombinedInput> -->

<!-- USED TO REFRESH SHOWS WITHOUT RESTARTING -->
<!-- WIP this could be used to refresh shows list from folder without restarting the program, but I don't think its necessary -->
<!-- {#if brokenShows > 0 || hiddenShows.length > Object.keys($shows).length}
    <CombinedInput>
        <Button style="width: 100%;" on:click={refreshShows}>
            <Icon id="refresh" style="border: 0;" right />
            <p style="padding: 0;">
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
            <Icon id="delete" style="border: 0;" right />
            <p style="padding: 0;">
                <T id="actions.delete_shows_not_indexed" />
                <span style="display: flex;align-items: center;margin-left: 10px;opacity: 0.5;">({hiddenShows.length - Object.keys($shows).length})</span>
            </p>
        </Button>
    </CombinedInput>
{/if}

<!-- REMOVE DUPLICATED SHOWS -->
{#if duplicatedShows.length}
    <CombinedInput>
        <Button style="width: 100%;" on:click={deleteDuplicatedShows}>
            <Icon id="delete" style="border: 0;" right />
            <p style="padding: 0;">
                <T id="popup.delete_duplicated_shows" />
                <span style="display: flex;align-items: center;margin-left: 10px;opacity: 0.5;">({duplicatedShows.length})</span>
            </p>
        </Button>
    </CombinedInput>
{/if}

<!-- <CombinedInput>
    <Button style="width: 100%;" on:click={deleteCache}>
        <Icon id="delete" style="border: 0;" right />
        <p style="padding: 0;">
            <T id="actions.delete_thumbnail_cache" />
            <span style="display: flex;align-items: center;margin-left: 10px;opacity: 0.5;">({cacheSize})</span>
        </p>
    </Button>
</CombinedInput> -->

<CombinedInput title={$dictionary.guide?.start}>
    <Button style="width: 100%;" on:click={() => guideActive.set(true)}>
        <Icon id="guide" right /><T id="guide.start" />
    </Button>
</CombinedInput>

<CombinedInput title={$dictionary.media?.bundle_media_files_tip}>
    <Button style="width: 100%;" on:click={bundleMediaFiles}>
        <Icon id="image" right /><T id="media.bundle_media_files" />
    </Button>
</CombinedInput>

<CombinedInput>
    <Button style="width: 50%;" on:click={openLog}>
        <Icon id="document" right /><T id="actions.open_log_file" />
    </Button>
    <Button on:click={openCache}>
        <Icon id="folder" right /><T id="actions.open_cache_folder" />
    </Button>
</CombinedInput>

<CombinedInput>
    <Button style="width: 50%;" on:click={backup}>
        <Icon id="download" right /><T id="settings.backup_all" />
    </Button>
    <Button on:click={restore}>
        <Icon id="upload" right /><T id="settings.restore" />
    </Button>
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
