<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { EXPORT } from "../../../../types/Channels"
    import { Main } from "../../../../types/IPC/Main"
    import { destroyMain, receiveMain, requestMain, sendMain } from "../../../IPC/main"
    import { activePage, activePopup, alertMessage, alertUpdates, deletedShows, os, popupData, shows, showsCache, special, usageLog, version } from "../../../stores"
    import { send } from "../../../utils/request"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    onMount(() => {
        // getCacheSize()
        // getAudioOutputs()
        sendMain(Main.FULL_SHOWS_LIST)
        requestMain(Main.GET_STORE_VALUE, { file: "config", key: "autoErrorReporting" }, value => {
            autoErrorReporting = value !== false
        })
        requestMain(Main.GET_STORE_VALUE, { file: "config", key: "disableHardwareAcceleration" }, value => {
            disableHardwareAcceleration = !!value
        })
        requestMain(Main.GET_EMPTY_SHOWS, { cached: $showsCache }, a => {
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
        special.update(a => {
            if (!value) delete a[key]
            else a[key] = value

            return a
        })

        // if (key === "previewRate") restartOutputs()
    }

    // auto error reporting
    let autoErrorReporting = true
    function toggleAutoErrorReporting(e: any) {
        autoErrorReporting = e.detail
        sendMain(Main.SET_STORE_VALUE, { file: "config", key: "autoErrorReporting", value: autoErrorReporting })

        alertMessage.set("settings.restart_for_change")
        activePopup.set("alert")
    }

    // hardware acceleration
    let disableHardwareAcceleration = $os.platform === "darwin"
    function toggleHardwareAcceleration(e: any) {
        disableHardwareAcceleration = e.detail
        sendMain(Main.SET_STORE_VALUE, { file: "config", key: "disableHardwareAcceleration", value: disableHardwareAcceleration })

        alertMessage.set("settings.restart_for_change")
        activePopup.set("alert")
    }

    // shows in folder
    let hiddenShows: string[] = []
    // let brokenShows = 0

    // $: if (hiddenShows?.length) getBrokenShows()
    // function getBrokenShows() {
    //     brokenShows = 0

    //     Object.entries($shows).forEach(([id, { name }]) => {
    //         if (!hiddenShows.includes(name + ".show") && !hiddenShows.includes(id + ".show")) brokenShows++
    //     })
    // }

    // get all shows inside current shows folder (and remove missing)
    // function refreshShows() {
    //     sendMain(Main.REFRESH_SHOWS)

    //     setTimeout(() => {
    //         sendMain(Main.FULL_SHOWS_LIST)
    //     }, 800)
    // }

    // delete shows from folder that are not indexed
    function deleteShows() {
        sendMain(Main.DELETE_SHOWS_NI, { shows: $shows })

        setTimeout(() => {
            // this will not include newly created shows not saved yet, but it should not be an issue.
            sendMain(Main.FULL_SHOWS_LIST)
        }, 800)
    }

    let listenerId = receiveMain(Main.FULL_SHOWS_LIST, data => {
        hiddenShows = data || []
        let deletedShowNames = $deletedShows.map(a => a.name + ".show")
        hiddenShows = hiddenShows.filter(name => !deletedShowNames.includes(name))
    })
    onDestroy(() => destroyMain(listenerId))

    let emptyShows: { id: string; name: string }[] = []
    function deleteEmptyShows() {
        sendMain(Main.DELETE_SHOWS, { shows: emptyShows })
        // emptyShows = []
        activePage.set("show")
    }

    let duplicatedShows: { ids: string[] }[] = []
    function getDuplicatedShows() {
        let names: { [key: string]: string[] } = {}
        Object.entries($shows).forEach(([id, show]) => {
            if (!show?.name) return
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
            .filter(a => a.length > 1)
            .map(ids => ({ ids }))
    }
    function deleteDuplicatedShows() {
        popupData.set({ id: "delete_duplicated_shows", data: duplicatedShows })
        activePopup.set("delete_duplicated_shows")
        // duplicatedShows = []
    }

    // delete media thumbnail cache
    // function deleteCache() {
    //     if (!Object.keys($mediaCache).length) {
    //         newToast("toast.empty_cache")
    //         return
    //     }

    //     newToast("toast.deleted_cache")
    //     mediaCache.set({})
    //     cacheSize = "0 Bytes"
    // }

    // bundle media files
    function bundleMediaFiles() {
        sendMain(Main.BUNDLE_MEDIA_FILES)
    }

    // usage log

    let exportingUsageLog = false
    let usageLogExported = false
    function exportUsageLog() {
        exportingUsageLog = true
        setTimeout(() => {
            usageLogExported = true
            exportingUsageLog = false
        }, 1000)
        send(EXPORT, ["USAGE"], { content: $usageLog })
    }
    function resetUsageLog() {
        usageLog.set({ all: [] })
        usageLogExported = false
    }

    $: isBeta = $version.includes("beta")
</script>

<MaterialToggleSwitch label="settings.auto_updates" checked={$special.autoUpdates} on:change={e => updateSpecial(e.detail, "autoUpdates")} />

<!-- <InputRow arrow={$alertUpdates}> -->
<MaterialToggleSwitch style="flex: 1;" label="settings.alert_updates" checked={$alertUpdates} defaultValue={true} on:change={e => alertUpdates.set(e.detail)} />
<!-- <div slot="menu"> -->
{#if $alertUpdates}
    <MaterialToggleSwitch label="settings.alert_updates_beta" disabled={isBeta} checked={isBeta ? $alertUpdates : $special.betaVersionAlert} defaultValue={false} on:change={e => updateSpecial(e.detail, "betaVersionAlert")} />
{/if}
<!-- </div> -->
<!-- </InputRow> -->

<MaterialToggleSwitch label="settings.popup_before_close" checked={$special.showClosePopup || false} defaultValue={false} on:change={e => updateSpecial(e.detail, "showClosePopup")} />

<MaterialToggleSwitch label="settings.log_song_usage" checked={$special.logSongUsage || false} defaultValue={false} on:change={e => updateSpecial(e.detail, "logSongUsage")} />

<MaterialToggleSwitch label="settings.auto_error_reporting" checked={autoErrorReporting} defaultValue={true} on:change={toggleAutoErrorReporting} />

<MaterialToggleSwitch label="settings.disable_hardware_acceleration" checked={disableHardwareAcceleration} defaultValue={false} on:change={toggleHardwareAcceleration} />
<!-- "optimized_mode": "Optimized mode", -->
<!-- <MaterialToggleSwitch label="settings.optimized_mode" checked={$special.optimizedMode} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "optimizedMode")} /> -->

<br />

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
    <InputRow>
        <MaterialButton style="width: 100%;justify-content: left;" icon="delete" on:click={deleteShows}>
            <T id="actions.delete_shows_not_indexed" />
            <span style="opacity: 0.5;">({hiddenShows.length - Object.keys($shows).length})</span>
        </MaterialButton>
    </InputRow>
{/if}

<!-- DELETE EMPTY SHOWS -->
{#if emptyShows.length}
    <InputRow>
        <MaterialButton style="width: 100%;justify-content: left;" icon="delete" on:click={deleteEmptyShows}>
            <T id="actions.delete_empty_shows" />
            <span style="opacity: 0.5;">({emptyShows.length})</span>
        </MaterialButton>
    </InputRow>
{/if}

<!-- REMOVE DUPLICATED SHOWS -->
{#if duplicatedShows.length}
    <InputRow>
        <MaterialButton style="width: 100%;justify-content: left;" icon="delete" on:click={deleteDuplicatedShows}>
            <T id="popup.delete_duplicated_shows" />
            <span style="opacity: 0.5;">({duplicatedShows.length})</span>
        </MaterialButton>
    </InputRow>
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

<InputRow>
    <MaterialButton title="media.bundle_media_files_tip" style="width: 100%;justify-content: left;" icon="image" on:click={bundleMediaFiles}>
        <T id="media.bundle_media_files" />
    </MaterialButton>
</InputRow>

{#if $special.logSongUsage && $usageLog.all?.length}
    <InputRow>
        <MaterialButton disabled={exportingUsageLog} style="width: 100%;justify-content: left;" icon={usageLogExported ? "reset" : "export"} on:click={() => (usageLogExported ? resetUsageLog() : exportUsageLog())}>
            <T id="actions.{usageLogExported ? 'reset' : 'export'}_usage_log" />
        </MaterialButton>
    </InputRow>
{/if}
