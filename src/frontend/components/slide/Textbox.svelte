<script lang="ts">
    import { onMount } from "svelte"
    import type { Item } from "../../../types/Show"
    import { currentWindow, outputs, overlays, showsCache, slidesOptions, templates, variables, volume } from "../../stores"
    import Cam from "../drawer/live/Cam.svelte"
    import Image from "../drawer/media/Image.svelte"
    import autosize, { AutosizeTypes } from "../edit/scripts/autosize"
    import Icon from "../helpers/Icon.svelte"
    import { clone } from "../helpers/array"
    import { encodeFilePath, getExtension, getMediaType, loadThumbnail, mediaSize } from "../helpers/media"
    import { replaceDynamicValues } from "../helpers/showActions"
    import { _show } from "../helpers/shows"
    import { getStyles } from "../helpers/style"
    import Clock from "../system/Clock.svelte"
    import Captions from "./views/Captions.svelte"
    import DynamicEvents from "./views/DynamicEvents.svelte"
    import ListView from "./views/ListView.svelte"
    import Mirror from "./views/Mirror.svelte"
    import SlideProgress from "./views/SlideProgress.svelte"
    import Timer from "./views/Timer.svelte"
    import Variable from "./views/Variable.svelte"
    import Visualizer from "./views/Visualizer.svelte"
    import Website from "./views/Website.svelte"
    import { getActiveOutputs } from "../helpers/output"

    export let item: Item
    export let itemIndex: number = -1
    export let slideIndex: number = 0
    export let preview: boolean = false
    export let mirror: boolean = true
    export let isMirrorItem: boolean = false
    export let ratio: number = 1
    export let filter: string = ""
    export let backdropFilter: string = ""
    export let key: boolean = false
    export let disableListTransition: boolean = false
    export let smallFontSize: boolean = false
    export let addDefaultItemStyle: boolean = false
    export let animationStyle: any = {}
    export let dynamicValues: boolean = true
    export let isStage: boolean = false
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
    export let customStyle: string = ""
    export let stageItem: any = {}
    export let chords: boolean = false
    export let linesStart: null | number = null
    export let linesEnd: null | number = null
    export let stageAutoSize: boolean = false
    export let fontSize: number = 0
    export let maxLines: number = 0 // stage next item preview

    $: lines = clone(item?.lines)
    $: if (linesStart !== null && linesEnd !== null && lines?.length) {
        lines = lines.filter((a) => a.text.filter((a) => a.value !== undefined)?.length)

        // show last possible lines if no text at current line
        if (!lines[linesStart]) {
            let linesCount = linesEnd - linesStart
            let length = lines.length - 1
            let index = length - (length % linesCount)
            linesStart = index
            linesEnd = index + linesCount
        }
    }

    // timer updater
    let today = new Date()
    let loaded = false
    onMount(() => {
        setTimeout(() => (loaded = true), 100)

        if (item?.type !== "timer") return
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

    $: textAnimation = animationStyle.text || ""

    // AUTO SIZE

    let itemElem: any

    let previousItem = "{}"
    $: newItem = JSON.stringify(item)
    $: if (itemElem && loaded && (stageAutoSize || newItem !== previousItem || chordLines || stageItem)) calculateAutosize()

    // recalculate auto size if output template is different than show template
    $: currentShowTemplateId = _show(ref.showId).get("settings.template")
    // let outputTemplateAutoSize = false
    $: outputSlide = $outputs[getActiveOutputs()[0]]?.out?.slide
    $: if (item?.type === "slide_tracker" && outputSlide) setTimeout(calculateAutosize) // overlay progress update
    $: if ($currentWindow === "output" && outputStyle.template && outputStyle.template !== currentShowTemplateId && !stageAutoSize) calculateAutosize()
    // else outputTemplateAutoSize = false

    // $: fontSizeValue = stageAutoSize || item.auto || outputTemplateAutoSize ? fontSize : fontSize

    let customTypeRatio = 1

    let loopStop: any = null
    let newCall: boolean = false
    function calculateAutosize() {
        if (isStage && !stageAutoSize) return

        if (loopStop) {
            newCall = true
            return
        }
        loopStop = setTimeout(() => {
            loopStop = null
            if (newCall) calculateAutosize()
            newCall = false
        }, 200)
        previousItem = newItem

        let type = (item?.textFit || "shrinkToFit") as AutosizeTypes

        let defaultFontSize
        let maxFontSize

        if (isStage) {
            type = "growToFit"
        } else {
            if ((item.type || "text") === "text" && !item.auto) {
                fontSize = 0
                return
            }

            const itemText = item?.lines?.[0]?.text?.filter((a) => a.customType !== "disableTemplate") || []
            let itemFontSize = Number(getStyles(itemText[0]?.style, true)?.["font-size"] || "") || 100

            // get scripture verse ratio
            const verseItemText = item?.lines?.[0]?.text?.filter((a) => a.customType === "disableTemplate") || []
            const verseItemSize = Number(getStyles(verseItemText[0]?.style, true)?.["font-size"] || "") || 0
            customTypeRatio = verseItemSize / 100 || 1

            defaultFontSize = itemFontSize
            if (type === "growToFit") maxFontSize = itemFontSize
        }

        let elem = itemElem
        if (!elem) return

        let textQuery = ""
        if ((item.type || "text") === "text") {
            elem = elem.querySelector(".align")
            textQuery = ".lines .break span"
        } else {
            type = "growToFit"
            if (item.type === "slide_tracker") textQuery = ".progress div"
        }
        // not working due to stage SlideText "loading" elem?
        // if (isStage) {
        //     elem = itemElem?.closest(".stage_item")
        //     textQuery = ".align .item .align " + textQuery
        // }

        fontSize = autosize(elem, { type, textQuery, defaultFontSize, maxFontSize })

        if (item.type === "slide_tracker") return
        if (fontSize !== item.autoFontSize) setItemAutoFontSize(fontSize)
    }

    function setItemAutoFontSize(fontSize) {
        if (isStage || itemIndex < 0 || $currentWindow || ref.id === "scripture") return

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
                if (!a[ref.showId!]) return a

                a[ref.showId!].slides[ref.id].items[itemIndex].autoFontSize = fontSize
                return a
            })
        }
    }

    // CHORDS

    let chordLines: string[] = []
    $: if (chords && (item.lines || fontSize)) createChordLines()
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

                    // let size = fontSizeValue
                    let size = fontSize || 0
                    html += `<span class="invisible" style="${style ? getAlphaStyle(text.style) : ""}${size ? `font-size: ${size}px;` : ""}">${letter}</span>`

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

    // WIP padding can be checked by auto size if style is added to parent
    function getPaddingCorrection(stageItem: any) {
        let result = ""
        if (stageItem.style?.indexOf("padding") > -1) {
            let styles = stageItem.style.split(";")
            styles.forEach((s: string) => {
                if (s.indexOf("padding") === 0) {
                    let padding = parseInt(s.split(":")[1].replace("px", "").trim(), 0) * 2
                    if (padding > 0) result = "width: calc(100% - " + padding + "px); height: calc(100% - " + padding + "px);"
                }
            })
        }
        setTimeout(calculateAutosize, 150)
        return result
    }

    $: isDisabledVariable = item?.type === "variable" && $variables[item?.variable?.id]?.enabled === false
    let paddingCorrection = ""
    $: paddingCorrection = getPaddingCorrection(stageItem)

    let mediaItemPath = ""
    $: if (item?.type === "media" && item.src) getMediaItemPath()
    async function getMediaItemPath() {
        mediaItemPath = ""
        if (!item.src) return

        // only load thumbnails in main
        if ($currentWindow || preview) {
            mediaItemPath = item.src
            return
        }

        mediaItemPath = await loadThumbnail(item.src, mediaSize.slideSize)
    }

    // UPDATE DYNAMIC VALUES e.g. {time_} EVERY SECOND
    let updateDynamic = 0
    setInterval(() => {
        updateDynamic++
    }, 1000)
