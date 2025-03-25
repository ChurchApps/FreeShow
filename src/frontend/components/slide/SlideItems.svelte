<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import type { Item } from "../../../types/Show"
    import { currentWindow, slidesOptions, variables, volume } from "../../stores"
    import Cam from "../drawer/live/Cam.svelte"
    import Image from "../drawer/media/Image.svelte"
    import Icon from "../helpers/Icon.svelte"
    import { encodeFilePath, getExtension, getMediaType, loadThumbnail, mediaSize } from "../helpers/media"
    import { getStyles } from "../helpers/style"
    import Clock from "../system/Clock.svelte"
    import Captions from "./views/Captions.svelte"
    import DynamicEvents from "./views/DynamicEvents.svelte"
    import ListView from "./views/ListView.svelte"
    import Mirror from "./views/Mirror.svelte"
    import SlideProgress from "./views/SlideProgress.svelte"
    import Timer from "./views/Timer.svelte"
    import Variable from "./views/Variable.svelte"
    import Visualizer from "./views/Visualizer.svelte"
    import Website from "./views/Website.svelte"

    export let item: Item
    export let slideIndex: number = 0
    export let preview: boolean = false
    export let mirror: boolean = true
    export let isMirrorItem: boolean = false
    export let ratio: number = 1
    export let disableListTransition: boolean = false
    export let smallFontSize: boolean = false
    export let ref: {
        type?: "show" | "stage" | "overlay" | "template"
        showId?: string
        slideId?: string
        layoutId?: string
        id: string
    }
    export let fontSize: number = 0

    // timer updater
    let today = new Date()
    let dateInterval: NodeJS.Timeout | null = null
    onMount(() => {
        if (item?.type !== "timer") return
        dateInterval = setInterval(() => (today = new Date()), 500)
    })
    onDestroy(() => {
        clearInterval(dynamicInterval)
        if (dateInterval) clearInterval(dateInterval)
    })

    // MEDIA

    let mediaItemPath = ""
    $: if (item?.type === "media" && item.src) getMediaItemPath()
    async function getMediaItemPath() {
        mediaItemPath = ""
        if (!item.src) return

        // only load thumbnails in main
        if ($currentWindow || preview) {
            mediaItemPath = item.src
            return
        }

        mediaItemPath = await loadThumbnail(item.src, mediaSize.slideSize)
    }

    // UPDATE DYNAMIC VALUES e.g. {time_} EVERY SECOND
    let updateDynamic = 0
    $: if ($variables) updateDynamic++
    const dynamicInterval = setInterval(() => {
        updateDynamic++
    }, 1000)

    $: mediaStyleString = `width: 100%;height: 100%;object-fit: ${item?.fit === "blur" ? "contain" : item?.fit || "contain"};filter: ${item?.filter};transform: scale(${item?.flipped ? "-1" : "1"}, ${item?.flippedY ? "-1" : "1"});`
    $: mediaStyleBlurString = `position: absolute;filter: ${item?.filter || ""} blur(6px) opacity(0.3);object-fit: cover;width: 100%;height: 100%;transform: scale(${item?.flipped ? "-1" : "1"}, ${item?.flippedY ? "-1" : "1"});`
</script>

{#if item?.type === "list"}
    <!-- moved to textbox in 1.3.3 -->
    <ListView list={item.list} disableTransition={disableListTransition} />
{:else if item?.type === "media"}
    {#if mediaItemPath}
        {#if ($currentWindow || preview) && getMediaType(getExtension(mediaItemPath)) === "video"}
            {#if item.fit === "blur"}
                <video src={encodeFilePath(mediaItemPath)} style={mediaStyleBlurString} muted autoplay loop />
            {/if}
            <video src={encodeFilePath(mediaItemPath)} style={mediaStyleString} muted={mirror || item.muted} volume={Math.max(1, $volume)} autoplay loop>
                <track kind="captions" />
            </video>
        {:else}
            <!-- WIP image flashes when loading new image (when changing slides with the same image) -->
            <!-- TODO: use custom transition... -->
            {#if item.fit === "blur"}
                <Image style={mediaStyleBlurString} src={mediaItemPath} alt="" transition={item.actions?.transition?.duration && item.actions?.transition?.type !== "none"} />
            {/if}
            <Image src={mediaItemPath} alt="" style={mediaStyleString} transition={item.actions?.transition?.duration && item.actions?.transition?.type !== "none"} />
        {/if}
    {/if}
{:else if item?.type === "camera"}
    {#if item.device}
        <Cam cam={item.device} item style="object-fit: {item.fit || 'contain'};filter: {item.filter};transform: scale({item.flipped ? '-1' : '1'}, {item.flippedY ? '-1' : '1'});" />
    {/if}
{:else if item?.type === "timer"}
    <Timer {item} id={item.timerId || ""} {today} style={item.auto === false ? "" : `font-size: ${fontSize}px;`} />
{:else if item?.type === "clock"}
    <Clock autoSize={fontSize} style={false} {...item.clock} />
{:else if item?.type === "events"}
    <DynamicEvents {...item.events} textSize={smallFontSize ? (-1.1 * $slidesOptions.columns + 10) * 5 : Number(getStyles(item.style, true)?.["font-size"]) || 80} />
{:else if item?.type === "variable"}
    <!-- moved to textbox in 1.3.3 -->
    <Variable {item} style={item?.style?.includes("font-size") && item.style.split("font-size:")[1].trim()[0] !== "0" ? "" : `font-size: ${fontSize}px;`} ref={{ ...ref, slideIndex }} />
{:else if item?.type === "web"}
    <Website src={item?.web?.src || ""} navigation={!item?.web?.noNavigation} clickable={$currentWindow === "output"} {ratio} />
{:else if item?.type === "mirror"}
    <!-- no mirrors in mirrors! -->
    {#if !isMirrorItem}
        <Mirror {item} {ref} {ratio} index={slideIndex} />
    {/if}
{:else if item?.type === "slide_tracker"}
    <SlideProgress tracker={item.tracker || {}} autoSize={item.auto === false ? 0 : fontSize} />
{:else if item?.type === "visualizer"}
    <Visualizer {item} {preview} />
{:else if item?.type === "captions"}
    <Captions {item} />
{:else if item?.type === "icon"}
    {#if item.customSvg}
        <div class="customIcon" class:customColor={item?.style.includes("color:") && !item?.style.includes("color:#FFFFFF;")}>
            {@html item.customSvg}
        </div>
    {:else}
        <Icon style="zoom: {1 / ratio};" id={item.id || ""} fill white custom />
    {/if}
{/if}

<style>
    /* custom svg icon */

    .customIcon,
    .customIcon :global(svg) {
        width: 100%;
        height: 100%;
    }
    .customIcon.customColor :global(svg path) {
        fill: currentColor;
    }
</style>
