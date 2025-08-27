<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import type { SaveData } from "../../../../types/Save"
    import { sendMain } from "../../../IPC/main"
    import { activeEdit, activePage, activePopup, activeShow, dataPath, deletedShows, drawSettings, renamedShows, scripturesCache, showsPath } from "../../../stores"
    import { save } from "../../../utils/save"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { clearAll } from "../../output/clear"

    function reset() {
        // backup
        save(false, { backup: true, isAutoBackup: true })
        setTimeout(resetSettings, 500)
    }

    function resetSettings() {
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
            customTriggers: { changeUserData: { reset: true } }
        } as SaveData)

        // WIP reset error log / other config files
        // all content in FreeShow/ folder, including Shows/Scripture files are not deleted
        // media cache is not deleted

        clearAll()
        drawSettings.set({})

        showsPath.set(null)
        // dataPath.set("")
        // showsCache.set({})
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
<p style="font-size: 0.9em;opacity: 0.7;"><T id="popup.reset_all_action" /></p>

<MaterialButton variant="outlined" class="red" style="margin-top: 20px;" icon="close" on:click={reset} white>
    <T id="popup.continue" />
</MaterialButton>

<style>
    /* red */
    :global(button.red) {
        background-color: rgb(255 0 0 / 0.25) !important;
    }
    :global(button.red):hover:not(.contained):not(.active) {
        background-color: rgb(255 0 0 / 0.35) !important;
    }
    :global(button.red):active:not(.contained):not(.active),
    :global(button.red):focus:not(.contained):not(.active) {
        background-color: rgb(255 0 0 / 0.3) !important;
    }
</style>
