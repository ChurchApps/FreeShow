<script lang="ts">
    import { MAIN } from "../../../../types/Channels"
    import { activePopup, exportPath, mediaCache, recordingPath, scripturePath, shows, showsPath } from "../../../stores"
    import { newToast } from "../../../utils/messages"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import FolderPicker from "../../inputs/FolderPicker.svelte"

    // get all shows inside current shows folder (and remove missing)
    function refreshShows() {
        send(MAIN, ["REFRESH_SHOWS"], { path: $showsPath })
    }

    // delete shows from folder that are not indexed
    function deleteShows() {
        send(MAIN, ["DELETE_SHOWS"], { shows: $shows, path: $showsPath })
    }

    // delete media thumbnail cache
    function deleteCache() {
        if (!Object.keys($mediaCache).length) {
            newToast("Empty cache")
            return
        }

        newToast("Deleted media thumbnail cache")
        mediaCache.set({})
    }
</script>

<CombinedInput textWidth={30}>
    <p><T id="settings.show_location" /></p>
    <span class="path" title={$showsPath || ""}>
        <!-- <p style="font-size: 0.9em;opacity: 0.7;">{$showsPath}</p> -->
        <!-- title={$dictionary.inputs?.change_folder} -->
        <FolderPicker style="width: 100%;" id="SHOWS" center={false}>
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
        <FolderPicker style="width: 100%;" id="EXPORT" center={false}>
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
        <FolderPicker style="width: 100%;" id="SCRIPTURE" center={false}>
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
        <FolderPicker style="width: 100%;" id="RECORDING" center={false}>
            <Icon id="folder" right />
            {#if $recordingPath}
                {$recordingPath}
            {:else}
                <T id="inputs.change_folder" />
            {/if}
        </FolderPicker>
    </span>
</CombinedInput>

<CombinedInput>
    <Button style="width: 100%;" on:click={refreshShows}>
        <Icon id="refresh" right />
        <T id="actions.refresh_all_shows" />
    </Button>
</CombinedInput>
<CombinedInput>
    <Button style="width: 100%;" on:click={deleteShows}>
        <Icon id="delete" right />
        <T id="actions.delete_shows_not_indexed" />
    </Button>
</CombinedInput>

<!-- <br /> -->

<CombinedInput>
    <Button style="width: 100%;" on:click={deleteCache}>
        <Icon id="delete" right />
        <T id="actions.delete_thumbnail_cache" />
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
