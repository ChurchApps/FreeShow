<script context="module" lang="ts">
    // Module-level cache of the last `enabled` state of every text variable referenced by a stage text
    // item. Stays outside the component lifecycle so it survives the {#key $stageLayout} remounts that
    // happen in src/server/stage/components/Slide.svelte; otherwise we would treat the first reading
    // after a remount as a "false -> true" transition and fire the flash by mistake.
    // Key format: `${stageLayoutKey}#${itemId}#${variableId}`.
    const lastEnabledByItem = new Map<string, boolean>()
</script>

<script lang="ts">
    import { onDestroy } from "svelte"
    import type { StageItem, StageLayout } from "../../../types/Stage"
    import Center from "../../common/components/Center.svelte"
    import Icon from "../../common/components/Icon.svelte"
    import autosize from "../../common/util/autosize"
    import { keysToID, sortByName } from "../../common/util/helpers"
    import { getStyles } from "../../common/util/style"
    import { getItemText } from "../helpers/textStyle"
    import Clock from "../items/Clock.svelte"
    import SlideNotes from "../items/SlideNotes.svelte"
    import SlideProgress from "../items/SlideProgress.svelte"
    import SlideText from "../items/SlideText.svelte"
    import VideoTime from "../items/VideoTime.svelte"
    import { activeTimers, background, media, output, outputSlideCache, progressData, stream, timers, variables } from "../util/stores"
    import FlashBackground from "./FlashBackground.svelte"
    import MediaOutput from "./MediaOutput.svelte"
    import PreviewCanvas from "./PreviewCanvas.svelte"
    import Textbox from "./Textbox.svelte"
    import Timer from "./Timer.svelte"
    import Variable from "./Variable.svelte"

    export let stageLayout: StageLayout
    export let id: string
    export let item: any // Item | StageItem

    $: currentOutput = $output
    $: currentSlide = currentOutput?.out?.slide || (slideOffset !== 0 ? $outputSlideCache[currentOutput?.id || ""] || null : null)

    $: currentBackground = $background

    // timer
    let today = new Date()
    const dateInterval = setInterval(() => (today = new Date()), 1000)
    onDestroy(() => clearInterval(dateInterval))

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

    // STAGE MESSENGER: fire the FlashBackground pulse when a text variable referenced by this item
    // transitions enabled: false -> true, and cancel it when any referenced variable transitions
    // enabled: true -> false. The item.flash checkbox acts as the on/off switch ("this is a stage
    // messenger"). We bump flashBurstId / flashStopId, which are observed by FlashBackground.
    let flashBurstId = 0
    let flashStopId = 0
    $: stageLayoutKey = stageLayout?.name || ""
    $: handleVariableTransitions($variables, item as StageItem, stageLayoutKey, id)

    function handleVariableTransitions(vars: any, currentItem: StageItem | undefined, layoutKey: string, itemId: string) {
        if (!currentItem || currentItem.type !== "text") return

        const referenced = getReferencedVariableIds(currentItem, vars)
        let shouldBurst = false
        let shouldStop = false

        referenced.forEach((varId) => {
            const key = `${layoutKey}#${itemId}#${varId}`
            const newEnabled = vars[varId]?.enabled !== false // text variables default to enabled
            const prev = lastEnabledByItem.get(key)

            if (prev === undefined) {
                // First time we see this variable for this item: seed cache without firing.
                lastEnabledByItem.set(key, newEnabled)
                return
            }

            if (prev === false && newEnabled === true) {
                // Off -> on transition: trigger the burst (debounced to once per tick below).
                lastEnabledByItem.set(key, true)
                shouldBurst = true
            } else if (prev === true && newEnabled === false) {
                // On -> off transition: kill any running pulse (text just disappeared).
                lastEnabledByItem.set(key, false)
                shouldStop = true
            } else if (prev !== newEnabled) {
                lastEnabledByItem.set(key, newEnabled)
            }
        })

        if (!!currentItem.flash) {
            // Stop wins over burst in the same tick: if any referenced variable was just disabled,
            // the text is gone and the flash must die with it, even if another came on simultaneously.
            if (shouldStop) flashStopId++
            else if (shouldBurst) flashBurstId++
        }
    }

    function getReferencedVariableIds(currentItem: StageItem, allVariables: any): string[] {
        const text = getItemText(currentItem as any)
        if (!text || !text.includes("{$")) return []

        const ids: string[] = []
        // Matches dynamic refs like {$nameId}, {$nameId#2}, {$nameId|fallback}
        const regex = /\{\$([a-z0-9_]+)(?:#\d+)?(?:\|[^}]*)?\}/gi
        let match: RegExpExecArray | null
        while ((match = regex.exec(text)) !== null) {
            const nameId = match[1].toLowerCase()
            for (const [varId, v] of Object.entries(allVariables) as [string, any][]) {
                if (v?.type !== "text") continue
                if (variableNameId(v.name) === nameId && !ids.includes(varId)) {
                    ids.push(varId)
                    break
                }
            }
        }
        return ids
    }

    function variableNameId(name: string): string {
        if (typeof name !== "string") return ""
        return name.toLowerCase().trim().replaceAll(" ", "_")
    }

    // Clear this item's entries from the module-level cache when the component is destroyed
    // (avoids leaking keys for items that get removed or renamed).
    onDestroy(() => {
        const prefix = `${stageLayoutKey}#${id}#`
        for (const key of Array.from(lastEnabledByItem.keys())) {
            if (key.startsWith(prefix)) lastEnabledByItem.delete(key)
        }
    })
</script>

<!-- style + (id.includes("current_output") ? "" : newSizes) -->
<!-- {show.settings.autoStretch === false ? '' : newSizes} -->
<div class="item" class:border={stageLayout?.settings.labels} class:isDisabledVariable style="{itemStyle}{id.includes('slide') && !id.includes('tracker') ? '' : textStyle}{newSizes}--labelColor: {stageLayout?.settings?.labelColor || '#d0a853'};{fixedWidth}">
    <!-- stage messenger flash background (shared component, deterministic Web Animations API restart) -->
    <!-- burstId fires on var false->true, stopId cancels on var true->false -->
    <FlashBackground flash={item?.flash} flashColor={item?.flashColor} flashCount={item?.flashCount} burstId={flashBurstId} stopId={flashStopId} />

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
                <Textbox {item} showId={id} autoSize={item.auto === true} {fontSize} />
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

    /* stage messenger flash background lives in FlashBackground.svelte;
       the .align / .label z-indexes below keep text and label rendered above the absolute flash layer */

    .align {
        height: 100%;
        display: flex;
        text-align: center;
        align-items: center;

        /* keep text rendered above the flash background */
        position: relative;
        z-index: 1;
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
        z-index: 2;

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
</style>
