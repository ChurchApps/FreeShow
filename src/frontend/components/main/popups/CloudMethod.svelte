<script lang="ts">
    import { driveData } from "../../../stores"
    import { syncDrive } from "../../../utils/drive"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    function setMethod(method: "download" | "upload") {
        driveData.update((a) => {
            a.initializeMethod = method
            return a
        })

        syncDrive(true)
    }

    function updateValue(e: any, key: string) {
        let value = e.target.value
        if (!value) return

        driveData.update((a) => {
            a[key] = value
            return a
        })
    }

    let customFolderEnabled: boolean = false
</script>

<p style="max-width: 400px;white-space: normal;"><T id="cloud.choose_method_tip" /></p>

<div>
    <Button on:click={() => setMethod("upload")}>
        <Icon id="export" size={6} />
        <p><Icon id="screen" size={1.2} right /><T id="cloud.local" /></p>
    </Button>
    <Button on:click={() => setMethod("download")}>
        <Icon id="import" size={6} />
        <p><Icon id="cloud" size={1.2} right /><T id="settings.cloud" /></p>
    </Button>
</div>

<br />

{#if customFolderEnabled}
    <CombinedInput>
        <p>
            <T id="cloud.main_folder" />
            <!-- <span style="font-size: 0.7em;opacity: 0.7;display: flex;align-items: center;justify-content: end;overflow: hidden;">drive.google.com/drive/folders/</span> -->
        </p>
        <TextInput style="z-index: 1;" value={$driveData?.mainFolderId || ""} on:change={(e) => updateValue(e, "mainFolderId")} />
    </CombinedInput>
{:else}
    <CombinedInput>
        <p><T id="cloud.enable_custom_folder_id" /></p>
        <div class="alignRight">
            <Checkbox checked={customFolderEnabled} on:change={() => (customFolderEnabled = !customFolderEnabled)} />
        </div>
    </CombinedInput>
{/if}

<style>
    p {
        display: flex;
        align-items: center;
    }

    div {
        display: flex;
        gap: 10px;
        align-self: center;
    }

    div :global(button) {
        width: 200px;
        height: 200px;

        display: flex;
        gap: 10px;
        flex-direction: column;
        justify-content: center;
    }
</style>
