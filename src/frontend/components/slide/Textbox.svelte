<script lang="ts">
    import { onMount } from "svelte"
    import type { Item } from "../../../types/Show"
    import { currentWindow, outputs, slidesOptions } from "../../stores"
    import Image from "../drawer/media/Image.svelte"
    import { getAutoSize } from "../edit/scripts/autoSize"
    import Icon from "../helpers/Icon.svelte"
    import { getExtension, getMediaType } from "../helpers/media"
    import { getActiveOutputs } from "../helpers/output"
    import { loadShows } from "../helpers/setShow"
    import { _show } from "../helpers/shows"
    import Clock from "../system/Clock.svelte"
    import Chords from "./Chords.svelte"
    import Timer from "./views/Timer.svelte"
    import { getStyles } from "../helpers/style"
    import ListView from "./views/ListView.svelte"

    export let item: Item
    export let ratio: number = 1
    export let filter: string = ""
    export let backdropFilter: string = ""
    export let key: boolean = false
    export let disableListTransition: boolean = false
    export let smallFontSize: boolean = false
    export let ref: {
        type?: "show" | "stage" | "overlay" | "template"
        showId?: string
        slideId?: string
        id: string
    }
    export let style: boolean = true
    export let chords: boolean = false
    export let linesStart: null | number = null
    export let linesEnd: null | number = null
    export let autoSize: number = 0

    // let height: number = 0
    // let width: number = 0
    // $: autoSize = item.lines ? Math.min(height, width) / (item.lines.length + 3) : Math.min(height, width) / 2
    // TODO: get template auto size
    // $: autoTextSize = autoSize ? autoSize * 0.8 : getAutoSize(item)
    $: autoSize = autoSize || getAutoSize(item)

    $: lines = item?.lines
    $: if (linesStart !== null && linesEnd !== null && lines?.length) lines = lines.filter((a) => a.text.filter((a) => a.value.length)?.length)

    // timer updater
    let today = new Date()
    onMount(() => {
        if (item.type !== "timer") return
        setInterval(() => (today = new Date()), 500)
    })

    // $: if (item.type === "timer") ref.id = item.timer!.id!

    $: slideId = ref.slideId || ""
    function getMirroredItem() {
        if (item.mirror!.show === ref.showId) return

        let outputId = getActiveOutputs($outputs)[0]
        let currentOutput = $outputs[outputId] || {}

        let currentSlideIndex: number = 0
        if (!ref.type || ref.type === "show") {
            let currentSlideRef: any = _show(currentOutput?.out?.slide?.id || "active")
                .layouts("active")
                .ref()[0]
                .find((a: any) => a.id === ref.slideId)

            currentSlideIndex = currentSlideRef.layoutIndex
        }

        let newSlideRef: any = _show(item.mirror!.show).layouts("active").ref()[0]?.[currentSlideIndex]
        if (!newSlideRef) return
        slideId = newSlideRef.id
        let newItem: any = _show(item.mirror!.show).slides([slideId]).items([0]).get()[0]?.[0]
        if (!newItem) return
        newItem.style = "width: 100%;height: 100%;"
        return newItem
    }

    let textElem: any = null

    function getAlphaStyle(style: string) {
        if (!key) return style
        let styles = getStyles(style)

        let alphaStyles = ";"
        let bgAlpha = getAlphaValues(styles["background-color"])
        let textAlpha = getAlphaValues(styles["color"]) || 1
        if (bgAlpha) alphaStyles += "background-color: rgb(255 255 255 / " + bgAlpha + ");"
        alphaStyles += "color: rgb(255 255 255 / " + textAlpha + ");"

        return style + alphaStyles
    }

    function getAlphaValues(colorValue: string) {
        if (!colorValue) return 0
        let alpha = 0

        if (colorValue.includes("#")) alpha = alphaFromHex(colorValue)
        else if (colorValue.includes("rgb")) alpha = alphaFromRgb(colorValue)

        return alpha || 0
    }
    function alphaFromHex(colorValue: string) {
        let rx = /^#([0-9a-f]{2})[0-9a-f]{6}$/i
        let m = colorValue.match(rx)
        if (!m) return 1
        return parseInt(m[1], 16) / 255
    }
    function alphaFromRgb(colorValue: string) {
        if (colorValue.includes(",")) return parseFloat(colorValue.split(",")[3])
        if (colorValue.includes("/")) return parseFloat(colorValue.substring(colorValue.indexOf("/") + 1))
        return 1
    }
