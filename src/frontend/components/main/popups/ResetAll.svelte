<script lang="ts">
    import { STORE } from "../../../../types/Channels"
    import { activeEdit, activePopup, activeShow, deletedShows, renamedShows, scripturesCache, showsCache, showsPath } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    function reset() {
        window.api.send(STORE, {
            channel: "SAVE",
            data: {
                reset: true,
                // SETTINGS
                SETTINGS: {},
                SYNCED_SETTINGS: {},
                // SHOWS
                SHOWS: {},
                STAGE_SHOWS: {},
                // STORES
                PROJECTS: { projects: {}, folders: {} },
                OVERLAYS: {},
                TEMPLATES: {},
                EVENTS: {},
                MEDIA: {},
                THEMES: {},
                DRIVE_API_KEY: {},
                CACHE: { media: {}, text: {} },
                HISTORY: { undo: [], redo: [] },
            },
        })

        showsPath.set(null)
        // dataPath.set("")
        showsCache.set({})
        scripturesCache.set({})
        deletedShows.set([])
        renamedShows.set([])

        activeShow.set(null)
        activeEdit.set({ items: [] })

        activePopup.set("initialize")
    }
</script>

<p><T id="popup.reset_all_confirm" /></p>
<p><T id="popup.reset_all_action" /></p>

<br />

<Button on:click={reset} center dark red>
    <Icon id="close" right />
    <T id="popup.continue" />
</Button>
