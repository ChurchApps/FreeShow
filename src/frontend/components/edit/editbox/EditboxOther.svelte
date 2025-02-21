<script lang="ts">
    import { onDestroy } from "svelte"
    import type { Item } from "../../../../types/Show"
    import { activeEdit } from "../../../stores"
    import Cam from "../../drawer/live/Cam.svelte"
    import Image from "../../drawer/media/Image.svelte"
    import Icon from "../../helpers/Icon.svelte"
    import { getThumbnailPath, mediaSize } from "../../helpers/media"
    import { getStyles } from "../../helpers/style"
    import Captions from "../../slide/views/Captions.svelte"
    import DynamicEvents from "../../slide/views/DynamicEvents.svelte"
    import ListView from "../../slide/views/ListView.svelte"
    import Mirror from "../../slide/views/Mirror.svelte"
    import SlideProgress from "../../slide/views/SlideProgress.svelte"
    import Timer from "../../slide/views/Timer.svelte"
    import Variable from "../../slide/views/Variable.svelte"
    import Visualizer from "../../slide/views/Visualizer.svelte"
    import Website from "../../slide/views/Website.svelte"
    import Clock from "../../system/Clock.svelte"
    import autosize from "../scripts/autosize"

    export let item: Item
    export let itemElem: HTMLElement

    export let ratio: number
    export let ref: {
        type?: "show" | "overlay" | "template"
        showId?: string
        id: string
    }

    let autoSize: number = 0
    let today = new Date()
    const interval = setInterval(() => (today = new Date()), 1000)
    onDestroy(() => clearInterval(interval))

    $: if (item && itemElem) calculateAutosize()
    let loopStop: any = null
    function calculateAutosize() {
        if (loopStop) return
        loopStop = setTimeout(() => {
            loopStop = null
        }, 200)

        let textQuery = item?.type === "slide_tracker" ? ".progress div" : ""
        // timeout to update size after content change (e.g. Clock seconds)
        setTimeout(() => {
            autoSize = autosize(itemElem, { type: "growToFit", textQuery })
        }, 50)
    }

    let thumbnailPath: string = ""
    $: mediaPath = item.src || ""
    $: if (mediaPath) getThumbnail()
    function getThumbnail() {
        thumbnailPath = getThumbnailPath(mediaPath!, mediaSize.slideSize)
    }

    $: mediaStyleString = `width: 100%;height: 100%;object-fit: ${item?.fit === "blur" ? "contain" : item?.fit || "contain"};filter: ${item?.filter};transform: scale(${item?.flipped ? "-1" : "1"}, ${item?.flippedY ? "-1" : "1"});`
    $: mediaStyleBlurString = `position: absolute;filter: ${item?.filter} blur(6px) opacity(0.3);object-fit: cover;width: 100%;height: 100%;transform: scale(${item?.flipped ? "-1" : "1"}, ${item?.flippedY ? "-1" : "1"});`
</script>

{#if item?.type === "list"}
    <!-- moved to textbox in 1.3.3 -->
    <ListView list={item.list} disableTransition />
{:else if item?.type === "media"}
    {#if thumbnailPath}
        {#if item?.fit === "blur"}
            <Image src={thumbnailPath} alt="" style={mediaStyleBlurString} />
        {/if}
        <Image src={thumbnailPath} alt="" style={mediaStyleString} />
    {/if}
{:else if item?.type === "camera"}
    {#if item.device}
        <Cam cam={item.device} item style="object-fit: {item.fit || 'contain'};filter: {item.filter};transform: scale({item.flipped ? '-1' : '1'}, {item.flippedY ? '-1' : '1'});" />
    {/if}
{:else if item?.type === "timer"}
    <Timer {item} id={item.timerId || ""} {today} style={item.auto === false ? "" : `font-size: ${autoSize}px;`} edit />
{:else if item?.type === "clock"}
    <Clock {autoSize} style={false} {...item.clock} />
{:else if item?.type === "events"}
    <DynamicEvents {...item.events} edit textSize={Number(getStyles(item.style, true)?.["font-size"]) || 80} />
{:else if item?.type === "variable"}
    <!-- moved to textbox in 1.3.3 -->
    <Variable {item} style={item?.style?.includes("font-size") && item.style.split("font-size:")[1].trim()[0] !== "0" ? "" : `font-size: ${autoSize}px;`} ref={{ showId: ref.showId, slideIndex: $activeEdit.slide }} hideText={false} edit />
{:else if item?.type === "web"}
    <Website src={item?.web?.src || ""} {ratio} />
{:else if item?.type === "mirror"}
    <Mirror {item} {ref} {ratio} index={$activeEdit.slide || 0} edit />
{:else if item?.type === "slide_tracker"}
    <SlideProgress tracker={item.tracker || {}} autoSize={item.auto === false ? 0 : autoSize} />
{:else if item?.type === "visualizer"}
    <Visualizer {item} />
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
