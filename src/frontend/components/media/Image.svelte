<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { MediaStyle } from "../../../types/Main"
    import { cropImageToBase64, encodeFilePath } from "../helpers/media"

    export let path: string
    export let mediaStyle: MediaStyle = {}

    let dispatch = createEventDispatcher()
    function loaded() {
        dispatch("loaded", true)
    }

    $: mediaStyleString = `width: 100%;height: 100%;object-fit: ${mediaStyle.fit === "blur" ? "contain" : mediaStyle.fit || "contain"};filter: ${mediaStyle.filter || ""};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});image-rendering: ${mediaStyle.rendering || "initial"};`
    $: mediaStyleBlurString = `position: absolute;filter: ${mediaStyle.filter || ""} blur(${mediaStyle.fitOptions?.blurAmount ?? 6}px) opacity(${mediaStyle.fitOptions?.blurOpacity || 0.3});object-fit: cover;width: 100%;height: 100%;transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});image-rendering: ${mediaStyle.rendering || "initial"};`

    let croppedImage = ""
    $: croppingActive = mediaStyle.cropping?.bottom || mediaStyle.cropping?.left || mediaStyle.cropping?.top || mediaStyle.cropping?.right
    $: if (croppingActive) cropImage()
    async function cropImage() {
        croppedImage = await cropImageToBase64(path, mediaStyle.cropping)
    }
</script>

{#if mediaStyle.fit === "blur"}
    <img class="media" style={mediaStyleBlurString} src={croppingActive ? croppedImage : encodeFilePath(path)} alt="" draggable="false" />
{/if}
<img class="media" style={mediaStyleString} src={croppingActive ? croppedImage : encodeFilePath(path)} alt="" draggable="false" on:error on:load={loaded} />

<style>
    /* hide alt text */
    img {
        text-indent: 100%;
        white-space: nowrap;
        overflow: hidden;

        position: absolute;
        top: 0;
        left: 0;
    }
</style>
