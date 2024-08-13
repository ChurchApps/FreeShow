<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { MAIN, STORE } from "../../../../types/Channels"
    import { activePopup, alertMessage, dataPath, dictionary, shows, showsCache, showsPath, special } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import { save } from "../../../utils/save"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { DEFAULT_PROJECT_NAME, projectReplacers } from "../../helpers/historyHelpers"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import FolderPicker from "../../inputs/FolderPicker.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    onMount(() => {
        // getCacheSize()
        // getAudioOutputs()
        send(MAIN, ["FULL_SHOWS_LIST"], { path: $showsPath })
        send(MAIN, ["GET_STORE_VALUE"], { file: "config", key: "disableHardwareAcceleration" })
    })

    // const previewRates = [
    //     { id: "auto", name: "$:settings.auto:$ (1|30 fps)" },
    //     { id: "optimized", name: "$:settings.optimized:$ (1 fps)" },
    //     { id: "reduced", name: "$:settings.reduced:$ (10 fps)" },
    //     { id: "full", name: "$:settings.full:$ (60 fps)" },
    // ]

    function updateSpecial(value, key) {
        special.update((a) => {
            if (!value && key !== "clearMediaOnFinish") delete a[key]
            else a[key] = value

            return a
        })

        // if (key === "previewRate") restartOutputs()
    }

    function updateTextInput(e: any, key: string) {
        updateSpecial(e.target.value, key)
    }

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
            FULL_SHOWS_LIST: (data: any) => (hiddenShows = data || []),
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

    let projectReplacerTitle = getReplacerTitle()
    function getReplacerTitle() {
        let titles: string[] = []
        projectReplacers.forEach((a) => {
            titles.push(`${a.title}: {${a.id}}`)
        })

        return titles.join(", ")
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
    <p><T id="settings.clear_media_when_finished" /></p>
    <div class="alignRight">
        <Checkbox checked={$special.clearMediaOnFinish ?? true} on:change={(e) => toggle(e, "clearMediaOnFinish")} />
    </div>
</CombinedInput>
<CombinedInput>
    <p><T id="settings.disable_presenter_controller_keys" /></p>
    <div class="alignRight">
        <Checkbox checked={$special.disablePresenterControllerKeys || false} on:change={(e) => toggle(e, "disablePresenterControllerKeys")} />
    </div>
</CombinedInput>
<CombinedInput>
    <p><T id="settings.popup_before_close" /></p>
    <div class="alignRight">
        <Checkbox disabled={!$dataPath} checked={$special.showClosePopup || false} on:change={(e) => toggle(e, "showClosePopup")} />
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

<CombinedInput>
    <p><T id="settings.capitalize_words" /></p>
    <TextInput value={$special.capitalize_words} on:change={(e) => updateTextInput(e, "capitalize_words")} />
</CombinedInput>

<CombinedInput title={projectReplacerTitle}>
    <p><T id="settings.default_project_name" /></p>
    <TextInput value={$special.default_project_name ?? DEFAULT_PROJECT_NAME} on:change={(e) => updateTextInput(e, "default_project_name")} />
</CombinedInput>

<CombinedInput>
    <p><T id="settings.max_auto_font_size" /></p>
    <NumberInput value={$special.max_auto_font_size ?? 800} min={20} max={5000} on:change={(e) => updateSpecial(e.detail, "max_auto_font_size")} />
</CombinedInput>

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

<!-- <CombinedInput>
    <Button style="width: 100%;" on:click={deleteCache}>
        <Icon id="delete" style="border: 0;" right />
        <p style="padding: 0;">
            <T id="actions.delete_thumbnail_cache" />
            <span style="display: flex;align-items: center;margin-left: 10px;opacity: 0.5;">({cacheSize})</span>
        </p>
    </Button>
</CombinedInput> -->

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
</style>
