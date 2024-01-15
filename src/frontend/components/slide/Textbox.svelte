<script lang="ts">
    import { onMount } from "svelte"
    import type { Item } from "../../../types/Show"
    import { currentWindow, overlays, showsCache, slidesOptions, templates, variables, volume } from "../../stores"
    import { custom } from "../../utils/transitions"
    import Cam from "../drawer/live/Cam.svelte"
    import Image from "../drawer/media/Image.svelte"
    import { getAutoSize } from "../edit/scripts/autoSize"
    import Icon from "../helpers/Icon.svelte"
    import { clone } from "../helpers/array"
    import { getExtension, getMediaType } from "../helpers/media"
    import { _show } from "../helpers/shows"
    import { getStyles } from "../helpers/style"
    import Clock from "../system/Clock.svelte"
    import DynamicEvents from "./views/DynamicEvents.svelte"
    import ListView from "./views/ListView.svelte"
    import Mirror from "./views/Mirror.svelte"
    import Timer from "./views/Timer.svelte"
    import Variable from "./views/Variable.svelte"
    import Visualizer from "./views/Visualizer.svelte"
    import Website from "./views/Website.svelte"
    import { replaceDynamicValues } from "../helpers/showActions"

    export let item: Item
    export let itemIndex: number = -1
    export let slideIndex: number = 0
    export let preview: boolean = false
    export let mirror: boolean = true
    export let ratio: number = 1
    export let filter: string = ""
    export let backdropFilter: string = ""
    export let key: boolean = false
    export let disableListTransition: boolean = false
    export let smallFontSize: boolean = false
    export let addDefaultItemStyle: boolean = false
    export let transitionEnabled: boolean = false
    export let animationStyle: any = {}
    export let customFontSize: number | null = null
    export let outputStyle: any = {}
    export let ref: {
        type?: "show" | "stage" | "overlay" | "template"
        showId?: string
        slideId?: string
        layoutId?: string
        id: string
    }
    export let style: boolean = true
    export let stageItem: any = {}
    export let chords: boolean = false
    export let linesStart: null | number = null
    export let linesEnd: null | number = null
    export let stageAutoSize: boolean = false
    export let fontSize: number = 0

    // let height: number = 0
    // let width: number = 0
    // $: autoSize = item.lines ? Math.min(height, width) / (item.lines.length + 3) : Math.min(height, width) / 2
    // TODO: get template auto size
    // $: autoTextSize = autoSize ? autoSize * 0.8 : getAutoSize(item)
    // $: autoSize = autoSize || getAutoSize(item)

    $: autoSize = item.autoFontSize || getAutoSize(item)

    $: lines = item?.lines
    $: if (linesStart !== null && linesEnd !== null && lines?.length) lines = lines.filter((a) => a.text.filter((a) => a.value.length)?.length)

    // timer updater
    let today = new Date()
    let loaded = false
    onMount(() => {
        setTimeout(() => (loaded = true), 100)

        if (item.type !== "timer") return
        setInterval(() => (today = new Date()), 500)
    })

    // $: if (item.type === "timer") ref.id = item.timer!.id!

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

    $: lineGap = item?.specialStyle?.lineGap
    $: lineBg = item?.specialStyle?.lineBg

    // actions
    $: if ((preview || $currentWindow === "output") && item?.actions) runActions()
    function runActions() {
        Object.keys(item?.actions).forEach((action) => {
            if (actions[action]) actions[action](item?.actions[action])
        })
    }

    // TODO: overlay gets reset when a new slide is activated
    let hidden: boolean = false
    const actions = {
        showTimer: (duration: number) => {
            hidden = true
            setTimeout(() => {
                hidden = false
            }, duration * 1000)
        },
        hideTimer: (duration: number) => {
            setTimeout(() => {
                hidden = true
            }, duration * 1000)
        },
    }

    $: textAnimation = animationStyle.text || ""

    $: transition = transitionEnabled && item.actions?.transition && item.actions.transition.type !== "none" && item.actions.transition.duration > 0
    $: itemTransition = transition ? clone(item.actions.transition) : {}
    $: if (itemTransition.type === "none") itemTransition = { duration: 0, type: "fade", easing: "linear" }

    // AUTO SIZE

    let alignElem: any
    let loopStop = false
    const MAX_FONT_SIZE = 800
    const MIN_FONT_SIZE = 10

    let previousItem = "{}"
    $: newItem = JSON.stringify(item)
    $: itemAutoSize = item.auto
    $: itemAutoFontSize = item.autoFontSize
    $: if (alignElem && loaded && (stageAutoSize || newItem !== previousItem || chordLines)) {
        // set smaller text for easier reading while calculating new size
        if ((itemAutoSize && !itemAutoFontSize) || outputTemplateAutoSize || stageAutoSize) fontSize = 70
        setTimeout(getCustomAutoSize, 150)
    }

    // recalculate auto size if output template is different than show template
    $: currentShowTemplateId = _show(ref.showId).get("settings.template")
    let outputTemplateAutoSize = false
    $: if ($currentWindow === "output" && outputStyle.template && outputStyle.template !== currentShowTemplateId && !stageAutoSize) getCustomAutoSize(true)
    else outputTemplateAutoSize = false

    function getCustomAutoSize(force: boolean = false) {
        if (!item) return

        if (force === true) {
            let template = $templates[outputStyle.template || ""]
            let firstTextItem = template.items?.find((a) => a.lines)
            let textStyle = firstTextItem?.lines?.[0]?.text?.[0]?.style || ""
            let styleObj = getStyles(textStyle, true)

            if (!firstTextItem?.auto && !item?.auto) return

            item.autoFontSize = firstTextItem?.auto || item.auto ? 0 : Number(styleObj["font-size"]) || 80
            autoSize = item.autoFontSize
            outputTemplateAutoSize = true
        }

        previousItem = JSON.stringify(item)

        if (loopStop || !loaded || !alignElem || (!stageAutoSize && !outputTemplateAutoSize && (!item.auto || item.autoFontSize))) {
            if (item.auto && item.autoFontSize) fontSize = item.autoFontSize
            return
        }
        loopStop = true
        cacheText = true

        fontSize = MAX_FONT_SIZE
        addStyleToElemText(fontSize)

        // syncronus don't work
        // await calculateFontSize()
        // function calculateFontSize() {
        //     return new Promise((resolve) => {
        //         checkFontSize()
        //         function checkFontSize() {
        //             fontSize--
        //             addStyleToElemText(fontSize)

        //             if (fontSize > MIN_FONT_SIZE && (alignElem.scrollHeight > alignElem.offsetHeight || alignElem.scrollWidth > alignElem.offsetWidth)) setTimeout(checkFontSize)
        //             else resolve(true)
        //         }
        //     })
        // }

        // quick search (double divide)
        // WIP duplicate of autoSize.ts
        let lowestValue = MIN_FONT_SIZE
        let highestValue = MAX_FONT_SIZE
        let biggerThanSize = true
        while (highestValue - lowestValue > 3) {
            let difference = (highestValue - lowestValue) / 2
            if (biggerThanSize) {
                highestValue = fontSize
                fontSize -= difference
            } else {
                lowestValue = fontSize
                fontSize += difference
            }

            addStyleToElemText(fontSize)
            biggerThanSize = alignElem.scrollHeight > alignElem.offsetHeight || alignElem.scrollWidth > alignElem.offsetWidth
        }
        fontSize = lowestValue // prefer lowest value

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
        }, 100)

        if (stageAutoSize || itemIndex < 0) return

        // UPDATE item

        if (ref.type === "overlay") {
            overlays.update((a) => {
                a[ref.id].items[itemIndex].autoFontSize = fontSize
                return a
            })
        } else if (ref.type === "template") {
            templates.update((a) => {
                a[ref.id].items[itemIndex].autoFontSize = fontSize
                return a
            })
        } else if (ref.showId) {
            showsCache.update((a) => {
                a[ref.showId!].slides[ref.id].items[itemIndex].autoFontSize = fontSize
                return a
            })
        }
    }

    // CACHE TO PREVENT SHOWING AUTO TEXT CHANGING SIZES

    let cacheText: boolean = false
    let cachedLines: string = ""
    // $: if (cacheText) startTextCaching()
    // TODO: function startTextCaching() {
    //     if (!alignElem) return

    //     setTimeout(() => {
    //         cacheText = false
    //         cachedLines = alignElem.querySelector(".lines")?.outerHTML
    //     }, 1000)
    // }

    // CHORDS

    let chordLines: string[] = []
    $: if (chords && item.lines) createChordLines()
    function createChordLines() {
        chordLines = []

        item.lines!.forEach((line, i) => {
            if (!line.chords?.length || !line.text) return

            let chords = clone(line.chords || [])

            let html = ""
            let index = 0
            line.text.forEach((text) => {
                let value = text.value.trim().replaceAll("\n", "") || ""

                let letters = value.split("")
                letters.forEach((letter) => {
                    let chordIndex = chords.findIndex((a: any) => a.pos === index)
                    if (chordIndex >= 0) {
                        html += `<span class="chord">${chords[chordIndex].key}</span>`
                        chords.splice(chordIndex, 1)
                    }

                    html += `<span class="invisible" style="${style ? getAlphaStyle(text.style) : ""}${fontSizeValue ? `font-size: ${fontSizeValue};` : ""}">${letter}</span>`

                    index++
                })
            })

            chords.forEach((chord: any, i: number) => {
                html += `<span class="chord" style="transform: translateX(${60 * (i + 1)}px);">${chord.key}</span>`
            })

            if (!html) return
            chordLines[i] = html
        })
    }

    $: if (chords && !stageItem && item?.auto && fontSize) fontSize *= 0.7
    $: fontSizeValue = stageAutoSize || item.auto || outputTemplateAutoSize ? (fontSize || autoSize) + "px" : fontSize ? fontSize + "px" : ""

    $: isDisabledVariable = item?.type === "variable" && $variables[item?.variable?.id]?.enabled === false
