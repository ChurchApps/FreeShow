<script lang="ts">
    import { onMount } from "svelte"
    import { MAIN } from "../../../../types/Channels"
    import { activePopup, alertMessage, dataPath, dictionary, mediaCache, shows, showsCache, showsPath, special } from "../../../stores"
    import { newToast } from "../../../utils/messages"
    import { receive, send } from "../../../utils/request"
    import { save } from "../../../utils/save"
    import { restartOutputs } from "../../../utils/updateSettings"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { formatBytes } from "../../helpers/bytes"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import FolderPicker from "../../inputs/FolderPicker.svelte"

    onMount(() => {
        getCacheSize()
        // getAudioOutputs()
        send(MAIN, ["FULL_SHOWS_LIST"], { path: $showsPath })
    })

    let cacheSize: string = "0 Bytes"
    function getCacheSize() {
        if (!Object.keys($mediaCache).length) {
            cacheSize = "0 Bytes"
            return
        }

        let str = JSON.stringify($mediaCache)
        let byteLengthUtf8 = new Blob([str]).size
        cacheSize = formatBytes(byteLengthUtf8)
    }

    const previewRates = [
        { id: "auto", name: "$:settings.auto:$" },
        { id: "optimized", name: "$:settings.optimized:$" },
        { id: "full", name: "$:settings.full:$" },
    ]

    // let audioOutputs: any = []
    // async function getAudioOutputs() {
    //     const devices = await navigator.mediaDevices.enumerateDevices()
    //     let outputs = devices.filter((device) => device.kind === "audiooutput")

    //     let defaultGroupId = outputs.find((a) => a.deviceId === "default")?.groupId
    //     if (defaultGroupId) outputs = outputs.filter((a) => a.groupId !== defaultGroupId || a.deviceId === "default")

    //     audioOutputs = [{ id: "", name: "—" }, ...outputs.map((device) => ({ id: device.deviceId, name: device.label }))]
    // }

    function updateSpecial(value, key) {
        special.update((a) => {
            if (!value) delete a[key]
            else a[key] = value

            return a
        })

        if (key === "previewRate") restartOutputs()
    }

    // shows in folder
    let hiddenShows: any[] = []
    let brokenShows: number = 0
    receive(MAIN, {
        FULL_SHOWS_LIST: (data: any) => (hiddenShows = data || []),
    })

    $: if (hiddenShows?.length) getBrokenShows()
    function getBrokenShows() {
        brokenShows = 0

        Object.entries($shows).forEach(([id, { name }]: any) => {
            if (!hiddenShows.includes(name + ".show") && !hiddenShows.includes(id + ".show")) brokenShows++
        })
    }

    // get all shows inside current shows folder (and remove missing)
    function refreshShows() {
        send(MAIN, ["REFRESH_SHOWS"], { path: $showsPath })

        setTimeout(() => {
            send(MAIN, ["FULL_SHOWS_LIST"], { path: $showsPath })
        }, 800)
    }

    // delete shows from folder that are not indexed
    function deleteShows() {
        send(MAIN, ["DELETE_SHOWS"], { shows: $shows, path: $showsPath })

        setTimeout(() => {
            send(MAIN, ["FULL_SHOWS_LIST"], { path: $showsPath })
        }, 800)
    }

    // delete media thumbnail cache
    function deleteCache() {
        if (!Object.keys($mediaCache).length) {
            newToast("$toast.empty_cache")
            return
        }

        newToast("$toast.deleted_cache")
        mediaCache.set({})
        cacheSize = "0 Bytes"
    }

    // open log
    function openLog() {
        send(MAIN, ["OPEN_LOG"])
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
    <p><T id="settings.preview_frame_rate" /></p>
    <Dropdown options={previewRates} value={previewRates.find((a) => a.id === ($special.previewRate || "auto"))?.name} on:click={(e) => updateSpecial(e.detail.id, "previewRate")} />
</CombinedInput>

<!-- <CombinedInput>
    <p><T id="settings.custom_audio_output" /></p>
    <Dropdown options={audioOutputs} value={audioOutputs.find((a) => a.id === $special.audioOutput)?.name || "—"} on:click={(e) => updateSpecial(e.detail.id, "audioOutput")} />
</CombinedInput> -->

<CombinedInput>
    <Button style="width: 100%;" on:click={() => activePopup.set("manage_icons")}>
        <Icon id="noIcon" style="border: 0;" right />
        <p style="padding: 0;"><T id="popup.manage_icons" /></p>
    </Button>
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
{#if brokenShows > 0 || hiddenShows.length > Object.keys($shows).length}
    <CombinedInput>
        <Button style="width: 100%;" on:click={refreshShows}>
            <Icon id="refresh" style="border: 0;" right />
            <p style="padding: 0;">
                <T id="actions.refresh_all_shows" />
                <span style="display: flex;align-items: center;margin-left: 10px;opacity: 0.5;">({brokenShows || hiddenShows.length - Object.keys($shows).length})</span>
            </p>
        </Button>
    </CombinedInput>
{/if}
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

<CombinedInput>
    <Button style="width: 100%;" on:click={deleteCache}>
        <Icon id="delete" style="border: 0;" right />
        <p style="padding: 0;">
            <T id="actions.delete_thumbnail_cache" />
            <span style="display: flex;align-items: center;margin-left: 10px;opacity: 0.5;">({cacheSize})</span>
        </p>
    </Button>
</CombinedInput>

<CombinedInput>
    <Button style="width: 100%;" on:click={openLog}>
        <Icon id="document" right /><T id="actions.open_log_file" />
    </Button>
</CombinedInput>

<CombinedInput>
    <Button style="width: 100%;" on:click={backup}>
        <Icon id="download" right /><T id="settings.backup_all" />
    </Button>
</CombinedInput>

<CombinedInput>
    <Button style="width: 100%;" on:click={restore}>
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
