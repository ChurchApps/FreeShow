<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import type { SaveData } from "../../../../types/Save"
    import { sendMain } from "../../../IPC/main"
    import { activeEdit, activePage, activePopup, activeShow, dataPath, deletedShows, drawSettings, renamedShows, scripturesCache, showsCache, showsPath } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import { clearAll } from "../../output/clear"

    function reset() {
        sendMain(Main.SAVE, {
            path: $showsPath || "",
            dataPath: $dataPath,
            // SETTINGS
            SETTINGS: {},
            SYNCED_SETTINGS: {},
            // SHOWS
            SHOWS: {},
            STAGE_SHOWS: {},
            // STORES
            PROJECTS: { projects: {}, folders: {}, projectTemplates: {} },
            OVERLAYS: {},
            TEMPLATES: {},
            EVENTS: {},
            MEDIA: {},
            THEMES: {},
            DRIVE_API_KEY: {},
            CACHE: { media: {}, text: {} },
            HISTORY: { undo: [], redo: [] },
            USAGE: { all: [] },
            // SAVE DATA
            closeWhenFinished: false,
            customTriggers: { changeUserData: { reset: true } },
        } as SaveData)

        clearAll()
        drawSettings.set({})

        showsPath.set(null)
        // dataPath.set("")
        showsCache.set({})
        scripturesCache.set({})
        deletedShows.set([])
        renamedShows.set([])

        activeShow.set(null)
        activeEdit.set({ items: [] })

        activePage.set("show")
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
