<script lang="ts">
    import { activeRecording, currentRecordingStream, recordingPath } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import FolderPicker from "../../inputs/FolderPicker.svelte"
    import { stopMediaRecorder, toggleMediaRecorder } from "./recorder"

    let videoElem
    $: if ($currentRecordingStream && videoElem) {
        videoElem.srcObject = $currentRecordingStream
        paused = false
    }

    let paused = false
    $: paused ? videoElem?.pause() : videoElem?.play()
</script>

{#if $activeRecording}
    <div class="scroll">
        <video bind:this={videoElem}>
            <track kind="captions" />
        </video>

        <Button style="flex: 0" center on:click={() => (paused = toggleMediaRecorder())} dark>
            <Icon id={paused ? "play" : "pause"} white={paused} size={1.2} right />
            <T id={paused ? "popup.continue" : "media.pause"} />
        </Button>
    </div>

    <div class="bottom">
        <FolderPicker style="justify-content: flex-start;overflow: hidden;" title={$recordingPath} id="RECORDING">
            <Icon id="folder" right />
            {#if $recordingPath}
                {$recordingPath}
            {:else}
                <T id="inputs.change_folder" />
            {/if}
        </FolderPicker>

        <Button on:click={stopMediaRecorder} center dark>
            <Icon id="export" size={1.2} right />
            <T id="export.export" />
        </Button>
    </div>
{:else}
    <div class="scroll" style="padding: 10px;">
        <T id="empty.recording" />
    </div>
{/if}

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    video {
        background-color: black;
        aspect-ratio: 16/9;
    }

    .bottom {
        display: flex;
        flex-direction: column;
    }
</style>
