<script lang="ts">
    import { getContext, onDestroy } from "svelte"
    import type { StageLayout } from "../../../types/Stage"
    import Center from "../../common/components/Center.svelte"
    import Icon from "../../common/components/Icon.svelte"
    import autosize from "../../common/util/autosize"
    import { keysToID, sortByName } from "../../common/util/helpers"
    import { getStyles } from "../../common/util/style"
    import Clock from "../items/Clock.svelte"
    import SlideNotes from "../items/SlideNotes.svelte"
    import SlideProgress from "../items/SlideProgress.svelte"
    import SlideText from "../items/SlideText.svelte"
    import VideoTime from "../items/VideoTime.svelte"
    import { _getDynamicValue } from "../util/itemHelpers"
    import { activeTimers, background, media, output, outputSlideCache, progressData, stream, timers, variables } from "../util/stores"
    import { getDynamicValue, replaceDynamicValues } from "../helpers/show"
    import MediaOutput from "./MediaOutput.svelte"
    import PreviewCanvas from "./PreviewCanvas.svelte"
    import Textbox from "./Textbox.svelte"
    import Timer from "./Timer.svelte"
    import Variable from "./Variable.svelte"
    import { getItemText } from "../helpers/textStyle"

    export let stageLayout: StageLayout
    export let id: string
    export let item: any // Item | StageItem

    $: currentOutput = $output
    $: currentSlide = currentOutput?.out?.slide || (slideOffset !== 0 ? $outputSlideCache[currentOutput?.id || ""] || null : null)

    $: currentBackground = $background

    // timer
    let today = new Date()
    const dateInterval = setInterval(() => (today = new Date()), 1000)

    onDestroy(() => {
        clearInterval(dateInterval)
        clearInterval(cssInterval)
    })

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
    // WIP this does not update when window size changes...
    let newSizes = `;
        top: ${Math.min(itemStyles.top, (itemStyles.top / 1080) * resolution.height)}px;
        left: ${Math.min(itemStyles.left, (itemStyles.left / 1920) * resolution.width)}px;
        width: ${Math.min(itemStyles.width, (itemStyles.width / 1920) * resolution.width)}px;
        height: ${Math.min(itemStyles.height, (itemStyles.height / 1080) * resolution.height)}px;
    `

    let alignElem: HTMLElement | undefined
    let size = 100
    $: if (alignElem && (item || $progressData)) size = autosize(alignElem, { type: "growToFit", textQuery: ".autoFontSize" })
    $: autoSize = fontSize !== 100 ? Math.max(fontSize, size) : size

    $: slideOffset = item.type ? Number(item.slideOffset || 0) : id.includes("next") ? 1 : 0

    $: isDisabledVariable = id.includes("variables") && $variables[id.split("#")[1]]?.enabled === false

    // request video time
    let videoTime: number = 0
    // $: if (id.includes("video")) requestVideoData()
    // let interval: any = null
    // function requestVideoData() {
    //     if (interval) return
    //     // USE API ?!?
    //     interval = setInterval(() => send("REQUEST_VIDEO_DATA"), 1000)
    //     // interval = setInterval(() => socket.emit("STAGE", { id: socketId, channel: "REQUEST_VIDEO_DATA" }), 1000)
    // }
    // onDestroy(() => {
    //     if (interval) clearInterval(interval)
    // })

    let firstTimerId: string = ""
    $: if (item.type === "timer" || id.includes("first_active_timer")) {
        firstTimerId = $activeTimers[0]?.id
        if (!firstTimerId) firstTimerId = sortByName(keysToID($timers)).find((timer) => timer.type !== "counter")?.id || ""
    }

    let itemStyle: string = ""
    let textStyle: string = ""
    $: if (style) updateStyles()
    function updateStyles() {
        const styles = getStyles(style)
        const textStyleKeys = ["line-height", "text-decoration"]
        // For slide_text items with autosize, exclude font-size from container style
        // to prevent CSS inheritance of 800px (MAX_FONT_SIZE) before autosize computes correct value
        const isSlideTextWithAutosize = item?.type === "slide_text" && (item?.auto !== false || (item?.textFit && item?.textFit !== "none"))

        itemStyle = ""
        textStyle = ""

        Object.entries(styles).forEach(([key, value]) => {
            if (textStyleKeys.includes(key)) textStyle += `${key}: ${value};`
            else if (key === "font-size" && isSlideTextWithAutosize) {
                // Skip font-size for autosize items - let Textbox's autosize compute it
            } else itemStyle += `${key}: ${value};`
        })
    }

    // fixed letter width
    $: fixedWidth = item?.type === "timer" || item?.type === "clock" ? "font-feature-settings: 'tnum' 1;" : ""

    function getVariableNameId(name: string) {
        if (typeof name !== "string") return ""
        return name.toLowerCase().trim().replaceAll(" ", "_")
    }

    function createCSSVariables(variableUpdater: any, _updateTrigger: any = null) {
        if (!variableUpdater) return ""
        const numberVariables = Object.values(variableUpdater).filter((a: any) => a && (a.type === "number" || a.type === "random_number" || (a.type === "text" && a.text?.includes("{"))))
        let css = numberVariables.reduce((css: string, v: any) => (css += `--variable-${getVariableNameId(v.name)}: ${v.type === "text" ? _getDynamicValue(v.text || "") : (v.number ?? (v.default || 0))};`), "")

        css += `--slide-group-color: ${_getDynamicValue("slide_group_color")};`
        css += `--slide-group-next-color: ${_getDynamicValue("slide_group_next_color")};`
        css += `--slide-group-upcoming-color: ${_getDynamicValue("slide_group_upcoming_color")};`

        return css
    }

    let updateTrigger = 0
    const cssInterval = setInterval(() => updateTrigger++, 1000)

    $: cssVariables = createCSSVariables($variables, updateTrigger)

    // flash background (on mount & text changes)
    $: currentItemText = item ? getItemText(item) : ""

    $: flashColor = item?.flash?.color || "#FF0000"
    $: flashCount = (() => {
        let value = Number(item?.flash?.count)
        return !value || !Number.isFinite(value) || value < 1 ? 3 : Math.floor(value)
    })()

    const getLayoutMounted = getContext<() => boolean>("layoutMounted")

    let evaluatedText = ""
    $: {
        if (currentItemText) {
            replaceDynamicValues(currentItemText, ($variables ? 0 : 0) + ($timers ? 0 : 0) + updateTrigger)
            evaluatedText = getDynamicValue(currentItemText)
        } else {
            evaluatedText = ""
        }
    }

    let lastText = ""
    let flashTriggerId = 0
    $: if (item?.flash?.enabled) {
        const currentText = evaluatedText || ""
        const parentIsMounting = getLayoutMounted ? !getLayoutMounted() : false

        if (lastText !== currentText && currentText.trim() && !parentIsMounting) flashTriggerId++
        lastText = currentText
    }
