<script lang="ts">
    import { onMount } from "svelte"
    import { MAIN } from "../../../../types/Channels"
    import { activePopup, exportPath, mediaCache, recordingPath, scripturePath, shows, showsPath } from "../../../stores"
    import { newToast } from "../../../utils/messages"
    import { receive, send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { formatBytes } from "../../helpers/bytes"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import FolderPicker from "../../inputs/FolderPicker.svelte"

    onMount(() => {
        getCacheSize()
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

    // shows in folder
    let hiddenShows: any[] = []
    let brokenShows: number = 0
    receive(MAIN, {
        FULL_SHOWS_LIST: (data: any) => (hiddenShows = data || []),
    })

    $: if (hiddenShows?.length) getBrokenShows()
    function getBrokenShows() {
        brokenShows = 0

        Object.values($shows).forEach(({ name }: any) => {
            if (!hiddenShows.includes(name + ".show")) brokenShows++
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
</script>

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
    </span>
</CombinedInput>

<CombinedInput textWidth={30}>
    <p><T id="settings.export_location" /></p>
    <span class="path" title={$exportPath || ""}>
        <FolderPicker style="width: 100%;" id="EXPORT" center={false} path={$exportPath}>
            <Icon id="folder" right />
            {#if $exportPath}
                {$exportPath}
            {:else}
                <T id="inputs.change_folder" />
            {/if}
        </FolderPicker>
    </span>
</CombinedInput>

<CombinedInput textWidth={30}>
    <p><T id="settings.scripture_location" /></p>
    <span class="path" title={$scripturePath || ""}>
        <FolderPicker style="width: 100%;" id="SCRIPTURE" center={false} path={$scripturePath}>
            <Icon id="folder" right />
            {#if $scripturePath}
                {$scripturePath}
            {:else}
                <T id="inputs.change_folder" />
            {/if}
        </FolderPicker>
    </span>
</CombinedInput>

<CombinedInput textWidth={30}>
    <p><T id="settings.recording_location" /></p>
    <span class="path" title={$recordingPath || ""}>
        <FolderPicker style="width: 100%;" id="RECORDING" center={false} path={$recordingPath}>
            <Icon id="folder" right />
            {#if $recordingPath}
                {$recordingPath}
            {:else}
                <T id="inputs.change_folder" />
            {/if}
        </FolderPicker>
    </span>
</CombinedInput>

{#if brokenShows > 0 || hiddenShows.length > Object.keys($shows).length}
    <CombinedInput>
        <Button style="width: 100%;" on:click={refreshShows}>
            <Icon id="refresh" right />
            <p style="padding: 0;">
                <T id="actions.refresh_all_shows" />
                <span style="display: flex;align-items: center;margin-left: 10px;opacity: 0.5;">({brokenShows || hiddenShows.length - Object.keys($shows).length})</span>
            </p>
        </Button>
    </CombinedInput>
{/if}
{#if hiddenShows.length > Object.keys($shows).length}
    <CombinedInput>
        <Button style="width: 100%;" on:click={deleteShows}>
            <Icon id="delete" right />
            <p style="padding: 0;">
                <T id="actions.delete_shows_not_indexed" />
                <span style="display: flex;align-items: center;margin-left: 10px;opacity: 0.5;">({hiddenShows.length - Object.keys($shows).length})</span>
            </p>
        </Button>
    </CombinedInput>
{/if}

<!-- <br /> -->

<CombinedInput>
    <Button style="width: 100%;" on:click={deleteCache}>
        <Icon id="delete" style="border: 0;" right />
        <p style="padding: 0;">
            <T id="actions.delete_thumbnail_cache" />
            <span style="display: flex;align-items: center;margin-left: 10px;opacity: 0.5;">({cacheSize})</span>
        </p>
    </Button>
</CombinedInput>

<!-- <hr /> -->
<br />

<Button style="width: 100%;" on:click={() => activePopup.set("reset_all")} center red>
    <Icon id="reset" right /><T id="settings.reset_all" />
</Button>

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
