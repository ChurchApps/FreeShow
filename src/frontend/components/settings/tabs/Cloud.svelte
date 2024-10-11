<script lang="ts">
    import { MAIN } from "../../../../types/Channels"
    import { activePopup, driveData, driveKeys } from "../../../stores"
    import { syncDrive } from "../../../utils/drive"
    import { send } from "../../../utils/request"
    import { save } from "../../../utils/save"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Link from "../../inputs/Link.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    function getKeysFile() {
        activePopup.set("cloud_update")
        send(MAIN, ["OPEN_FILE"], { channel: "GOOGLE_KEYS", id: "keys", title: "Select keys file", filter: { name: "JSON", extensions: ["json"] }, multiple: false, read: true })
    }

    $: validKeys = typeof $driveKeys === "object" && Object.keys($driveKeys).length

    function updateValue(e: any, key: string) {
        let value = e.target.value
        if (key === "mediaId" && !value) value = "default"
        if (!value) return

        // mainFolderId: It seems the character length is 33 for drive folders and 44 for files.
        driveData.update((a) => {
            a[key] = value
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

<div class="info">
    <p><T id="cloud.info" /></p>
</div>

<CombinedInput>
    <p><T id="cloud.enable" /></p>
    <div class="alignRight">
        <Checkbox checked={!$driveData.disabled} on:change={(e) => toggleData(e, "disabled", true)} />
    </div>
</CombinedInput>

<CombinedInput>
    <p><T id="cloud.disable_upload" /></p>
    <div class="alignRight">
        <Checkbox checked={$driveData.disableUpload} on:change={(e) => toggleData(e, "disableUpload")} />
    </div>
</CombinedInput>

<CombinedInput>
    <p>
        <T id="cloud.media_id" />
    </p>
    <TextInput style="z-index: 1;" value={$driveData?.mediaId || "default"} on:change={(e) => updateValue(e, "mediaId")} />
</CombinedInput>

<CombinedInput>
    <p><T id="cloud.google_drive_api" /></p>
    <Button on:click={getKeysFile}>
        <Icon id="key" style="margin-left: 0.5em;" right />
        <p>
            {#if validKeys}
                <T id="cloud.update_key" />
            {:else}
                <T id="cloud.select_key" />
            {/if}
        </p>
    </Button>
</CombinedInput>

{#if validKeys}
    <CombinedInput>
        <p>
            <T id="cloud.main_folder" />
            <span style="font-size: 0.7em;opacity: 0.7;display: flex;align-items: center;justify-content: end;overflow: hidden;">drive.google.com/drive/folders/</span>
        </p>
        <TextInput style="z-index: 1;" value={$driveData?.mainFolderId || ""} on:change={(e) => updateValue(e, "mainFolderId")} />
    </CombinedInput>
    <!-- TODO: media folder -->
    <!-- <div>
        <p><T id="cloud.media_folder" /></p>
        <span style="display: flex;align-items: center;overflow: auto;">
            <p style="font-size: 0.9em;opacity: 0.7;">drive.google.com/drive/folders/</p>
            <TextInput style="width: 300px;padding: 3px;border-bottom: 2px solid var(--secondary);background-color: var(--primary-darkest);" value={$driveData?.mediaFolderId || ""} on:change={updateMediaFolder} />
        </span>
    </div> -->

    <CombinedInput>
        <Button
            on:click={() => {
                save()
                setTimeout(() => syncDrive(true), 2000)
            }}
            disabled={!validKeys}
            style="width: 100%;"
            center
        >
            <Icon id="cloud_sync" right />
            <T id="cloud.sync" />
        </Button>
    </CombinedInput>
    <!-- Probably never used: -->
    <!-- <CombinedInput>
        <Button on:click={() => driveConnect($driveKeys)} disabled={!validKeys} style="width: 100%;" center>
            <Icon id="refresh" right />
            <T id="cloud.reconnect" />
        </Button>
    </CombinedInput> -->
{:else}
    <br />
    <span class="guide">
        <!-- Keep in mind you have a 750 GB limit per day, and 20,000 queries per second which should be plenty. -->
        <p><T id="cloud.tip_api" /></p>
        <p><T id="cloud.tip_how" />&nbsp;<Link url={"https://freeshow.app/docs/drive"}><T id="cloud.tip_guide" /></Link></p>
    </span>
{/if}

<div class="filler" />
<div class="bottom">
    <Button style="width: 100%;" on:click={reset} center>
        <Icon id="reset" right />
        <T id="actions.reset" />
    </Button>
</div>

<style>
    .info {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        min-height: 38px;
        margin: 5px 0;
        margin-bottom: 15px;
        font-style: italic;
        opacity: 0.8;
    }

    .info p {
        white-space: initial;
    }

    .guide p {
        white-space: normal;
        /* font-style: italic; */
        opacity: 0.8;
    }

    .filler {
        height: 48px;
    }
    .bottom {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        background-color: var(--primary-darkest);

        display: flex;
        flex-direction: column;
    }
</style>
