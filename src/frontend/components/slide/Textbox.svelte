<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import type { Styles } from "../../../types/Settings"
    import type { Item } from "../../../types/Show"
    import { currentWindow, outputs, overlays, showsCache, styles, templates, variables } from "../../stores"
    import autosize, { AutosizeTypes } from "../edit/scripts/autosize"
    import { clone } from "../helpers/array"
    import { getActiveOutputs, getOutputResolution, percentageStylePos } from "../helpers/output"
    import { _show } from "../helpers/shows"
    import { getStyles } from "../helpers/style"
    import SlideItems from "./SlideItems.svelte"
    import TextboxLines from "./TextboxLines.svelte"

    export let item: Item
    export let itemIndex: number = -1
    export let slideIndex: number = 0
    export let preview: boolean = false
    export let mirror: boolean = true
    export let isMirrorItem: boolean = false
    export let ratio: number = 1
    export let outputId: string = ""
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
    export let outputStyle: Styles | null = null
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
    let loaded = false
    let dateInterval: NodeJS.Timeout | null = null
    onMount(() => {
        setTimeout(() => (loaded = true), 100)
    })
    onDestroy(() => {
        clearInterval(dynamicInterval)
        if (dateInterval) clearInterval(dateInterval)
    })

    // $: if (item.type === "timer") ref.id = item.timer!.id!

    let customOutputId = outputId
    $: if (!outputId) customOutputId = getActiveOutputs($outputs, true, true, true)[0]

    function getCustomStyle(style: string, outputId: string = "", _updater: any = null) {
        if (outputId && !isMirrorItem) {
            let outputResolution = getOutputResolution(outputId, $outputs, true)
            style = percentageStylePos(style, outputResolution)
        }

        if (!key) return style
        let styles = getStyles(style)

        // alpha style
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

    // AUTO SIZE

    let itemElem: HTMLElement | undefined

    let previousItem = "{}"
    $: newItem = JSON.stringify(item)
    $: if (itemElem && loaded && (stageAutoSize || newItem !== previousItem || chordLines || stageItem)) calculateAutosize()

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

            const itemText = item?.lines?.[0]?.text?.filter((a) => !a.customType?.includes("disableTemplate")) || []
            let itemFontSize = Number(getStyles(itemText[0]?.style, true)?.["font-size"] || "") || 100

            // get scripture verse ratio
            const verseItemText = item?.lines?.[0]?.text?.filter((a) => a.customType?.includes("disableTemplate")) || []
            const verseItemSize = Number(getStyles(verseItemText[0]?.style, true)?.["font-size"] || "") || 0
            customTypeRatio = verseItemSize / 100 || 1

            defaultFontSize = itemFontSize
            if (type === "growToFit") maxFontSize = itemFontSize
        }

        let elem = itemElem
        if (!elem) return

        let textQuery = ""
        if ((item.type || "text") === "text") {
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

    let chordLines: string[] = []
    $: if (chords && (item.lines || fontSize)) createChordLines()
    function createChordLines() {
        chordLines = []
        if (!Array.isArray(item?.lines)) return

        item.lines.forEach((line, i) => {
            if (!line.chords?.length || !line.text) return

            let chords = clone(line.chords || [])

            let html = ""
            let index = 0
            line.text.forEach((text) => {
                let value = text.value.trim().replaceAll("\n", "") || ""

                let letters = value.split("")
                letters.forEach((letter) => {
                    let chordIndex = chords.findIndex((a) => a.pos === index)
                    if (chordIndex >= 0) {
                        html += `<span class="chord">${chords[chordIndex].key}</span>`
                        chords.splice(chordIndex, 1)
                    }

                    // let size = fontSizeValue
                    let size = fontSize || 0
                    html += `<span class="invisible" style="${style ? getCustomStyle(text.style) : ""}${size ? `font-size: ${size}px;` : ""}">${letter}</span>`

                    index++
                })
            })

            chords.forEach((chord, i) => {
                html += `<span class="chord" style="transform: translateX(${60 * (i + 1)}px);">${chord.key}</span>`
            })

            if (!html) return
            chordLines[i] = html
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

    // UPDATE DYNAMIC VALUES e.g. {time_} EVERY SECOND
    let updateDynamic = 0
    $: if ($variables) updateDynamic++
    const dynamicInterval = setInterval(() => {
        updateDynamic++
    }, 1000)
</script>

<div
    class="item"
    style="{style ? getCustomStyle(item?.style, customOutputId, { $styles }) : null};{paddingCorrection}{filter ? 'filter: ' + filter + ';' : ''}{backdropFilter ? 'backdrop-filter: ' + backdropFilter + ';' : ''}{animationStyle.item || ''}"
    class:white={key && !lines?.length}
    class:key
    class:addDefaultItemStyle
    class:isDisabledVariable
    class:chords={chordLines.length}
    bind:this={itemElem}
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
            {fontSize}
            {customTypeRatio}
            {maxLines}
        />
    {:else}
        <SlideItems {item} {slideIndex} {preview} {mirror} {isMirrorItem} {ratio} {disableListTransition} {smallFontSize} {ref} {fontSize} />
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

    .item.chords,
    .item.chords :global(.align) {
        overflow: visible;
    }
</style>