</script>

<!-- style + (id.includes("current_output") ? "" : newSizes) -->
<!-- {show.settings.autoStretch === false ? '' : newSizes} -->
<div class="item" class:border={stageLayout?.settings.labels} class:isDisabledVariable style="{itemStyle}{id.includes('slide') && !id.includes('tracker') ? '' : textStyle}{newSizes}--labelColor: {stageLayout?.settings?.labelColor || '#d0a853'};{fixedWidth}{cssVariables}">
    <!-- flash background -->
    {#if item?.flash?.enabled && flashTriggerId > 0}
        {#key flashTriggerId}
            <div class="flashBackground" style="background-color: {flashColor};animation-iteration-count: {flashCount};"></div>
        {/key}
    {/if}

    {#if stageLayout?.settings.labels}
        <div class="label">{item.label || ""}</div>
    {/if}

    <div bind:this={alignElem} class="align" style="--align: {item.align};--text-align: {item.alignX};{item.type !== 'slide_text' || item.keepStyle ? 'height: 100%;' : ''}">
        <span style="pointer-events: none;width: 100%;height: 100%;">
            {#if item.type === "current_output" || id.includes("current_output")}
                <!-- width gets squished when resized -->
                <PreviewCanvas alpha={id.includes("_alpha")} id={stageLayout?.settings?.output} capture={$stream[id.includes("_alpha") ? "alpha" : "default"]} />
            {:else if item.type === "slide_text" || id.includes("slide")}
                {@const slideBackground = slideOffset === 0 ? currentBackground : slideOffset === 1 ? currentBackground.next : null}

                {#if (item.type ? item.includeMedia : !id.includes("_text")) && slideBackground?.path}
                    <MediaOutput path={slideBackground.path} mediaStyle={slideBackground.mediaStyle} />
                {/if}

                {#if currentSlide}
                    {#key item || currentSlide}
                        <!-- autoStage={show.settings.autoStretch !== false} -->
                        <SlideText {currentSlide} {slideOffset} stageItem={item} show={stageLayout} {resolution} chords={typeof item.chords === "boolean" ? item.chords : item.chords?.enabled} autoSize={item.auto !== false} {fontSize} autoStage {textStyle} style={item.type ? item.keepStyle : false} />
                    {/key}
                {/if}
            {:else if item.type === "slide_notes" || id.includes("notes")}
                <SlideNotes {currentSlide} {slideOffset} autoSize={item.auto !== false ? autoSize : fontSize} />
            {:else if item.type === "text"}
                <Textbox {item} showId={id} autoSize={item.auto === true || (item.textFit && item.textFit !== "none")} {fontSize} />
                <!-- STAGE VV -->
            {:else if item.type === "slide_tracker" || id.includes("slide_tracker")}
                <SlideProgress tracker={item.tracker || {}} autoSize={item.auto !== false ? autoSize : fontSize} />
            {:else if item.type === "clock" || id.includes("clock")}
                <Clock autoSize={item.auto !== false ? autoSize : fontSize} style={false} {...item.clock} />
            {:else if item.type === "timer"}
                <Timer {item} id={item.timer?.id || item.timerId || firstTimerId || ""} {today} style={item.auto === false ? "" : `font-size: ${item.auto !== false ? autoSize : fontSize}px;`} />
            {:else if item.type === "media"}
                <MediaOutput path={$media[item.src] || item.src} />
            {:else if item.type === "camera"}
                <Center faded>
                    <Icon id="noImage" size={8} white />
                </Center>
            {:else if item.type}
                <!-- probably unused -->
                <Textbox {item} showId={id} fontSize={item.auto !== false ? autoSize : fontSize} />
                <!-- <SlideItems item={stageItemToItem(item)} ref={{ type: "stage", id }} fontSize={item.auto !== false ? autoSize : fontSize} /> -->
            {:else}
                <!-- OLD CODE -->
                <div>
                    {#if id.includes("video")}
                        <VideoTime {videoTime} autoSize={item.auto !== false ? autoSize : fontSize} />
                    {:else if id.includes("first_active_timer")}
                        <Timer {item} id={firstTimerId} {today} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" />
                    {:else if id.includes("timers")}
                        {#if $timers[id.split("#")[1]]}
                            <Timer {item} id={id.split("#")[1]} {today} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" />
                        {/if}
                    {:else if id.includes("variables")}
                        {#if $variables[id.split("#")[1]]}
                            <Variable id={id.split("#")[1]} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" />
                        {/if}
                    {:else}
                        {id}
                    {/if}
                </div>
            {/if}
        </span>
    </div>
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
        text-transform: none;

        line-height: normal;
        letter-spacing: normal;
        word-spacing: normal;
    }

    .align :global(.item .align) {
        align-items: var(--align);
    }
    .align :global(.item .align .lines) {
        text-align: var(--text-align);
    }

    /* phone view */
    @media (max-width: 1000px) {
        .label {
            font-size: 24px;
        }
    }

    @media (max-width: 500px) {
        .label {
            font-size: 18px;
        }
    }
    @keyframes stage-flash {
        0% {
            opacity: 0;
        }
        15% {
            opacity: 1;
        }
        100% {
            opacity: 0;
        }
    }
    .flashBackground {
        position: absolute;
        inset: 0;
        opacity: 0;
        pointer-events: none;
        z-index: 0;
        animation-name: stage-flash;
        animation-duration: 600ms;
        animation-timing-function: ease-out;
        animation-fill-mode: forwards;
    }
</style>