</script>

<!-- svelte transition bug!!! -->
{#if transition && !hidden}
    <div
        class="item"
        style="{style ? getAlphaStyle(item?.style) : null};transition: filter 500ms, backdrop-filter 500ms;{filter ? 'filter: ' + filter + ';' : ''}{backdropFilter ? 'backdrop-filter: ' + backdropFilter + ';' : ''}{animationStyle.item || ''}"
        class:white={key && !lines?.length}
        class:key
        class:addDefaultItemStyle
        class:isDisabledVariable
        transition:custom={itemTransition}
    >
        {#if lines}
            <div
                class="align"
                class:topBottomScrolling={item?.scrolling?.type === "top_bottom"}
                class:bottomTopScrolling={item?.scrolling?.type === "bottom_top"}
                class:leftRightScrolling={item?.scrolling?.type === "left_right"}
                class:rightLeftScrolling={item?.scrolling?.type === "right_left"}
                style={style ? item.align : null}
                bind:this={alignElem}
            >
                <div
                    class="lines"
                    class:cacheText
                    style="{style && lineGap ? `gap: ${lineGap}px;` : ''}{smallFontSize || customFontSize !== null ? '--font-size: ' + (smallFontSize ? (-1.1 * $slidesOptions.columns + 12) * 5 : customFontSize) + 'px;' : ''}{textAnimation}"
                >
                    {#each lines as line, i}
                        {#if linesStart === null || linesEnd === null || (i >= linesStart && i < linesEnd)}
                            {#if chords && chordLines[i]}
                                <div class:first={i === 0} class="break chords" style="--chord-size: {stageItem?.chordsData?.size || item.chords?.size || 30}px;--chord-color: {stageItem?.chordsData?.color || item.chords?.color || '#FF851B'};">
                                    {@html chordLines[i]}
                                </div>
                            {/if}
                            <!-- class:height={!line.text[0]?.value.length} -->
                            <div class="break" class:smallFontSize={smallFontSize || customFontSize || textAnimation.includes("font-size")} style="{style && lineBg ? `background-color: ${lineBg};` : ''}{style ? line.align : ''}">
                                {#each line.text || [] as text}
                                    {@const value = text.value.replaceAll("\n", "<br>") || "<br>"}
                                    <span style="{style ? getAlphaStyle(text.style) : ''}{fontSizeValue ? `font-size: ${fontSizeValue};` : ''}">
                                        {@html value.includes("{") ? replaceDynamicValues(value, { showId: ref.showId, layoutId: ref.layoutId, slideIndex }) : value}
                                    </span>
                                {/each}
                            </div>
                        {/if}
                    {/each}
                </div>

                {#if cacheText}
                    {@html cachedLines}
                {/if}
            </div>
        {:else if item?.type === "list"}
            <ListView list={item.list} disableTransition={disableListTransition} />
        {:else if item?.type === "media"}
            {#if item.src}
                {#if getMediaType(getExtension(item.src)) === "video"}
                    <!-- video -->
                    <video
                        src={item.src}
                        style="width: 100%;height: 100%;object-fit: {item.fit || 'contain'};filter: {item.filter};transform: scale({item.flipped ? '-1' : '1'}, {item.flippedY ? '-1' : '1'});"
                        muted={mirror || item.muted}
                        volume={Math.max(1, $volume)}
                        autoplay
                        loop
                    >
                        <track kind="captions" />
                    </video>
                {:else}
                    <!-- WIP image flashes when loading new image (when changing slides with the same image) -->
                    <!-- TODO: use custom transition... -->
                    <Image src={item.src} alt="" style="width: 100%;height: 100%;object-fit: {item.fit || 'contain'};filter: {item.filter};transform: scale({item.flipped ? '-1' : '1'}, {item.flippedY ? '-1' : '1'});" />
                    <!-- bind:loaded bind:hover bind:duration bind:videoElem {type} {path} {name} {filter} {flipped} -->
                    <!-- <MediaLoader path={item.src} /> -->
                {/if}
            {/if}
        {:else if item?.type === "camera"}
            {#if item.device}
                <Cam cam={item.device} item />
            {/if}
        {:else if item?.type === "timer"}
            <!-- {#key item.timer} -->
            <Timer {item} id={item.timerId || ""} {today} style={item.auto === false ? "" : `font-size: ${autoSize}px;`} />
            <!-- {/key} -->
        {:else if item?.type === "clock"}
            <Clock {autoSize} style={false} {...item.clock} />
        {:else if item?.type === "events"}
            <DynamicEvents {...item.events} textSize={smallFontSize ? (-1.1 * $slidesOptions.columns + 12) * 5 : Number(getStyles(item.style, true)?.["font-size"]) || 80} />
        {:else if item?.type === "variable"}
            <Variable {item} style={item?.style?.includes("font-size") && item.style.split("font-size:")[1].trim()[0] !== "0" ? "" : `font-size: ${autoSize}px;`} />
        {:else if item?.type === "mirror"}
            <Mirror {item} {ref} {ratio} index={slideIndex} />
        {:else if item?.type === "visualizer"}
            <Visualizer {item} {preview} />
        {:else if item?.type === "icon"}
            {#if item.customSvg}
                <div class="customIcon" class:customColor={item?.style.includes("color:") && !item?.style.includes("color:#FFFFFF;")}>
                    {@html item.customSvg}
                </div>
            {:else}
                <Icon style="zoom: {1 / ratio};" id={item.id || ""} fill white custom />
            {/if}
        {/if}
    </div>
{:else}
    <!-- bind:offsetHeight={height} bind:offsetWidth={width} -->
    <div
        class="item"
        style="{style ? getAlphaStyle(item?.style) : null};transition: filter 500ms, backdrop-filter 500ms;{filter ? 'filter: ' + filter + ';' : ''}{backdropFilter ? 'backdrop-filter: ' + backdropFilter + ';' : ''}{animationStyle.item || ''}"
        class:white={key && !lines?.length}
        class:key
        class:addDefaultItemStyle
        class:isDisabledVariable
        class:hidden
    >
        {#if lines}
            <div
                class="align"
                class:topBottomScrolling={item?.scrolling?.type === "top_bottom"}
                class:bottomTopScrolling={item?.scrolling?.type === "bottom_top"}
                class:leftRightScrolling={item?.scrolling?.type === "left_right"}
                class:rightLeftScrolling={item?.scrolling?.type === "right_left"}
                style={style ? item.align : null}
                bind:this={alignElem}
            >
                <div
                    class="lines"
                    class:cacheText
                    style="{style && lineGap ? `gap: ${lineGap}px;` : ''}{smallFontSize || customFontSize !== null ? '--font-size: ' + (smallFontSize ? (-1.1 * $slidesOptions.columns + 12) * 5 : customFontSize) + 'px;' : ''}{textAnimation}"
                >
                    {#each lines as line, i}
                        {#if linesStart === null || linesEnd === null || (i >= linesStart && i < linesEnd)}
                            {#if chords && chordLines[i]}
                                <div
                                    class:first={i === 0}
                                    class="break chords"
                                    class:stageChords={!!stageItem}
                                    style="--chord-size: {stageItem?.chordsData?.size || item.chords?.size || 30}px;--chord-color: {stageItem?.chordsData?.color || item.chords?.color || '#FF851B'};"
                                >
                                    {@html chordLines[i]}
                                </div>
                            {/if}
                            <!-- class:height={!line.text[0]?.value.length} -->
                            <div class="break" class:smallFontSize={smallFontSize || customFontSize || textAnimation.includes("font-size")} style="{style && lineBg ? `background-color: ${lineBg};` : ''}{style ? line.align : ''}">
                                {#each line.text || [] as text}
                                    {@const value = text.value.replaceAll("\n", "<br>") || "<br>"}
                                    <span style="{style ? getAlphaStyle(text.style) : ''}{fontSizeValue ? `font-size: ${fontSizeValue};` : ''}">
                                        {@html value.includes("{") ? replaceDynamicValues(value, { showId: ref.showId, layoutId: ref.layoutId, slideIndex }) : value}
                                    </span>
                                {/each}
                            </div>
                        {/if}
                    {/each}
                </div>

                {#if cacheText}
                    {@html cachedLines}
                {/if}
            </div>
        {:else if item?.type === "list"}
            <ListView list={item.list} disableTransition={disableListTransition} />
        {:else if item?.type === "media"}
            {#if item.src}
                {#if getMediaType(getExtension(item.src)) === "video"}
                    <!-- video -->
                    <video
                        src={item.src}
                        style="width: 100%;height: 100%;object-fit: {item.fit || 'contain'};filter: {item.filter};transform: scale({item.flipped ? '-1' : '1'}, {item.flippedY ? '-1' : '1'});"
                        muted={mirror || item.muted}
                        volume={Math.max(1, $volume)}
                        autoplay
                        loop
                    >
                        <track kind="captions" />
                    </video>
                {:else}
                    <!-- WIP image flashes when loading new image (when changing slides with the same image) -->
                    <Image transition={false} src={item.src} alt="" style="width: 100%;height: 100%;object-fit: {item.fit || 'contain'};filter: {item.filter};transform: scale({item.flipped ? '-1' : '1'}, {item.flippedY ? '-1' : '1'});" />
                    <!-- bind:loaded bind:hover bind:duration bind:videoElem {type} {path} {name} {filter} {flipped} -->
                    <!-- <MediaLoader path={item.src} /> -->
                {/if}
            {/if}
        {:else if item?.type === "camera"}
            {#if item.device}
                <Cam cam={item.device} item />
            {/if}
        {:else if item?.type === "timer"}
            <!-- {#key item.timer} -->
            <Timer {item} id={item.timerId || ""} {today} style={item.auto === false ? "" : `font-size: ${autoSize}px;`} />
            <!-- {/key} -->
        {:else if item?.type === "clock"}
            <Clock {autoSize} style={false} {...item.clock} />
        {:else if item?.type === "events"}
            <DynamicEvents {...item.events} textSize={smallFontSize ? (-1.1 * $slidesOptions.columns + 12) * 5 : Number(getStyles(item.style, true)?.["font-size"]) || 80} />
        {:else if item?.type === "variable"}
            <Variable {item} style={item?.style?.includes("font-size") && item.style.split("font-size:")[1].trim()[0] !== "0" ? "" : `font-size: ${autoSize}px;`} />
        {:else if item?.type === "web"}
            <Website src={item?.web?.src || ""} clickable={$currentWindow === "output"} />
        {:else if item?.type === "mirror"}
            <Mirror {item} {ref} {ratio} index={slideIndex} />
        {:else if item?.type === "visualizer"}
            <Visualizer {item} {preview} />
        {:else if item?.type === "icon"}
            {#if item.customSvg}
                <div class="customIcon" class:customColor={item?.style.includes("color:") && !item?.style.includes("color:#FFFFFF;")}>
                    {@html item.customSvg}
                </div>
            {:else}
                <Icon style="zoom: {1 / ratio};" id={item.id || ""} fill white custom />
            {/if}
        {/if}
    </div>
{/if}

<style>
    .item {
        /* WIP this is for scrolling, but hides overflow text even on scroll */
        overflow: hidden;
    }

    .hidden {
        opacity: 0;
    }

    /* .align .lines:nth-child(1) {
        position: absolute;
    } */
    .cacheText {
        opacity: 0;
        position: absolute;
    }

    .align {
        height: 100%;
        display: flex;
        text-align: center;
        align-items: center;
    }

    /* should match .edit in Editbox.svelte */
    .lines {
        /* overflow-wrap: break-word;
  font-size: 0; */
        width: 100%;

        display: flex;
        flex-direction: column;
        text-align: center;
        justify-content: center;

        transition: var(--transition);
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

    .break:not(.stageChords) :global(span) {
        font-size: 100px;
        min-height: 50px;
        /* display: inline-block; */

        transition: var(--transition);
    }
    .break.smallFontSize :global(span) {
        /* font-size: 30px; */
        font-size: var(--font-size) !important;
    }

    /* .height {
        height: 1em;
    } */

    /* stage current slide */
    .item.addDefaultItemStyle {
        color: white;
        font-size: 100px;
        font-family: unset;
        line-height: 1.1;
        -webkit-text-stroke-color: #000000;
        text-shadow: 2px 2px 10px #000000;

        border-style: solid;
        border-width: 0px;
        border-color: #ffffff;

        height: 150px;
        width: 400px;
    }

    .item.isDisabledVariable {
        display: none;
    }

    /* scrolling */
    /* WIP change time */
    /* WIP scroll with overflow too */
    .item .topBottomScrolling {
        animation: topBottom 15s linear infinite normal;
    }
    .item .bottomTopScrolling {
        animation: bottomTop 15s linear infinite normal;
    }
    .item .leftRightScrolling {
        animation: leftRight 15s linear infinite normal;
    }
    .item .rightLeftScrolling {
        animation: rightLeft 15s linear infinite normal;
    }

    @keyframes topBottom {
        from {
            transform: translateY(-100%);
        }
        to {
            transform: translateY(100%);
        }
    }
    @keyframes bottomTop {
        from {
            transform: translateY(100%);
        }
        to {
            transform: translateY(-100%);
        }
    }
    @keyframes leftRight {
        from {
            transform: translateX(-100%);
        }
        to {
            transform: translateX(100%);
        }
    }
    @keyframes rightLeft {
        from {
            transform: translateX(100%);
        }
        to {
            transform: translateX(-100%);
        }
    }

    /* chords */
    .break.chords :global(.invisible) {
        opacity: 0;
        line-height: 0;
        font-size: 100px;
    }
    .break.chords :global(.chord) {
        position: absolute;
        color: var(--chord-color);
        font-size: var(--chord-size) !important;
        bottom: -5px;
        transform: translateX(-25%);
        /* WIP chords goes over other (stage) items */
        z-index: 2;
    }
    .break.chords {
        line-height: 0.5em;
        max-height: 15px;
        position: relative;
        pointer-events: none;
    }
    .break.chords.first {
        line-height: var(--chord-size) !important;
        /* max-height: unset; */
    }

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
