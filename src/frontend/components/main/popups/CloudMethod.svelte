<script lang="ts">
    import { driveData } from "../../../stores"
    import { syncDrive } from "../../../utils/drive"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    function setMethod(method: "download" | "upload") {
        driveData.update((a) => {
            a.initializeMethod = method
            return a
        })

        syncDrive(true)
    }
</script>

<p style="max-width: 400px;white-space: normal;"><T id="cloud.choose_method_tip" /></p>

<div>
    <Button on:click={() => setMethod("upload")}>
        <Icon id="upload" size={6} />
        <p><Icon id="screen" size={1.2} right /><T id="cloud.local" /></p>
    </Button>
    <Button on:click={() => setMethod("download")}>
        <Icon id="download" size={6} />
        <p><Icon id="cloud" size={1.2} right /><T id="settings.cloud" /></p>
    </Button>
</div>

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
