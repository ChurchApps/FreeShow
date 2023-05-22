<script lang="ts">
    import { OPEN_FILE } from "../../../../types/Channels"
    import { activePopup, driveData, driveKeys } from "../../../stores"
    import { driveConnect, syncDrive } from "../../../utils/drive"
    import { save } from "../../../utils/save"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Link from "../../inputs/Link.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    function getKeysFile() {
        activePopup.set("cloud_update")
        window.api.send(OPEN_FILE, { channel: "GOOGLE_KEYS", title: "Select keys file", filter: { name: "JSON", extensions: ["json"] }, multiple: false, read: true })
    }

    $: validKeys = typeof $driveKeys === "object" && Object.keys($driveKeys).length

    function updateMainFolder(e: any) {
        let value = e.target.value
        if (!value) return

        // It seems the character length is 33 for drive folders and 44 for files.
        driveData.update((a) => {
            a.mainFolderId = value
            return a
        })
    }

    function toggleData(e: any, key, invert: boolean = false) {
        let checked: boolean = e.target.checked || false

        driveData.update((a) => {
            a[key] = invert ? !checked : checked
            return a
        })
    }

    function reset() {
        driveKeys.set({})
        driveData.set({ mainFolderId: null, disabled: false, initializeMethod: null, disableUpload: false })
    }
</script>

<div style="justify-content: center;flex-direction: column;font-style: italic;opacity: 0.8;">
    <p><T id="cloud.info" /></p>
</div>

<div>
    <p><T id="cloud.enable" /></p>
    <span>
        <Checkbox checked={!$driveData.disabled} on:change={(e) => toggleData(e, "disabled", true)} />
    </span>
</div>

<div>
    <p><T id="cloud.disable_upload" /></p>
    <span>
        <Checkbox checked={$driveData.disableUpload} on:change={(e) => toggleData(e, "disableUpload")} />
    </span>
</div>

<div>
    <p><T id="cloud.google_drive_api" /></p>
    <span>
        <Button on:click={getKeysFile}>
            <Icon id="key" right />
            {#if validKeys}
                <T id="cloud.update_key" />
            {:else}
                <T id="cloud.select_key" />
            {/if}
        </Button>
    </span>
</div>

{#if validKeys}
    <div>
        <p><T id="cloud.main_folder" /></p>
        <span style="display: flex;align-items: center;overflow: auto;">
            <p style="font-size: 0.9em;opacity: 0.7;">drive.google.com/drive/folders/</p>
            <TextInput style="width: 300px;padding: 3px;border-bottom: 2px solid var(--secondary);background-color: var(--primary-darkest);" value={$driveData?.mainFolderId || ""} on:change={updateMainFolder} />
        </span>
    </div>
    <!-- TODO: media folder -->
    <!-- <div>
        <p><T id="cloud.media_folder" /></p>
        <span style="display: flex;align-items: center;overflow: auto;">
            <p style="font-size: 0.9em;opacity: 0.7;">drive.google.com/drive/folders/</p>
            <TextInput style="width: 300px;padding: 3px;border-bottom: 2px solid var(--secondary);background-color: var(--primary-darkest);" value={$driveData?.mediaFolderId || ""} on:change={updateMediaFolder} />
        </span>
    </div> -->
{:else}
    <span class="guide">
        <!-- Keep in mind you have a 750 GB limit per day, and 20,000 queries per second which should be plenty. -->
        <p><T id="cloud.tip_api" /></p>
        <p><T id="cloud.tip_how" />&nbsp;<Link url={"https://freeshow.app/docs/drive"}><T id="cloud.tip_guide" /></Link></p>
    </span>
{/if}

<hr />

<div style="display: flex;flex-direction: column;">
    <Button
        on:click={() => {
            save()
            setTimeout(() => {
                syncDrive(true)
            }, 1000)
        }}
        disabled={!validKeys}
        style="width: 100%;"
        center
    >
        <Icon id="cloud_sync" right />
        <T id="cloud.sync" />
    </Button>
    <Button on:click={() => driveConnect($driveKeys)} disabled={!validKeys} style="width: 100%;" center>
        <Icon id="refresh" right />
        <T id="cloud.reconnect" />
    </Button>
    <br />
    <Button on:click={reset} style="width: 100%;" center>
        <Icon id="reset" right />
        <T id="actions.reset" />
    </Button>
</div>

<style>
    div {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 5px 0;
        /* height: 35px; */
        min-height: 38px;
    }

    hr {
        margin: 20px 0;
        border: none;
        height: 2px;
        background-color: var(--primary-lighter);
    }

    .guide p {
        white-space: normal;
        /* font-style: italic; */
        opacity: 0.8;
    }
</style>
