<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { OUTPUT } from "../../../types/Channels"
    import type { Styles } from "../../../types/Settings"
    import type { Item, Transition } from "../../../types/Show"
    import { currentWindow, outputs, overlays, showsCache, styles, templates, variables } from "../../stores"
    import { send } from "../../utils/request"
    import autosize from "../edit/scripts/autosize"
    import { clone } from "../helpers/array"
    import { getActiveOutputs, getOutputResolution, percentageStylePos } from "../helpers/output"
    import { getNumberVariables } from "../helpers/showActions"
    import { _show } from "../helpers/shows"
    import { getStyles } from "../helpers/style"
    import SlideItems from "./SlideItems.svelte"
    import TextboxLines from "./TextboxLines.svelte"

    export let item: Item
    export let itemIndex = -1
    export let slideIndex = 0
    export let preview = false
    export let mirror = true
    export let isMirrorItem = false
    export let ratio = 1
    export let outputId = ""
    export let filter = ""
    export let backdropFilter = ""
    export let key = false
    export let transition: Transition | null = null
    export let disableListTransition = false
    export let smallFontSize = false
    export let animationStyle: any = {}
    export let dynamicValues = true
    export let isStage = false
    export let originalStyle = false
    export let customFontSize: number | null = null
    export let outputStyle: Styles | null = null
    export let ref: {
        type?: "show" | "stage" | "overlay" | "template"
        showId?: string
        slideId?: string
        layoutId?: string
        id: string
    }
    export let style = true
    export let customStyle = ""
    export let stageItem: any = {}
    export let chords = false
    export let linesStart: null | number = null
    export let linesEnd: null | number = null
    export let clickRevealed = false
    export let stageAutoSize = false
    export let fontSize = 0
    export let maxLines = 0 // stage next item preview
    export let maxLinesInvert = false // stage next item preview (last lines)
    export let centerPreview = false
    export let revealed = -1
    export let styleIdOverride = ""

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
    let loaded = false
    let dateInterval: NodeJS.Timeout | null = null
    onMount(() => {
        setTimeout(() => (loaded = true), 100)
    })
    onDestroy(() => {
        if (dateInterval) clearInterval(dateInterval)
    })

    // $: if (item.type === "timer") ref.id = item.timer!.id!

    let customOutputId = outputId
    $: if (!outputId) customOutputId = getActiveOutputs($outputs, true, true, true)[0]

    function getCustomStyle(currentStyle: string, outputId = "", styleIdOverride = "", _updater: any = null) {
        if (outputId && !isMirrorItem && !isStage) {
            let outputResolution = getOutputResolution(outputId, $outputs, true, styleIdOverride)
            currentStyle = percentageStylePos(currentStyle, outputResolution)
        }

        // reset item styles (as it's set in parent item)
        if (isStage && !originalStyle) {
            currentStyle += "display: contents;"
        }

        if (!key) return currentStyle
        let styles = getStyles(currentStyle)

        // alpha style
        let alphaStyles = ";"
        let bgAlpha = getAlphaValues(styles["background-color"])
        let textAlpha = getAlphaValues(styles["color"]) || 1
        if (bgAlpha) alphaStyles += "background-color: rgb(255 255 255 / " + bgAlpha + ");"
        alphaStyles += "color: rgb(255 255 255 / " + textAlpha + ");"

        return currentStyle + alphaStyles
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

    // AUTO SIZE

    let itemElem: HTMLElement | undefined

    let previousItem = "{}"
    $: newItem = JSON.stringify(item)
    $: if (itemElem && loaded && (stageAutoSize || newItem !== previousItem || chordLines || stageItem)) calculateAutosize()
    $: if ($variables) setTimeout(calculateAutosize)

    // recalculate auto size if output template is different than show template
    $: currentShowTemplateId = _show(ref.showId).get("settings.template")
    // let outputTemplateAutoSize = false
    $: outputSlide = $outputs[getActiveOutputs()[0]]?.out?.slide
    $: if (item?.type === "slide_tracker" && outputSlide) setTimeout(calculateAutosize) // overlay progress update
    $: if ($currentWindow === "output" && outputStyle?.template && outputStyle.template !== currentShowTemplateId && !stageAutoSize) calculateAutosize()
    // else outputTemplateAutoSize = false

    // $: fontSizeValue = stageAutoSize || item.auto || outputTemplateAutoSize ? fontSize : fontSize

    let customTypeRatio = 1

    let loopStop: NodeJS.Timeout | null = null
    let newCall = false
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

        let type = item?.textFit || "shrinkToFit"

        let defaultFontSize
        let maxFontSize

        const isTextItem = (item.type || "text") === "text"

        if (isStage) {
            if (stageItem?.type !== "text") type = stageItem?.textFit || "growToFit"

            // const textItem = isTextItem ? item?.lines?.[0]?.text || [] : stageItem
            let itemFontSize = Number(getStyles(stageItem?.style, true)?.["font-size"] || "") || 100

            defaultFontSize = itemFontSize
            if (type === "growToFit" && itemFontSize !== 100) maxFontSize = itemFontSize
        } else {
            if (isTextItem && !item.auto) {
                fontSize = 0
                return
            }

            let text = item?.lines?.[0]?.text || []
            if (!Array.isArray(text)) text = []
            const itemText = text.filter((a) => !a.customType?.includes("disableTemplate")) || []
            let itemFontSize = Number(getStyles(itemText[0]?.style, true)?.["font-size"] || "") || 100

            // get scripture verse ratio
            const verseItemText = text.filter((a) => a.customType?.includes("disableTemplate")) || []
            const verseItemSize = Number(getStyles(verseItemText[0]?.style, true)?.["font-size"] || "") || 0
            customTypeRatio = verseItemSize / 100 || 1

            defaultFontSize = itemFontSize
            if (type === "growToFit" && isTextItem) maxFontSize = itemFontSize
        }

        let elem = itemElem
        if (!elem) return

        let textQuery = ""
        if (isTextItem) {
            elem = elem.querySelector(".align") as HTMLElement
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

        // smaller in general if bullet list, because they are not accounted for
        if (item?.list?.enabled) fontSize *= 0.9

        if (item.type === "slide_tracker") return
        if (fontSize !== item.autoFontSize) setItemAutoFontSize(fontSize)
    }

    function setItemAutoFontSize(fontSize) {
        if (isStage || itemIndex < 0 || $currentWindow || ref.id === "scripture") return

        if (ref.type === "overlay") {
            overlays.update((a) => {
                if (!a[ref.id]?.items?.[itemIndex]) return a
                a[ref.id].items[itemIndex].autoFontSize = fontSize
                return a
            })
        } else if (ref.type === "template") {
            templates.update((a) => {
                if (!a[ref.id]?.items?.[itemIndex]) return a
                a[ref.id].items[itemIndex].autoFontSize = fontSize
                return a
            })
        } else if (ref.showId) {
            showsCache.update((a) => {
                if (!a[ref.showId!]?.slides?.[ref.id]?.items?.[itemIndex]) return a

                a[ref.showId!].slides[ref.id].items[itemIndex].autoFontSize = fontSize
                return a
            })
        }
    }

    // CHORDS

    let chordLines: any[] = []
    $: if (chords && (item.lines || fontSize)) createChordLines()
    function createChordLines() {
        chordLines = []
        if (!Array.isArray(item?.lines)) return

        item.lines.forEach((line) => {
            if (!line.chords?.length || !line.text) return
            chordLines.push(line.chords)
        })
    }

    // WIP padding can be checked by auto size if style is added to parent
    function getPaddingCorrection(stageItem: any) {
        let result = ""
        if (typeof stageItem?.style !== "string") return ""
        if (stageItem.style.indexOf("padding") > -1) {
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

    function press() {
        if ($currentWindow !== "output") return
        if (!item.button?.press) return

        send(OUTPUT, ["ACTION_MAIN"], { id: item.button.press })
    }

    function release() {
        if ($currentWindow !== "output") return
        if (!item.button?.release) return

        send(OUTPUT, ["ACTION_MAIN"], { id: item.button.release })
    }

    // give CSS access to number variable values
    $: cssVariables = getNumberVariables($variables, $outputs)

    // initialize default filter values to get the transition working (should use animation)
    // https://stackoverflow.com/questions/68632554/css-backdrop-filter-does-not-work-with-transition
    let noTransition = !transition || (transition.type || "none") === "none" || transition.duration === 0
    // const defaultValues = "opacity(1) saturate(1) contrast(1) brightness(1) blur(0px) invert(0) hue-rotate(0deg)"
    // let foregroundFiltersValues = `${filter ? "filter: " + filter + ";" : ""}${backdropFilter ? "backdrop-filter: " + backdropFilter + ";" : ""}`
    // let foregroundFiltersDefault = `${filter ? "filter: " + defaultValues + ";" : ""}${backdropFilter ? "backdrop-filter: " + defaultValues + ";" : ""}`
    // let foregroundFilters = foregroundFiltersValues ? (noTransition ? foregroundFiltersValues : foregroundFiltersDefault) : ""
    // setTimeout(() => (foregroundFilters = foregroundFiltersValues))
    $: foregroundFilters = `${filter ? "filter: " + filter + ";" : ""}${backdropFilter ? "backdrop-filter: " + backdropFilter + ";" : ""}`
</script>

<!-- lyrics view must have "width: 100%;height: 100%;" set -->
<div
    class="item"
    style="{style ? getCustomStyle(item?.style, customOutputId, styleIdOverride, { $styles }) : 'width: 100%;height: 100%;'};{paddingCorrection}{foregroundFilters}{animationStyle.item || ''}{cssVariables}"
    class:white={key && !lines?.length}
    class:key
    class:isStage
    class:isDisabledVariable
    class:noTransition
    class:chords={chordLines.length}
    class:clickable={$currentWindow === "output" && (item.button?.press || item.button?.release)}
    class:reveal={(centerPreview || isStage) && item.clickReveal && !clickRevealed}
    bind:this={itemElem}
    on:mousedown={press}
    on:mouseup={release}
>
    {#if lines}
        <TextboxLines
            {item}
            {slideIndex}
            {isMirrorItem}
            {key}
            {smallFontSize}
            {animationStyle}
            {dynamicValues}
            {isStage}
            {customFontSize}
            {outputStyle}
            {ref}
            {style}
            {customStyle}
            {stageItem}
            {chords}
            {linesStart}
            {linesEnd}
            fontSize={smallFontSize ? 20 : fontSize}
            {customTypeRatio}
            {maxLines}
            {maxLinesInvert}
            {centerPreview}
            {revealed}
            on:updateAutoSize={calculateAutosize}
        />
    {:else}
        <SlideItems {item} {slideIndex} {preview} {mirror} {isMirrorItem} {ratio} {disableListTransition} {smallFontSize} {ref} {fontSize} {outputId} />
    {/if}
</div>

<style>
    .item {
        /* WIP this is for scrolling, but hides overflow text even on scroll */
        overflow: hidden;

        /* click events */
        pointer-events: initial;

        /* WIP custom time based on transition duration */
        /* filter & dynamic CSS variable transition */
        transition:
            filter 500ms,
            backdrop-filter 500ms,
            all 0.1s;
    }
    .item.isStage {
        width: 100%;
        height: 100%;
    }

    .item.reveal {
        outline: 1px solid red;
        opacity: 0.6;
    }

    .clickable {
        cursor: pointer;
    }
    .clickable:active {
        filter: brightness(0.8);
    }

    .white {
        /* filter: brightness(30); */
        filter: grayscale(1) brightness(20);
    }
    .key {
        filter: grayscale(1);
    }

    /* .height {
        height: 1em;
    } */

    .item.isDisabledVariable {
        display: none;
    }

    .item.chords,
    .item.chords :global(.align) {
        overflow: visible;
    }
</style>
