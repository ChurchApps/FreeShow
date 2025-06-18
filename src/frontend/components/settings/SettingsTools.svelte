<script lang="ts">
    import { Main } from "../../../types/IPC/Main"
    import { sendMain } from "../../IPC/main"
    import { activePopup, dataPath, settingsTab } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"

    $: openedTab = $settingsTab

    // OPEN

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
        <Button on:click={() => activePopup.set("manage_groups")}>
            <Icon id="groups" style="margin-inline-start: 0.5em;" right />
            <p><T id="popup.manage_groups" /></p>
        </Button>
        <Button on:click={() => activePopup.set("manage_metadata")}>
            <Icon id="info" style="margin-inline-start: 0.5em;" right />
            <p><T id="popup.manage_metadata" /></p>
        </Button>
        <Button on:click={() => activePopup.set("manage_dynamic_values")}>
            <Icon id="dynamic" style="margin-inline-start: 0.5em;" right />
            <p><T id="popup.manage_dynamic_values" /></p>
        </Button>
        <Button on:click={() => activePopup.set("manage_icons")}>
            <Icon id="star" style="margin-inline-start: 0.5em;" right />
            <p><T id="popup.manage_icons" /></p>
        </Button>
        <Button on:click={() => activePopup.set("manage_colors")}>
            <Icon id="color" style="margin-inline-start: 0.5em;" right />
            <p><T id="popup.manage_colors" /></p>
        </Button>
    </div>
{:else if openedTab === "other"}
    <div class="bottom">
        <Button on:click={openLog}>
            <Icon id="document" style="margin-inline-start: 0.5em;" right />
            <p><T id="actions.open_error_log" /></p>
        </Button>
        <Button on:click={openCache}>
            <Icon id="folder" style="margin-inline-start: 0.5em;" right />
            <p><T id="actions.open_cache_folder" /></p>
        </Button>
        <Button on:click={openAppData}>
            <Icon id="folder" style="margin-inline-start: 0.5em;" right />
            <p><T id="actions.open_app_data_folder" /></p>
        </Button>
        <Button on:click={openUserData}>
            <Icon id="folder" style="margin-inline-start: 0.5em;" right />
            <p><T id="actions.open_user_data_folder" /></p>
        </Button>
    </div>
{/if}

<style>
    .bottom {
        position: absolute;
        bottom: 0;
        inset-inline-start: 0;
        width: 100%;
        background-color: var(--primary-darkest);

        display: flex;
        flex-direction: column;
    }

    .bottom p {
        padding: 0 5px;
    }
</style>
