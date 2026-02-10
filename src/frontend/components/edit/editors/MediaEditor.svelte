<script lang="ts">
    import type { MediaStyle } from "../../../../types/Main"
    import { activeEdit, activeShow, media, outputs, styles } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import { getExtension, getMedia, getMediaStyle, getMediaType } from "../../helpers/media"
    import { getCurrentStyle, getFirstActiveOutput, getResolution } from "../../helpers/output"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Media from "../../output/layers/Media.svelte"
    import VideoSlider from "../../output/VideoSlider.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Zoomed from "../../slide/Zoomed.svelte"

    $: path = $activeEdit.id || $activeShow!.id

    let mediaPath = ""

    // LOAD MEDIA

    $: if (path) loadMedia()
    async function loadMedia() {
        mediaPath = path

        const media = await getMedia(path)
        if (!media) return

        mediaPath = media.path
    }

    let width = 0
    let height = 0
    $: resolution = getResolution(null, { $outputs, $styles })
    $: widthOrHeight = getStyleResolution(resolution, width, height, "fit")

    $: extension = getExtension(mediaPath)
    $: type = getMediaType(extension)

    let videoTime = 0
    let videoData = { paused: false, muted: true, duration: 0, loop: true }

    $: outputStyle = getCurrentStyle($styles, getFirstActiveOutput($outputs)?.style)

    // get styling
    let mediaStyle: MediaStyle = {}
    $: mediaId = $activeEdit.id && $activeEdit.type === "media" ? $activeEdit.id : $activeShow?.id && ($activeShow.type === "image" || $activeShow.type === "video") ? $activeShow.id : ""
    $: if (mediaId) mediaStyle = getMediaStyle($media[mediaId], outputStyle)
</script>

<div class="parent" style="display: flex;flex-direction: column;height: 100%;" bind:offsetWidth={width} bind:offsetHeight={height}>
    <Zoomed background="transparent" {resolution} checkered={mediaStyle.fit === "contain"} border style={widthOrHeight}>
        <Media path={mediaPath} {mediaStyle} bind:videoData bind:videoTime mirror />
    </Zoomed>

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

<style>
    .parent :global(.zoomed) {
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>
