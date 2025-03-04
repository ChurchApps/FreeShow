<script lang="ts">
    import { activeRecording, currentRecordingStream, drawerTabsData } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import { mediaRecorderIsPaused, stopMediaRecorder, toggleMediaRecorder } from "./recorder"

    $: active = $drawerTabsData.media?.openedSubSubTab?.screens || "screens"

    let videoElem
    $: if ($currentRecordingStream && videoElem) {
        videoElem.srcObject = $currentRecordingStream
        paused = mediaRecorderIsPaused() || false
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
        <!-- <FolderPicker style="justify-content: flex-start;overflow: hidden;" title={$dataPath} id="DATA">
            <Icon id="folder" right />
            {#if $dataPath}
                {$dataPath}
            {:else}
                <T id="inputs.change_folder" />
            {/if}
        </FolderPicker> -->

        <Button on:click={stopMediaRecorder} center dark>
            <Icon id="export" size={1.2} right />
            <T id="actions.export_recording" />
        </Button>
    </div>
{:else if active === "screens" || active === "windows"}
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
