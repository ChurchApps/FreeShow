<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { currentWindow, volume } from "../../../stores"
    import Image from "../../drawer/media/Image.svelte"
    import { encodeFilePath, getExtension, getMediaType, loadThumbnail, mediaSize } from "../../helpers/media"

    export let item: Item

    export let preview: boolean = false
    export let mirror: boolean = true
    export let edit: boolean = false

    let mediaItemPath = ""
    $: if (item?.type === "media") getMediaItemPath()
    async function getMediaItemPath() {
        mediaItemPath = ""
        if (!item.src) return

        // only load thumbnails in main
        if ($currentWindow || preview) {
            mediaItemPath = item.src
            return
        }

        // if (edit) mediaItemPath = getThumbnailPath(item.src, mediaSize.slideSize)
        mediaItemPath = await loadThumbnail(item.src, mediaSize.slideSize)
    }

    $: mediaStyleString = `filter: ${item?.filter};object-fit: ${item?.fit === "blur" ? "contain" : item?.fit || "contain"};`
    $: mediaStyleBlurString = `position: absolute;filter: ${item?.filter || ""} blur(6px) opacity(0.3);object-fit: cover;`
    $: mediaStyleCombinedString = `width: 100%;height: 100%;transform: scale(${item?.flipped ? "-1" : "1"}, ${item?.flippedY ? "-1" : "1"});${edit ? "pointer-events: none;" : ""}`
</script>

{#if mediaItemPath}
    {#if ($currentWindow || preview) && getMediaType(getExtension(mediaItemPath)) === "video"}
        {#if item.fit === "blur"}
            <video src={encodeFilePath(mediaItemPath)} style="{mediaStyleBlurString}{mediaStyleCombinedString}" muted autoplay loop />
        {/if}
        <video src={encodeFilePath(mediaItemPath)} style="{mediaStyleString}{mediaStyleCombinedString}" muted={mirror || item.muted} volume={AudioPlayer.getVolume(null, $volume)} autoplay loop>
            <track kind="captions" />
        </video>
    {:else}
        <!-- WIP image flashes when loading new image (when changing slides with the same image) -->
        <!-- TODO: use custom transition... -->
        {#if item.fit === "blur"}
            <Image style="{mediaStyleBlurString}{mediaStyleCombinedString}" src={mediaItemPath} alt="" transition={!edit && item.actions?.transition?.duration && item.actions?.transition?.type !== "none"} />
        {/if}
        <Image style="{mediaStyleString}{mediaStyleCombinedString}" src={mediaItemPath} alt="" transition={!edit && item.actions?.transition?.duration && item.actions?.transition?.type !== "none"} />
    {/if}
{/if}
