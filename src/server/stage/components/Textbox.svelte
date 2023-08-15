<script lang="ts">
    import { onMount } from "svelte"
    import type { Item } from "../../../types/Show"
    import { getStyles } from "../helpers/style"
    import Clock from "../items/Clock.svelte"
    import Icon from "./Icon.svelte"
    import ListView from "./ListView.svelte"

    export let item: Item
    export let stageItem: any = {}
    export let style: boolean = true
    export let autoStage: boolean = true
    export let chords: boolean = false
    export let fontSize: number = 0
    export let autoSize: boolean = true
    export let ratio: number = 1

    // dynamic resolution
    let resolution = { width: window.innerWidth, height: window.innerHeight }
    let itemStyle = item.style
    let itemStyles: any = getStyles(item.style, true)
    // custom dynamic size
    let newSizes = `;
    top: ${Math.min(itemStyles.top, (itemStyles.top / 1080) * resolution.height)}px;
    left: ${Math.min(itemStyles.left, (itemStyles.left / 1920) * resolution.width)}px;
    width: ${Math.min(itemStyles.width, (itemStyles.width / 1920) * resolution.width)}px;
    height: ${Math.min(itemStyles.height, (itemStyles.height / 1080) * resolution.height)}px;
  `
    if (autoStage) itemStyle = itemStyle + newSizes

    // TODO: use autoSize.ts
    // let height: number = 0
    // $: lineCount =
    //   item.lines?.reduce((count, line) => {
    //     let fullText = line.text.map((text) => text.value).join("")
    //     let lineBreaks = Math.ceil(fullText.length / 40)
    //     return count + lineBreaks
    //   }, 0) || 0
    // // $: autoSize = item.lines ? height / (item.lines.length + 3) : 0
    // $: autoSize = item.lines ? height / (lineCount + 3) : 0

    $: lineGap = item?.specialStyle?.lineGap
    $: lineBg = item?.specialStyle?.lineBg

    // AUTO SIZE

    let loaded = false
    onMount(() => {
        loaded = true
    })

    $: console.log(autoSize, fontSize, stageItem, loaded)

    let alignElem: any
    let loopStop = false
    const MAX_FONT_SIZE = 500
    const MIN_FONT_SIZE = 10

    $: if (autoSize && loaded) getCustomAutoSize()
    function getCustomAutoSize() {
        console.log(loopStop, !loaded, !alignElem, !autoSize)
        if (loopStop || !loaded || !alignElem || !autoSize) return
        loopStop = true

        fontSize = MAX_FONT_SIZE
        addStyleToElemText(fontSize)

        console.log(fontSize)

        while (fontSize > MIN_FONT_SIZE && (alignElem.scrollHeight > alignElem.offsetHeight || alignElem.scrollWidth > alignElem.offsetWidth)) {
            fontSize--
            addStyleToElemText(fontSize)
        }

        console.log(fontSize)

        function addStyleToElemText(fontSize: number) {
            for (let linesElem of alignElem.children) {
                for (let breakElem of linesElem.children) {
                    for (let txt of breakElem.children) {
                        txt.style.fontSize = fontSize + "px"
                    }
                }
            }
        }

        setTimeout(() => {
            loopStop = false
        }, 500)
    }

    // CHORDS

    let chordLines: string[] = []
    $: if (chords && item.lines) createChordLines()
    function createChordLines() {
        chordLines = []

        item.lines!.forEach((line, i) => {
            if (!line.chords?.length || !line.text) return

            let html = ""
            let index = 0
            line.text.forEach((text) => {
                let value = text.value.trim().replaceAll("\n", "") || "."
                let chords = JSON.parse(JSON.stringify(line.chords || []))

                let letters = value.split("")
                letters.forEach((letter) => {
                    let chordIndex = chords.findIndex((a: any) => a.pos === index)
                    if (chordIndex >= 0) {
                        html += `<span class="chord">${chords[chordIndex].key}</span>`
                        chords.splice(chordIndex, 1)
                    }

                    index++
                    html += `<span class="invisible">${letter}</span>`
                })

                chords.forEach((chord: any, i: number) => {
                    html += `<span class="chord" style="transform: translateX(${60 * (i + 1)}px);">${chord.key}</span>`
                })
            })

            if (!html) return
            chordLines[i] = html
        })
    }
