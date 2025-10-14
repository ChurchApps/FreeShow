<script lang="ts">
    import type { MediaStyle } from "../../../../types/Main"
    import { activeEdit, activeShow, media, outputs, styles } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import { getExtension, getMediaStyle, getMediaType } from "../../helpers/media"
    import { getActiveOutputs, getCurrentStyle } from "../../helpers/output"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Media from "../../output/layers/Media.svelte"
    import VideoSlider from "../../output/VideoSlider.svelte"

    $: path = $activeEdit.id || $activeShow!.id

    $: extension = getExtension(path)
    $: type = getMediaType(extension)

    let videoTime = 0
    let videoData = { paused: false, muted: true, duration: 0, loop: true }

    $: outputId = getActiveOutputs($outputs, false, true, true)[0]
    $: outputStyle = getCurrentStyle($styles, $outputs[outputId]?.style)

    // get styling
    let mediaStyle: MediaStyle = {}
    $: mediaId = $activeEdit.id && $activeEdit.type === "media" ? $activeEdit.id : $activeShow?.id && ($activeShow.type === "image" || $activeShow.type === "video") ? $activeShow.id : ""
    $: if (mediaId) mediaStyle = getMediaStyle($media[mediaId], outputStyle)
</script>

<div class="parent" style="display: flex;flex-direction: column;height: 100%;">
    <div class="media" style="flex: 1;overflow: hidden;position: relative;">
        <Media {path} {mediaStyle} bind:videoData bind:videoTime mirror />

        {#if type === "video"}
            <FloatingInputs side="center" style="width: 60%;">
                <MaterialButton title={videoData.paused ? "media.play" : "media.pause"} on:click={() => (videoData.paused = !videoData.paused)}>
                    <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} size={1.3} />
                </MaterialButton>

                <div class="divider" />

                <VideoSlider bind:videoData bind:videoTime big />

                <div class="divider" />

                <MaterialButton title="media._loop" disabled>
                    <Icon id="loop" size={1.2} />
                </MaterialButton>
            </FloatingInputs>
        {/if}
    </div>
</div>