</script>

<!-- bind:offsetHeight={height} bind:offsetWidth={width} -->
<div
    class="item"
    style="{style ? getAlphaStyle(item?.style) : null};transition: filter 500ms, backdrop-filter 500ms;{filter ? 'filter: ' + filter + ';' : ''}{backdropFilter ? 'backdrop-filter: ' + backdropFilter + ';' : ''}"
    class:white={key && !lines?.length}
    class:key
>
    {#if lines}
        <div class="align" style={style ? item.align : null}>
            {#if chords}
                <Chords {item} {textElem} />
            {/if}
            <div class="lines" style={smallFontSize ? "--font-size: " + (-1.1 * $slidesOptions.columns + 12) * 5 + "px;" : null} bind:this={textElem}>
                {#each lines as line, i}
                    {#if linesStart === null || linesEnd === null || (i >= linesStart && i < linesEnd)}
                        <div class="break" class:smallFontSize style={style ? line.align : null} class:height={!line.text[0]?.value.length}>
                            {#each line.text as text}
                                <span style="{style ? getAlphaStyle(text.style) : ''}{ref.type === 'stage' || item.auto ? 'font-size: ' + autoSize + 'px;' : ''}">{@html text.value}</span>
                            {/each}
                        </div>
                    {/if}
                {/each}
            </div>
        </div>
    {:else if item?.type === "list"}
        <ListView list={item.list} disableTransition={disableListTransition} />
    {:else if item?.type === "media"}
        {#if item.src}
            {#if getMediaType(getExtension(item.src)) === "video"}
                <!-- video -->
                <video src={item.src} muted={true}>
                    <track kind="captions" />
                </video>
            {:else}
                <Image src={item.src} alt="" style="width: 100%;height: 100%;object-fit: {item.fit || 'contain'};filter: {item.filter};{item.flipped ? 'transform: scaleX(-1);' : ''}" />
                <!-- bind:loaded bind:hover bind:duration bind:videoElem {type} {path} {name} {filter} {flipped} -->
                <!-- <MediaLoader path={item.src} /> -->
            {/if}
        {/if}
    {:else if item?.type === "timer"}
        <!-- {#key item.timer} -->
        <Timer {item} id={item.timerId || ""} {today} style="font-size: {autoSize}px;" />
        <!-- {/key} -->
    {:else if item?.type === "clock"}
        <Clock {autoSize} style={false} {...item.clock} />
    {:else if item?.type === "mirror"}
        {#if item.mirror?.show}
            {#key item.mirror?.show}
                {#await loadShows([item.mirror.show])}
                    {#if !$currentWindow}Loading...{/if}
                {:then}
                    {#if getMirroredItem()}
                        <svelte:self item={getMirroredItem()} ref={{ showId: item.mirror.show, slideId, id: ref.id }} />
                    {/if}
                {/await}
            {/key}
        {/if}
    {:else if item?.type === "icon"}
        <Icon style="zoom: {1 / ratio};" id={item.id || ""} fill white custom />
    {/if}
</div>

<style>
    .align {
        height: 100%;
        display: flex;
        text-align: center;
        align-items: center;
    }

    .lines {
        /* overflow-wrap: break-word;
  font-size: 0; */
        width: 100%;
    }

    .break {
        width: 100%;
        /* line-height: normal; */

        font-size: 0;
        /* height: 100%; */

        overflow-wrap: break-word;
        /* line-break: after-white-space;
    -webkit-line-break: after-white-space; */
    }

    .item :global(.wj) {
        color: #ff5050;
    }

    .white {
        /* filter: brightness(30); */
        filter: grayscale(1) brightness(20);
    }
    .key {
        filter: grayscale(1);
    }

    /* span {
    display: inline;
    white-space: initial;
    color: white;
  } */

    .break :global(span) {
        font-size: 100px;
        min-height: 50px;
        /* display: inline-block; */
    }
    .break.smallFontSize :global(span) {
        /* font-size: 30px; */
        font-size: var(--font-size);
    }

    .height {
        height: 1em;
    }
</style>
