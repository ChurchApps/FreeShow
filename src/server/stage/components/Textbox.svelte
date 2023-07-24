<script lang="ts">
    import type { Item } from "../../../types/Show"
    import { getStyles } from "../helpers/style"
    import Clock from "../items/Clock.svelte"
    import Chords from "./Chords.svelte"
    import Icon from "./Icon.svelte"
    import ListView from "./ListView.svelte"

    export let item: Item
    export let style: boolean = true
    export let autoStage: boolean = true
    export let chords: boolean = false
    export let autoSize: number = 0
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

    let textElem: any = null

    $: lineGap = item?.specialStyle?.lineGap
    $: lineBg = item?.specialStyle?.lineBg
</script>

<!-- bind:offsetHeight={height} -->
<div class="item" style={style ? itemStyle : null}>
    {#if item.lines}
        <div class="align" style={style ? item.align : null}>
            {#if chords}
                <Chords {item} {textElem} />
            {/if}
            <div class="lines" style={style && lineGap ? `gap: ${lineGap}px;` : ""} bind:this={textElem}>
                {#each item.lines as line}
                    <div class="break" style="{style && lineBg ? `background-color: ${lineBg};` : ''}{style ? line.align : ''}">
                        {#each line.text || [] as text}
                            <span style={style ? text.style + (autoSize ? "font-size: " + autoSize + "px;" : "") : "font-size: " + autoSize + "px;"}>{@html text.value.replaceAll("\n", "<br>") || "<br>"}</span>
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
        <Timer {item} id={item.timerId || ""} {today} style="font-size: {autoSize}px;" /> -->
    {:else if item?.type === "clock"}
        <Clock {autoSize} {...item.clock} />
        <!-- {:else if item?.type === "events"}
        <DynamicEvents {...item.events} /> -->
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

    .customIcon,
    .customIcon :global(svg) {
        width: 100%;
        height: 100%;
    }
</style>