</script>

<div
    class="item"
    style="{style ? getAlphaStyle(item?.style) : null};{paddingCorrection}{filter ? 'filter: ' + filter + ';' : ''}{backdropFilter ? 'backdrop-filter: ' + backdropFilter + ';' : ''}{animationStyle.item || ''}"
    class:white={key && !lines?.length}
    class:key
    class:addDefaultItemStyle
    class:isDisabledVariable
    bind:this={itemElem}
>
    {#if lines}
        <div
            class="align"
            class:topBottomScrolling={!isStage && item?.scrolling?.type === "top_bottom"}
            class:bottomTopScrolling={!isStage && item?.scrolling?.type === "bottom_top"}
            class:leftRightScrolling={!isStage && item?.scrolling?.type === "left_right"}
            class:rightLeftScrolling={!isStage && item?.scrolling?.type === "right_left"}
            style="--scrollSpeed: {item?.scrolling?.speed ?? 15}s;{style ? item?.align : null}"
        >
            <div
                class="lines"
                style="{style && lineGap ? `gap: ${lineGap}px;` : ''}{smallFontSize || customFontSize !== null ? '--font-size: ' + (smallFontSize ? (-1.1 * $slidesOptions.columns + 12) * 5 : customFontSize) + 'px;' : ''}{textAnimation}"
            >
                {#each lines as line, i}
                    {#if (linesStart === null || linesEnd === null || (i >= linesStart && i < linesEnd)) && (!maxLines || i < maxLines)}
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
                                <span
                                    style="{style ? getAlphaStyle(text.style) : ''}{customStyle}{text.customType === 'disableTemplate' ? text.style : ''}{fontSize
                                        ? `;font-size: ${fontSize * (text.customType === 'disableTemplate' ? customTypeRatio : 1)}px;`
                                        : ''}"
                                >
                                    {@html dynamicValues && value.includes("{") ? replaceDynamicValues(value, { ...ref, slideIndex }, updateDynamic) : value}
                                </span>
                            {/each}
                        </div>
                    {/if}
                {/each}
            </div>
        </div>
    {:else if item?.type === "list"}
        <ListView list={item.list} disableTransition={disableListTransition} />
    {:else if item?.type === "media"}
        {#if mediaItemPath}
            {#if ($currentWindow || preview) && getMediaType(getExtension(mediaItemPath)) === "video"}
                <video
                    src={encodeFilePath(mediaItemPath)}
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
                <Image
                    src={mediaItemPath}
                    alt=""
                    style="width: 100%;height: 100%;object-fit: {item.fit || 'contain'};filter: {item.filter};transform: scale({item.flipped ? '-1' : '1'}, {item.flippedY ? '-1' : '1'});"
                    transition={item.actions?.transition?.duration && item.actions?.transition?.type !== "none"}
                />
            {/if}
        {/if}
    {:else if item?.type === "camera"}
        {#if item.device}
            <Cam cam={item.device} item style="object-fit: {item.fit || 'contain'};filter: {item.filter};transform: scale({item.flipped ? '-1' : '1'}, {item.flippedY ? '-1' : '1'});" />
        {/if}
    {:else if item?.type === "timer"}
        <Timer {item} id={item.timerId || ""} {today} style={item.auto === false ? "" : `font-size: ${fontSize}px;`} />
    {:else if item?.type === "clock"}
        <Clock autoSize={fontSize} style={false} {...item.clock} />
    {:else if item?.type === "events"}
        <DynamicEvents {...item.events} textSize={smallFontSize ? (-1.1 * $slidesOptions.columns + 12) * 5 : Number(getStyles(item.style, true)?.["font-size"]) || 80} />
    {:else if item?.type === "variable"}
        <Variable {item} style={item?.style?.includes("font-size") && item.style.split("font-size:")[1].trim()[0] !== "0" ? "" : `font-size: ${fontSize}px;`} ref={{ ...ref, slideIndex }} />
    {:else if item?.type === "web"}
        <Website src={item?.web?.src || ""} navigation={!item?.web?.noNavigation} clickable={$currentWindow === "output"} {ratio} />
    {:else if item?.type === "mirror"}
        <!-- no mirrors in mirrors! -->
        {#if !isMirrorItem}
            <Mirror {item} {ref} {ratio} index={slideIndex} />
        {/if}
    {:else if item?.type === "slide_tracker"}
        <SlideProgress tracker={item.tracker || {}} autoSize={item.auto === false ? 0 : fontSize} />
    {:else if item?.type === "visualizer"}
        <Visualizer {item} {preview} />
    {:else if item?.type === "captions"}
        <Captions {item} />
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

<style>
    .item {
        /* WIP this is for scrolling, but hides overflow text even on scroll */
        overflow: hidden;

        /* WIP custom time based on transition duration */
        transition:
            filter 500ms,
            backdrop-filter 500ms;
    }

    /* .align .lines:nth-child(1) {
        position: absolute;
    } */

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
        animation: topBottom var(--scrollSpeed) linear infinite normal;
    }
    .item .bottomTopScrolling {
        animation: bottomTop var(--scrollSpeed) linear infinite normal;
    }
    .item .leftRightScrolling {
        animation: leftRight var(--scrollSpeed) linear infinite normal;
    }
    .item .rightLeftScrolling {
        animation: rightLeft var(--scrollSpeed) linear infinite normal;
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
        line-height: 1.1em;
        font-size: 100px;
    }
    .break.chords :global(.chord) {
        position: absolute;
        color: var(--chord-color);
        font-size: var(--chord-size) !important;

        transform: translate(-50%, -20%);
        line-height: initial;
        /* WIP chords goes over other (stage) items */
        z-index: 2;
    }
    .break.chords {
        line-height: 0.5em;
        max-height: 15px;
        position: relative;
        pointer-events: none;

        /* reset */
        font-weight: normal;
        font-style: normal;
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
