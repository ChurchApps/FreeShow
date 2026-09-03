<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import type { Item } from "../../../types/Show"
    import { currentWindow, slidesOptions } from "../../stores"
    import MetronomeVisualizer from "../drawer/audio/MetronomeVisualizer.svelte"
    import Cam from "../drawer/live/Cam.svelte"
    import autosize from "../edit/scripts/autosize"
    import { getStyles } from "../helpers/style"
    import { getCropState } from "../helpers/cropping"
    import Clock from "../system/Clock.svelte"
    import Captions from "./views/Captions.svelte"
    import Chart from "./views/Chart.svelte"
    import DynamicEvents from "./views/DynamicEvents.svelte"
    import IconItem from "./views/IconItem.svelte"
    import MediaItem from "./views/MediaItem.svelte"
    import SlideProgress from "./views/SlideProgress.svelte"
    import Table from "./views/Table.svelte"
    import Timer from "./views/Timer.svelte"
    import Variable from "./views/Variable.svelte"
    import Visualizer from "./views/Visualizer.svelte"
    import Weather from "./views/Weather.svelte"
    import Website from "./views/Website.svelte"

    export let item: Item

    export let edit = false
    export let itemElem: HTMLElement | undefined = undefined

    export let slideIndex = 0
    export let preview = false
    export let cropPreviewMode = false
    export let isTemplatePreview = false
    export let smallFontSize = false
    export let fontSize = 0
    export let outputId = ""

    export let ratio = 1
    export let index = -1
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

    $: noAutoSize = item.auto === false && item.textFit === "none"

    let previousItem = "{}"
    $: newItem = JSON.stringify(item)

    // this only applies to the stage slide editor
    $: if (edit && item && itemElem && !noAutoSize && newItem !== previousItem) calculateAutosize()
    let autoSize = 0
    let autosizeTimeout: NodeJS.Timeout | null = null
    function calculateAutosize() {
        previousItem = newItem
        if (autosizeTimeout) clearTimeout(autosizeTimeout)
        autosizeTimeout = setTimeout(() => {
            autosizeTimeout = null
            if (!itemElem) return
            let textQuery = item.type === "slide_tracker" ? ".progress div" : ""
            autoSize = autosize(itemElem!, { type: "growToFit", textQuery })
        }, 50)
    }

    $: cameraCropState = getCropState(item.cropping, cropPreviewMode, item.style)
    $: cameraStyleString = `${cameraCropState.mediaCropGeometry}object-fit: ${cameraCropState.cropHasValues ? (item.fit === "cover" ? "cover" : "fill") : (item.fit || "contain")};filter: ${item.filter};transform: scale(${item.flipped ? "-1" : "1"}, ${item.flippedY ? "-1" : "1"});`
    $: variableStyleString = typeof item.style === "string" ? (item.style.includes("font-size") && item.style.split("font-size:")[1].trim()[0] !== "0" ? "" : `font-size: ${edit ? autoSize : fontSize}px;`) : ""
</script>

{#if item.type === "media"}
    <MediaItem {item} {outputId} slideRef={{ ...ref, slideIndex }} {preview} {edit} {cropPreviewMode} />
{:else if item.type === "web"}
    <Website src={item.web?.src || ""} navigation={!edit && !item.web?.noNavigation} clickable={!edit && $currentWindow === "output"} {ratio} />
{:else if item.type === "timer"}
    <Timer {item} id={item.timer?.id || item.timerId || ""} {today} style={noAutoSize ? "" : `font-size: ${edit ? autoSize : fontSize}px;`} {edit} />
{:else if item.type === "clock"}
    <Clock {item} fontStyle={noAutoSize ? "" : `font-size: ${edit ? autoSize : fontSize}px;`} style={false} {...item.clock} />
{:else if item.type === "camera"}
    {#if item.device}
        <Cam cam={item.device} item style={cameraStyleString} disablePreview={isTemplatePreview} cropping={item.cropping} {cropPreviewMode} preview={!outputId && (preview || isTemplatePreview)} itemStyle={item.style} />
    {/if}
{:else if item.type === "slide_tracker"}
    <SlideProgress {item} tracker={item.tracker || {}} autoSize={item.auto === false ? 0 : edit ? autoSize : fontSize} {outputId} />
{:else if item.type === "events"}
    <DynamicEvents {...item.events} textSize={smallFontSize ? (-1.1 * $slidesOptions.columns + 10) * 5 : Number(getStyles(item.style, true)?.["font-size"]) || 80} />
{:else if item.type === "weather"}
    <Weather data={item.weather || {}} />
{:else if item.type === "visualizer"}
    <Visualizer {item} {preview} {edit} />
{:else if item.type === "captions"}
    <Captions {item} />
{:else if item.type === "icon"}
    <IconItem {item} {ratio} />
{:else if item.type === "metronome"}
    <MetronomeVisualizer isItem />
{:else if item.type === "variable"}
    <!-- moved to textbox in 1.3.3 -->
    <Variable {item} style={variableStyleString} ref={{ ...ref, slideIndex }} hideText={edit ? false : (ref.type === "stage" && !!$currentWindow) || preview} {edit} />
{:else if item.type === "chart"}
    <Chart {item} ref={{ ...ref, slideIndex }} />
{:else if item.type === "table"}
    <Table {item} {edit} {ref} {ratio} {index} />
{/if}
