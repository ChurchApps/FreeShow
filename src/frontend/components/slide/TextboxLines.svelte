<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte"
    import type { Styles } from "../../../types/Settings"
    import type { Item, TemplateStyleOverride } from "../../../types/Show"
    import { createVirtualBreaks } from "../../show/slides"
    import { outputs, slidesOptions, styles, variables } from "../../stores"
    import { clone } from "../helpers/array"
    import { getFirstActiveOutput, getOutputResolution, percentageStylePos } from "../helpers/output"
    import { replaceDynamicValues } from "../helpers/showActions"
    import { getStyles } from "../helpers/style"
    import { applyStyleOverrides } from "./wordOverride"

    export let item: Item
    export let slideIndex = 0
    export let isMirrorItem = false
    export let key = false
    export let smallFontSize = false
    export let animationStyle: any = {}
    export let dynamicValues = true
    export let isStage = false
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
    export let fontSize = 0
    export let customTypeRatio = 1
    export let maxLines = 0 // stage next item preview
    export let maxLinesInvert = false // stage next item preview (last lines)
    export let centerPreview = false
    export let revealed = -1
    export let styleOverrides: TemplateStyleOverride[] = []

    $: lines = createVirtualBreaks(clone(item?.lines || []), outputStyle?.skipVirtualBreaks)
    $: if (linesStart !== null && linesEnd !== null && lines.length) {
        lines = lines.filter(a => a.text.filter(a => a.value !== undefined)?.length)

        // show last possible lines if no text at current line
        if (!lines[linesStart]) {
            let linesCount = linesEnd - linesStart
            let length = lines.length - 1
            let index = length - (length % linesCount)
            linesStart = index
            linesEnd = index + linesCount
        }
    }

    let renderedLines: any[] = []
    $: renderedLines = styleOverrides?.length ? applyStyleOverrides(lines, styleOverrides) : lines

    onDestroy(() => {
        clearInterval(dynamicInterval)
    })

    function getCustomStyle(style: string, outputId = "", _updater: any = null) {
        if (!style) return ""

        if (outputId && !isMirrorItem) {
            let outputResolution = getOutputResolution(outputId, $outputs, true)
            style = percentageStylePos(style, outputResolution)
        }

        // text gradient

        if (style.includes("-gradient")) {
            let styles = getStyles(style)
            const gradient = styles.color
            style += `background-image: ${gradient};color: transparent;background-clip: text;`
            // shadow will show over the gradient (this can be a cool effect, but has to be explicitly set)
            if (!style.includes("text-shadow") || style.includes("2px 2px 10px #000000;")) style += "text-shadow: none;"
        }

        // alpha key output (not in use anymore)
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

    $: lineGap = item?.specialStyle?.lineGap
    $: lineRadius = item?.specialStyle?.lineRadius || 0
    $: lineBg = item?.specialStyle?.lineBg
    $: lineStyleBox = lineGap ? `gap: ${lineGap}px;` : ""
    $: lineStyle = (lineRadius ? `border-radius: ${lineRadius}px;` : "") + (lineBg ? `background: ${lineBg};` : "")

    $: textAnimation = animationStyle.text || ""

    // FONT SIZE

    let cssFontSize = 0
    function getCustomFontSize(style: string, outputStyle: Styles | null) {
        const fontSize = Number(getStyles(style, true)["font-size"] || 100)
        cssFontSize = fontSize

        // get first output style
        if (!outputStyle) {
            const currentOutput = getFirstActiveOutput()
            outputStyle = $styles[currentOutput?.style || ""] || null
        }
        if (!outputStyle) return ""

        const customFontSizeRatio = (outputStyle.aspectRatio?.fontSizeRatio ?? 100) / 100
        cssFontSize = fontSize * customFontSizeRatio
        return `font-size: ${fontSize * customFontSizeRatio}px;`
    }

    // CHORDS

    let chordLines: string[] = []
    $: if (chords && (item?.lines || fontSize)) setTimeout(createChordLines)
    function createChordLines() {
        chordLines = []
        if (!Array.isArray(item?.lines)) return

        item.lines.forEach((line, i) => {
            if (!line.chords?.length || !line.text) return

            let chords = clone(line.chords || [])

            let html = ""
            let index = 0
            line.text.forEach(text => {
                let value = text.value.trim().replaceAll("\n", "") || ""

                let letters = value.split("")
                letters.forEach(letter => {
                    let chordIndex = chords.findIndex(a => a.pos === index)
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
                html += `<span class="chord end" style="transform: translate(${80 * (i + 1)}px, calc(${isStage ? "-55% - 2px" : "-12px"} - var(--offsetY)));">${chord.key}</span>`
            })

            if (!html) return
            chordLines[i] = html
        })
    }

    // list-style${item.list?.style?.includes("disclosure") ? "-type:" : ": inside"} ${item.list?.style || "disc"};
    // font-size: inherit;
    $: listStyle = item?.list?.enabled ? `;font-size: ${fontSize || cssFontSize || 100}px;display: list-item;list-style: inside ${item.list?.style || "disc"};` : ""

    const dispatch = createEventDispatcher()
    const previousValue: { [key: string]: string } = {}
    function getTextValue(value: string, i: number, ti: number, _updater: number) {
        if (dynamicValues && value.includes("{")) {
            const newValue = replaceDynamicValues(value, { ...ref, slideIndex })

            const id = i + "_" + ti
            if (previousValue[id] !== newValue) {
                if (updateDynamic > 2) dispatch("updateAutoSize")
                previousValue[id] = newValue
            }

            return newValue
        }

        return value
    }

    // UPDATE DYNAMIC VALUES e.g. {time_} EVERY SECOND
    // & update instantly when variables or item change
    let updateDynamic = 0
    $: if ($variables || item) setTimeout(update)
    const dynamicInterval = setInterval(update, 1000)
    function update() {
        updateDynamic++
    }

    $: chordFontSize = chordLines.length ? stageItem?.chords?.size || stageItem?.chordsData?.size || item?.chords?.size || 50 : 0
    $: chordsStyle = `--chord-size: ${chordLines.length ? (fontSize || cssFontSize) * (chordFontSize / 100) : "undefined"}px;--chord-color: ${stageItem?.chords?.color || stageItem?.chordsData?.color || item?.chords?.color || "#FF851B"};`
</script>

<div class="align" class:isStage class:scrolling={!isStage && item?.scrolling?.type} class:topBottomScrolling={!isStage && item?.scrolling?.type === "top_bottom"} class:bottomTopScrolling={!isStage && item?.scrolling?.type === "bottom_top"} class:leftRightScrolling={!isStage && item?.scrolling?.type === "left_right"} class:rightLeftScrolling={!isStage && item?.scrolling?.type === "right_left"} style="--scrollSpeed: {item?.scrolling?.speed ?? 30}s;{style ? item?.align : null}">
    <div class="lines" style="{style ? lineStyleBox : ''}{smallFontSize || customFontSize !== null ? '--font-size: ' + (smallFontSize ? (-1.1 * $slidesOptions.columns + 10) * 5 : customFontSize) + 'px;' : ''}{textAnimation}{chordsStyle}">
        {#each renderedLines as line, i}
            {#if (linesStart === null || linesEnd === null || (i >= linesStart && i < linesEnd)) && (!maxLines || (maxLinesInvert ? i > lines.length - maxLines - 1 : i < maxLines))}
                {#if chords && chordLines[i]}
                    <div class:first={i === 0} class="break chords" class:stageChords={!!stageItem} style="--offsetY: {(stageItem?.chords ? stageItem.chords.offsetY : item?.chords?.offsetY) || 0}px;{style ? line.align : ''}">
                        {@html chordLines[i]}
                    </div>
                {/if}

                <!-- class:height={!line.text[0]?.value.length} -->
                <div class="break" class:reveal={(centerPreview || isStage) && item?.lineReveal && revealed < i} class:smallFontSize={smallFontSize || customFontSize || textAnimation.includes("font-size")} style="{style ? lineStyle : ''}{style ? line.align : ''}{item?.list?.enabled && line.text?.reduce((value, t) => (value += t.value || ''), '')?.length ? listStyle : ''}{item?.list?.enabled ? `color: ${getStyles(line.text[0].style).color || ''};` : ''}">
                    {#each line.text || [] as text, ti}
                        {@const value = text.value?.replaceAll("\n", "<br>") || "<br>"}
                        <span class="textContainer" style="{style ? getCustomStyle(text.style) : ''}{customStyle}{text.customType?.includes('disableTemplate') ? text.style : ''}{fontSize ? `;font-size: ${fontSize * (text.customType?.includes('disableTemplate') && !text.customType?.includes('jw') ? customTypeRatio : 1)}px;` : style ? getCustomFontSize(text.style, outputStyle) : ''}">
                            {@html getTextValue(value, i, ti, updateDynamic)}
                        </span>
                    {/each}
                </div>
            {/if}
        {/each}
    </div>
</div>

<style>
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

    .lines .break.reveal {
        outline: 1px solid red;
        outline-offset: -10px;
        opacity: 0.7;
    }

    *:global(.wj) {
        color: #ff5050;
    }

    /* span {
    display: inline;
    white-space: initial;
    color: white;
  } */

    /* not sure what this is used for? */
    .break:not(.stageChords) :global(span.textContainer) {
        font-size: 100px;
        min-height: 50px;
        /* display: inline-block; */

        transition: var(--transition);
    }
    .break.smallFontSize :global(span) {
        /* font-size: 30px; */
        font-size: var(--font-size) !important;
    }

    /* bible parts */
    .break :global(span.uncertain) {
        opacity: 0.7;
        font-size: 0.8em;
        font-style: italic;
    }

    /* .height {
        height: 1em;
    } */

    /* scrolling */
    .scrolling {
        /* scroll will always show overflowing text */
        overflow: visible !important;
    }
    .topBottomScrolling {
        animation: topBottom var(--scrollSpeed) linear infinite normal;
    }
    .bottomTopScrolling {
        animation: bottomTop var(--scrollSpeed) linear infinite normal;
    }
    .leftRightScrolling {
        animation: leftRight var(--scrollSpeed) linear infinite normal;
    }
    .rightLeftScrolling {
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
        font-weight: bold;

        /* transform: translate(0, calc(0% - var(--chord-size) * 0.8)); */
        transform: translate(0, calc(-12px - var(--offsetY)));
        line-height: initial;
        /* WIP chords goes over other (stage) items */
        z-index: 2;
    }
    /* .align.isStage .break.chords :global(.chord.end) {
        line-height: 0px;
    } */
    .align.isStage .break.chords :global(.chord) {
        transform: translate(0, calc(-55% - 2px - var(--offsetY)));
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

    .lines {
        line-height: calc(var(--chord-size) * 1.2 + 4px) !important;
    }
</style>