</script>

<!-- bind:offsetHeight={height} -->
<div class="item" style={style ? itemStyle : null}>
    {#if item.lines}
        <div class="align" style={style ? item.align : null} bind:this={alignElem}>
            <!-- {#if chords}
                <Chords {item} {textElem} />
            {/if} -->
            <div class="lines" style={style && lineGap ? `gap: ${lineGap}px;` : ""}>
                {#each item.lines as line, i}
                    {#if chordLines[i]}
                        <div class:first={i === 0} class="break chords" style="--chord-size: {stageItem?.chordsData?.size || 30}px;--chord-color: {stageItem?.chordsData?.color || '#FF851B'};--font-size: {fontSize}px;">
                            {@html chordLines[i]}
                        </div>
                    {/if}
                    <div class="break" style="{style && lineBg ? `background-color: ${lineBg};` : ''}{style ? line.align : ''}">
                        {#each line.text || [] as text}
                            <span style={style ? text.style + (fontSize ? "font-size: " + fontSize + "px;" : "") : "font-size: " + fontSize + "px;"}>{@html text.value.replaceAll("\n", "<br>") || "<br>"}</span>
                        {/each}
                    </div>
                {/each}
            </div>
        </div>
    {:else if item?.type === "list"}
        <ListView list={item.list} />
        <!-- {:else if item?.type === "media"}
        {#if item.src}
            {#if getMediaType(getExtension(item.src)) === "video"}
                <video src={item.src} muted={true}>
                    <track kind="captions" />
                </video>
            {:else}
                <Image src={item.src} alt="" style="width: 100%;height: 100%;object-fit: {item.fit || 'contain'};filter: {item.filter};{item.flipped ? 'transform: scaleX(-1);' : ''}" />
            {/if}
        {/if} -->
        <!-- {:else if item?.type === "camera"} -->
        <!-- {:else if item?.type === "timer"}
        <Timer {item} id={item.timerId || ""} {today} style="font-size: {fontSize}px;" /> -->
    {:else if item?.type === "clock"}
        <Clock autoSize={fontSize} {...item.clock} />
        <!-- {:else if item?.type === "events"}
        <DynamicEvents {...item.events} /> -->
        <!-- {:else if item?.type === "variable"}
        <Variable {item} style="font-size: {fontSize}px;" /> -->
        <!-- {:else if item?.type === "mirror"}
        <Mirror {item} {ref} {ratio} index={slideIndex} /> -->
    {:else if item?.type === "icon"}
        {#if item.customSvg}
            <div class="customIcon">
                {@html item.customSvg}
            </div>
        {:else}
            <Icon style="zoom: {1 / ratio};" id={item.id || ""} fill white custom />
        {/if}
    {/if}
</div>

<style>
    /* default stage item */
    .item {
        color: white;
        /* font-size: 100px; */
        font-family: unset;
        line-height: 1.1;
        /* -webkit-text-stroke-color: #000000;
        text-shadow: 2px 2px 10px #000000; */

        /* border-style: solid;
        border-width: 0px;
        border-color: #ffffff; */

        height: 150px;
        width: 400px;
    }

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

        display: flex;
        flex-direction: column;
        text-align: center;
        justify-content: center;
    }

    .break {
        width: 100%;

        /* height: 100%; */
        user-select: text;

        overflow-wrap: break-word;
        /* line-break: after-white-space;
    -webkit-line-break: after-white-space; */
    }

    /* span {
    display: inline;
    white-space: initial;
    color: white;
  } */

    .break :global(span) {
        font-size: 100px;
    }

    /* chords */
    .break.chords :global(.invisible) {
        opacity: 0;
        font-size: var(--font-size);
        line-height: 0;
    }
    .break.chords :global(.chord) {
        position: absolute;
        color: var(--chord-color);
        font-size: var(--chord-size) !important;
        bottom: -5px;
        transform: translateX(-25%);
        z-index: 2;
    }
    .break.chords {
        line-height: 0.5em;
        position: relative;
    }
    .break.chords.first {
        line-height: var(--chord-size) !important;
    }

    /* custom svg icon */

    .customIcon,
    .customIcon :global(svg) {
        width: 100%;
        height: 100%;
    }
</style>
