<script lang="ts">
    import type { MediaStyle } from "../../../../types/Main"
    import { activeEdit, activeShow, media, outputs, styles } from "../../../stores"
    import { getExtension, getMediaStyle, getMediaType } from "../../helpers/media"
    import { getActiveOutputs, getCurrentStyle } from "../../helpers/output"
    import MediaControls from "../../media/MediaControls.svelte"
    import Media from "../../output/layers/Media.svelte"

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
            <MediaControls bind:videoData bind:videoTime />
        {/if}
    </div>
</div>

<style>
    .parent :global(.slider input) {
        background-color: var(--primary);
    }
</style>
