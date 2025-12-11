<script lang="ts">
    import { driveData } from "../../../stores"
    import { syncDrive } from "../../../utils/drive"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    function setMethod(method: "download" | "upload") {
        driveData.update((a) => {
            a.initializeMethod = method
            return a
        })

        syncDrive(true)
    }

    function updateValue(value: string, key: string) {
        if (value === undefined) return

        driveData.update((a) => {
            a[key] = value
            return a
        })
    }

    let customFolderEnabled = false
</script>

<p style="max-width: 600px;white-space: normal;margin-bottom: 10px;opacity: 0.9;"><T id="cloud.choose_method_tip" /></p>

<div class="choice" style="margin: 10px 0;">
    <MaterialButton variant="outlined" on:click={() => setMethod("upload")}>
        <Icon id="export" size={6} />
        <p><Icon id="screen" size={1.2} white /><T id="cloud.local" /></p>
    </MaterialButton>
    <MaterialButton variant="outlined" on:click={() => setMethod("download")}>
        <Icon id="import" size={6} />
        <p><Icon id="cloud" size={1.2} white /><T id="settings.cloud" /></p>
    </MaterialButton>
</div>

<MaterialToggleSwitch label="cloud.enable_custom_folder_id" checked={customFolderEnabled} defaultValue={false} on:change={(e) => (customFolderEnabled = e.detail)} />

{#if customFolderEnabled}
    <MaterialTextInput label="cloud.main_folder{$driveData?.mainFolderId ? `<span style="margin-left: 10px;font-size: 0.7em;opacity: 0.5;color: var(--text);">drive.google.com/drive/folders/</span>` : ''}" value={$driveData?.mainFolderId || ""} defaultValue="" on:change={(e) => updateValue(e.detail, "mainFolderId")} />
{/if}

<style>
    .choice {
        display: flex;
        justify-content: center; /* space-evenly; */
        flex-wrap: wrap;
        width: 100%;

        gap: 9px;

        border-radius: 8px;
        background-color: var(--primary-darker);
        padding: 10px;
    }

    .choice :global(button) {
        flex: 1;
        aspect-ratio: 1;
        min-width: 160px;
        max-width: 280px;

        /* border-radius: 0; */

        gap: 12px;
        flex-direction: column;
    }

    .choice p {
        display: flex;
        align-items: center;
        gap: 10px;
    }
</style>
