<script lang="ts">
    import { onDestroy } from "svelte"
    import { keysToID, sortByName } from "../helpers/array"
    import autosize from "../helpers/autosize"
    import { getStyles } from "../helpers/style"
    import Clock from "../items/Clock.svelte"
    import SlideNotes from "../items/SlideNotes.svelte"
    import SlideProgress from "../items/SlideProgress.svelte"
    import SlideText from "../items/SlideText.svelte"
    import VideoTime from "../items/VideoTime.svelte"
    import { activeTimers, progressData, timers, variables } from "../store"
    import MediaOutput from "./MediaOutput.svelte"
    import PreviewCanvas from "./PreviewCanvas.svelte"
    import Timer from "./Timer.svelte"
    import Variable from "./Variable.svelte"

    export let show: any
    export let id: string
    export let item: any
    export let slides: any
    export let socketId: string = ""
    export let socket: any
    export let stream: any
    export let background: any

    // timer
    let today = new Date()
    setInterval(() => (today = new Date()), 1000)

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

    let alignElem: any
    let size = 100
    $: if (alignElem && (item || $progressData)) size = autosize(alignElem, { type: "growToFit", textQuery: ".autoFontSize" })
    $: autoSize = fontSize !== 100 ? Math.max(fontSize, size) : size

    $: next = id.includes("next")
    $: slide = slides[next ? 1 : 0]

    $: isDisabledVariable = id.includes("variables") && $variables[id.split("#")[1]]?.enabled === false

    // request video time
    let videoTime: number = 0
    $: if (id.includes("video")) requestVideoData()
    let interval: any = null
    function requestVideoData() {
        if (interval) return
        interval = setInterval(() => socket.emit("STAGE", { id: socketId, channel: "REQUEST_VIDEO_DATA" }), 1000)

        socket.on("STAGE", (msg: any) => {
            if (msg.channel !== "REQUEST_VIDEO_DATA" || !msg.data) return

            videoTime = msg.data.time || 0
            let reverse = id.includes("countdown")
            if (reverse) videoTime = (msg.data.data?.duration || 0) - videoTime
        })
    }

    onDestroy(() => {
        if (interval) clearInterval(interval)
    })

    let firstTimerId: string = ""
    $: if (id.includes("first_active_timer")) {
        firstTimerId = $activeTimers[0]?.id
        if (!firstTimerId) firstTimerId = sortByName(keysToID($timers)).find((timer) => timer.type !== "counter")?.id || ""
    }

    let itemStyle: string = ""
    let textStyle: string = ""
    $: if (style) updateStyles()
    function updateStyles() {
        const styles = getStyles(style)
        const textStyleKeys = ["line-height", "text-decoration"]

        itemStyle = ""
        textStyle = ""

        Object.entries(styles).forEach(([key, value]) => {
            if (textStyleKeys.includes(key)) textStyle += `${key}: ${value};`
            else itemStyle += `${key}: ${value};`
        })
    }
</script>

<!-- style + (id.includes("current_output") ? "" : newSizes) -->
<div
    class="item"
    class:border={show?.settings.labels}
    class:isDisabledVariable
    style="{itemStyle}{id.includes('slide') && !id.includes('tracker') ? '' : textStyle}{show.settings.autoStretch === false ? '' : newSizes}--labelColor: {show?.settings?.labelColor || '#d0a853'};"
>
    {#if show?.settings.labels}
        <div class="label">{item.label || ""}</div>
    {/if}

    {#if id.includes("current_output")}
        <span style="pointer-events: none;">
            <PreviewCanvas alpha={id.includes("_alpha")} id={show?.settings?.output} {socket} capture={stream[id.includes("_alpha") ? "alpha" : "default"]} />
        </span>
    {:else}
        <div bind:this={alignElem} class="align" style={item.align}>
            <div>
                {#if id.includes("slide_tracker")}
                    <SlideProgress tracker={item.tracker || {}} autoSize={item.auto !== false ? autoSize : fontSize} />
                {:else if id.includes("notes")}
                    <SlideNotes notes={slide?.notes || ""} autoSize={item.auto !== false ? autoSize : fontSize} />
                {:else if id.includes("slide_text")}
                    {#key item || slide}
                        <SlideText {slide} stageItem={item} chords={item.chords} autoSize={item.auto !== false} {fontSize} autoStage={show.settings.autoStretch !== false} {textStyle} />
                    {/key}
                {:else if id.includes("slide")}
                    {@const slideBackground = next ? background.next : background}
                    <!-- TODO: show overlays etc. -->
                    <span style="pointer-events: none;">
                        {#if slideBackground?.path}
                            <MediaOutput path={slideBackground.path} mediaStyle={slideBackground.mediaStyle} />
                        {/if}

                        <SlideText {slide} stageItem={item} {show} {resolution} chords={item.chords} autoSize={item.auto !== false} {fontSize} autoStage={show.settings.autoStretch !== false} {textStyle} style />
                    </span>
                {:else if id.includes("clock")}
                    <Clock autoSize={item.auto !== false ? autoSize : fontSize} />
                {:else if id.includes("video")}
                    <VideoTime {videoTime} autoSize={item.auto !== false ? autoSize : fontSize} />
                {:else if id.includes("first_active_timer")}
                    <Timer timer={$timers[firstTimerId] || {}} ref={{ id: firstTimerId }} {today} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" />
                {:else if id.includes("timers")}
                    {#if $timers[id.split("#")[1]]}
                        <Timer timer={$timers[id.split("#")[1]]} ref={{ id: id.split("#")[1] }} {today} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" />
                    {/if}
                {:else if id.includes("variables")}
                    {#if $variables[id.split("#")[1]]}
                        <Variable id={id.split("#")[1]} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" />
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

        border-width: 0;
        border-style: solid;

        /* make label visible */
        overflow: visible !important;
    }

    .item.border {
        outline: 3px solid var(--labelColor);
        outline-offset: 0;
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

    .isDisabledVariable {
        display: none;
    }

    .label {
        position: absolute;
        top: 0;
        transform: translateY(calc(-100% - 3px));
        width: 100%;

        background: rgb(0 0 0 / 0.4);
        color: var(--labelColor);

        /* RESET LABEL STYLE */
        font-family: sans-serif;
        font-size: 42px;
        -webkit-text-stroke-width: 0;
        text-shadow: none;

        font-weight: normal;
        font-style: normal;
        text-align: center;

        line-height: normal;
        letter-spacing: normal;
        word-spacing: normal;
    }
</style>
