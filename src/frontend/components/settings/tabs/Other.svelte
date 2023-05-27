<script lang="ts">
    import { MAIN } from "../../../../types/Channels"
    import { activePopup, mediaCache, shows, showsPath } from "../../../stores"
    import { newToast } from "../../../utils/messages"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
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

<div>
    <p><T id="settings.show_location" /></p>
    <span class="shows_path" title={$showsPath}>
        <p style="font-size: 0.9em;opacity: 0.7;">{$showsPath}</p>
        <FolderPicker id="SHOWS">
            <Icon id="folder" right />
            <T id="inputs.change_folder" />
        </FolderPicker>
    </span>
</div>

<hr />

<Button style="width: 100%;" on:click={refreshShows} center>
    <Icon id="refresh" right />
    <T id="actions.refresh_all_shows" />
</Button>
<Button style="width: 100%;" on:click={deleteShows} center>
    <Icon id="delete" right />
    <T id="actions.delete_shows_not_indexed" />
</Button>

<br />

<Button style="width: 100%;" on:click={deleteCache} center>
    <Icon id="delete" right />
    <T id="actions.delete_thumbnail_cache" />
</Button>

<hr />

<Button style="width: 100%;" on:click={() => activePopup.set("reset_all")} center>
    <Icon id="reset" right /><T id="settings.reset_all" />
</Button>

<style>
    div:not(.scroll) {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 5px 0;
        /* height: 35px; */
        min-height: 38px;
    }

    .shows_path {
        display: flex;
        align-items: center;
        max-width: 70%;
    }
    .shows_path :global(button) {
        white-space: nowrap;
    }

    hr {
        margin: 20px 0;
        border: none;
        height: 2px;
        background-color: var(--primary-lighter);
    }
</style>
