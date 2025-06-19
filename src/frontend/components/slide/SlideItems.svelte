<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import type { Item } from "../../../types/Show"
    import { currentWindow, slidesOptions } from "../../stores"
    import Cam from "../drawer/live/Cam.svelte"
    import autosize from "../edit/scripts/autosize"
    import { getStyles } from "../helpers/style"
    import Clock from "../system/Clock.svelte"
    import Captions from "./views/Captions.svelte"
    import DynamicEvents from "./views/DynamicEvents.svelte"
    import IconItem from "./views/IconItem.svelte"
    import ListView from "./views/ListView.svelte"
    import MediaItem from "./views/MediaItem.svelte"
    import Mirror from "./views/Mirror.svelte"
    import SlideProgress from "./views/SlideProgress.svelte"
    import Timer from "./views/Timer.svelte"
    import Variable from "./views/Variable.svelte"
    import Visualizer from "./views/Visualizer.svelte"
    import Website from "./views/Website.svelte"
    import Weather from "./views/Weather.svelte"

    export let item: Item

    export let edit = false
    export let itemElem: HTMLElement | undefined = undefined

    export let slideIndex = 0
    export let preview = false
    export let mirror = true
    export let isMirrorItem = false
    export let disableListTransition = false
    export let smallFontSize = false
    export let fontSize = 0

    export let ratio = 1
    export let ref: {
        type?: "show" | "stage" | "overlay" | "template"
        showId?: string
        slideId?: string
        layoutId?: string
        id: string
    }

    // timer updater
    let today = new Date()
    let dateInterval: NodeJS.Timeout | null = null
    onMount(() => {
        if (item.type !== "timer") return
        dateInterval = setInterval(() => (today = new Date()), 500)
    })
    onDestroy(() => {
        if (dateInterval) clearInterval(dateInterval)
    })

    // AUTO SIZE

    $: if (edit && item && itemElem) calculateAutosize()
    let autoSize = 0
    let loopStop: NodeJS.Timeout | null = null
    function calculateAutosize() {
        if (loopStop) return
        loopStop = setTimeout(() => {
            loopStop = null
        }, 200)

        let textQuery = item.type === "slide_tracker" ? ".progress div" : ""
        // timeout to update size after content change (e.g. Clock seconds)
        setTimeout(() => {
            autoSize = autosize(itemElem!, { type: "growToFit", textQuery })
        }, 50)
    }

    $: cameraStyleString = `object-fit: ${item.fit || "contain"};filter: ${item.filter};transform: scale(${item.flipped ? "-1" : "1"}, ${item.flippedY ? "-1" : "1"});`
    $: variableStyleString = item.style?.includes("font-size") && item.style.split("font-size:")[1].trim()[0] !== "0" ? "" : `font-size: ${edit ? autoSize : fontSize}px;`
</script>

{#if item.type === "media"}
    <MediaItem {item} {preview} {mirror} {edit} />
{:else if item.type === "web"}
    <Website src={item.web?.src || ""} navigation={!edit && !item.web?.noNavigation} clickable={!edit && $currentWindow === "output"} {ratio} />
{:else if item.type === "timer"}
    <Timer {item} id={item.timer?.id || item.timerId || ""} {today} style={item.auto === false ? "" : `font-size: ${edit ? autoSize : fontSize}px;`} {edit} />
{:else if item.type === "clock"}
    <Clock autoSize={edit ? autoSize : fontSize} style={false} {...item.clock} />
{:else if item.type === "camera"}
    {#if item.device}
        <Cam cam={item.device} item style={cameraStyleString} />
    {/if}
{:else if item.type === "slide_tracker"}
    <SlideProgress tracker={item.tracker || {}} autoSize={item.auto === false ? 0 : edit ? autoSize : fontSize} />
{:else if item.type === "events"}
    <DynamicEvents {...item.events} textSize={smallFontSize ? (-1.1 * $slidesOptions.columns + 10) * 5 : Number(getStyles(item.style, true)?.["font-size"]) || 80} />
{:else if item.type === "weather"}
    <Weather data={item.weather || {}} />
{:else if item.type === "mirror"}
    <!-- no mirrors in mirrors! -->
    {#if !isMirrorItem}
        <Mirror {item} {ref} {ratio} index={slideIndex} {edit} />
    {/if}
{:else if item.type === "visualizer"}
    <Visualizer {item} {preview} {edit} />
{:else if item.type === "captions"}
    <Captions {item} />
{:else if item.type === "icon"}
    <IconItem {item} {ratio} />
{:else if item.type === "list"}
    <!-- moved to textbox in 1.3.3 -->
    <ListView list={item.list} disableTransition={edit || disableListTransition} />
{:else if item.type === "variable"}
    <!-- moved to textbox in 1.3.3 -->
    <Variable {item} style={variableStyleString} ref={{ ...ref, slideIndex }} hideText={edit ? false : (ref.type === "stage" && !!$currentWindow) || preview} {edit} />
{/if}
