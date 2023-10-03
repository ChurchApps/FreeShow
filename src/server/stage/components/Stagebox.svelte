<script lang="ts">
    import { getAutoSize } from "../helpers/autoSize"
    import { getStyles } from "../helpers/style"
    import Clock from "../items/Clock.svelte"
    import SlideNotes from "../items/SlideNotes.svelte"
    import SlideText from "../items/SlideText.svelte"
    import VideoTime from "../items/VideoTime.svelte"
    import { timers } from "../store"
    import PreviewCanvas from "./PreviewCanvas.svelte"
    import Timer from "./Timer.svelte"

    export let show: any
    export let id: string
    export let item: any
    export let slides: any
    export let socket: any
    export let stream: any

    // timer
    let today = new Date()
    setInterval(() => (today = new Date()), 1000)

    let height: number = 0
    let width: number = 0
    let itemStyles: any = getStyles(item.style, true)
    $: fontSize = Number(itemStyles?.["font-size"] || 0) || 100 // item.autoFontSize ||

    // dynamic resolution
    let resolution = { width: window.innerWidth, height: window.innerHeight }

    $: style = item.auto ? removeFontSize(item.style) : item.style
    function removeFontSize(style: string) {
        let fontSizeIndex = style.indexOf("font-size")
        if (fontSizeIndex < 0) return style

        return style.slice(0, fontSizeIndex) + style.slice(style.indexOf(";", fontSizeIndex) + 1)
    }

    // custom dynamic size
    let newSizes = `;
    top: ${Math.min(itemStyles.top, (itemStyles.top / 1080) * resolution.height)}px;
    left: ${Math.min(itemStyles.left, (itemStyles.left / 1920) * resolution.width)}px;
    width: ${Math.min(itemStyles.width, (itemStyles.width / 1920) * resolution.width)}px;
    height: ${Math.min(itemStyles.height, (itemStyles.height / 1080) * resolution.height)}px;
  `

    $: size = getAutoSize(item, { width, height })
    $: autoSize = fontSize ? Math.max(fontSize, size) : size

    $: next = id.includes("next")
    $: slide = slides[next ? 1 : 0]

    // let outputResolution: any = show && show.settings.resolution ? show.settings.resolution : { width: 1920, height: 1080 }
</script>

<!-- style + (id.includes("current_output") ? "" : newSizes) -->
<div class="item" style={style + (show.settings.autoStretch === false ? "" : newSizes)} bind:offsetHeight={height} bind:offsetWidth={width}>
    {#if show?.settings.labels}
        <div class="label">
            {item.label}
            <!-- <T id="stage.{id.split('#')[1]}" /> -->
        </div>
    {/if}

    {#if id.includes("current_output")}
        <span style="pointer-events: none;">
            <!-- <Output {show} {slide} style={getStyleResolution(outputResolution, width, height)} {background} /> -->
            <PreviewCanvas alpha={id.includes("_alpha")} id={show?.settings?.output} {socket} capture={stream[id.includes("_alpha") ? "alpha" : "default"]} />
        </span>
    {:else}
        <div class="align" style={item.align}>
            <div>
                {#if id.split("#")[0] === "countdowns"}
                    <!--  -->
                {:else if id.includes("notes")}
                    <SlideNotes notes={slide?.notes || ""} autoSize={item.auto !== false ? autoSize : fontSize} />
                {:else if id.includes("slide_text")}
                    {#key item || slide}
                        <!-- <SlideText {slide} chords={item.chords} autoSize={item.auto !== false} {fontSize} autoStage={show.settings.autoStretch !== false} parent={{ width, height }} /> -->
                        <SlideText {slide} stageItem={item} chords={item.chords} autoSize={item.auto !== false} {fontSize} autoStage={show.settings.autoStretch !== false} />
                    {/key}
                {:else if id.includes("slide")}
                    <!-- TODO: show slide data (backgrounds, overlays) -->
                    <span style="pointer-events: none;">
                        <SlideText {slide} stageItem={item} chords={item.chords} autoSize={item.auto !== false} {fontSize} autoStage={show.settings.autoStretch !== false} style />
                        <!-- <SlideText {slide} chords={item.chords} autoSize={item.auto !== false} {fontSize} autoStage={show.settings.autoStretch !== false} parent={{ width, height }} style /> -->
                    </span>
                {:else if id.includes("clock")}
                    <Clock autoSize={item.auto !== false ? autoSize : fontSize} />
                {:else if id.includes("video")}
                    <VideoTime autoSize={item.auto !== false ? autoSize : fontSize} />
                {:else if id.includes("timers")}
                    {#if $timers[id.split("#")[1]]}
                        <Timer timer={$timers[id.split("#")[1]]} ref={{ id: id.split("#")[1] }} {today} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" />
                    {/if}
                {:else}
                    {id}
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .item {
        font-family: Arial, Helvetica, sans-serif;
    }

    .align {
        height: 100%;
        display: flex;
        text-align: center;
        align-items: center;
    }

    .align div,
    .align :global(.item) {
        width: 100%;
        height: 100%;
        color: unset;
        /* overflow-wrap: break-word; */
    }
</style>
