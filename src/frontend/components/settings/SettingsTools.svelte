<script lang="ts">
    import { Main } from "../../../types/IPC/Main"
    import type { Popups } from "../../../types/Main"
    import { sendMain } from "../../IPC/main"
    import { activePopup, dataPath, settingsTab } from "../../stores"
    import T from "../helpers/T.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"

    $: openedTab = $settingsTab

    // OPEN

    function open(id: Popups) {
        activePopup.set(id)
    }

    function openLog() {
        sendMain(Main.OPEN_LOG)
    }
    function openCache() {
        sendMain(Main.OPEN_CACHE)
    }
    function openAppData() {
        sendMain(Main.OPEN_APPDATA)
    }
    function openUserData() {
        sendMain(Main.OPEN_FOLDER_PATH, $dataPath)
    }
</script>

{#if openedTab === "general"}
    <div class="bottom">
        <MaterialButton variant="outlined" icon="info" on:click={() => open("manage_metadata")} small>
            <T id="popup.manage_metadata" />
        </MaterialButton>
        <MaterialButton variant="outlined" icon="dynamic" on:click={() => open("manage_dynamic_values")} small>
            <T id="popup.manage_dynamic_values" />
        </MaterialButton>
        <MaterialButton variant="outlined" icon="emitter" on:click={() => open("manage_emitters")} small>
            <T id="popup.manage_emitters" />
        </MaterialButton>
        <MaterialButton variant="outlined" icon="star" on:click={() => open("manage_icons")} small>
            <T id="popup.manage_icons" />
        </MaterialButton>
        <MaterialButton variant="outlined" icon="color" on:click={() => open("manage_colors")} small>
            <T id="popup.manage_colors" />
        </MaterialButton>
    </div>
{:else if openedTab === "other"}
    <div class="bottom">
        <MaterialButton variant="outlined" icon="document" on:click={openLog} small>
            <T id="actions.open_error_log" />
        </MaterialButton>
        <MaterialButton variant="outlined" icon="folder" on:click={openCache} small>
            <T id="actions.open_cache_folder" />
        </MaterialButton>
        <MaterialButton variant="outlined" icon="folder" on:click={openAppData} small>
            <T id="actions.open_app_data_folder" />
        </MaterialButton>
        <MaterialButton variant="outlined" icon="folder" on:click={openUserData} small>
            <T id="actions.open_user_data_folder" />
        </MaterialButton>
    </div>
{/if}

<style>
    .bottom {
        display: flex;
        flex-direction: column;
        gap: 2px;

        padding: 5px;
        padding-bottom: 7px;

        overflow-y: auto;
    }

    .bottom :global(button) {
        justify-content: left;
        /* border-width: 0; */
        box-shadow: none;
    }
</style>
