<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import type { Styles } from "../../../types/Settings"
    import type { Item, TemplateStyleOverride } from "../../../types/Show"
    import { createVirtualBreaks } from "../../show/slides"
    import { outputs, slidesOptions, styles, variables } from "../../stores"
    import { getItemText } from "../edit/scripts/textStyle"
    import { clone } from "../helpers/array"
    import { getFirstActiveOutput } from "../helpers/output"
    import { replaceDynamicValues } from "../helpers/showActions"
    import { getStyles } from "../helpers/style"
    import { applyStyleOverrides } from "./wordOverride"

    export let item: Item
    export let slideIndex = 0
    // export let isMirrorItem = false
    export let key = false
    export let smallFontSize = false
    export let animationStyle: any = {}
    export let dynamicValues = true
    export let isStage = false
    export let customFontSize: number | null = null
    export let outputStyle: Styles | null = null
    // export let outputId = ""
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
    export let useOriginalTextColor = false
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
    export let hideContent = false
    export let highlighedLines: { from: number; to: number; color: string }[] = []
    export let normalWrap = false
    export let updateDynamicValues = true

    $: lines = createVirtualBreaks(clone(item?.lines || []), outputStyle?.skipVirtualBreaks)
    $: if (linesStart !== null && linesEnd !== null && lines.length) {
        lines = lines.filter((a) => a.text.filter((a) => a.value !== undefined)?.length)

        // show last possible lines if no text at current line
        if (!lines[linesStart]) {
            const linesCount = linesEnd - linesStart
            const length = lines.length - 1
            const index = length - (length % linesCount)
            linesStart = index
            linesEnd = index + linesCount
        }
    }

    let renderedLines: any[] = []
    $: renderedLines = styleOverrides?.length ? applyStyleOverrides(lines, styleOverrides) : lines

    function getCustomStyle(style: string) {
        if (!style) return ""

        // if (outputId && !isMirrorItem) {
        //     const outputResolution = getOutputResolution(outputId, $outputs, true)
        //     style = percentageStylePos(style, outputResolution)
        // }

        // text gradient

        const gradientCount = (style.match(/-gradient/g) || []).length
        if (style.includes("-gradient") && (gradientCount > 1 || !style.includes("-webkit-mask-image: linear-gradient"))) {
            const styles = getStyles(style)
            const gradient = styles.color
            style += `background-image: ${gradient};color: transparent;background-clip: text;`
            // shadow will show over the gradient (this can be a cool effect, but has to be explicitly set)
            if (!style.includes("text-shadow") || style.includes("2px 2px 10px #000000;")) style += "text-shadow: none;"
            if (style.includes("-webkit-mask-image")) style += styles["-webkit-mask-image"]
        }

        // alpha key output (not in use anymore)
        if (!key) return style
        const styles = getStyles(style)

        // alpha style
        let alphaStyles = ";"
        const bgAlpha = getAlphaValues(styles["background-color"])
        const textAlpha = getAlphaValues(styles.color) || 1
        if (bgAlpha) alphaStyles += "background-color: rgb(255 255 255 / " + bgAlpha + ");"
        alphaStyles += "color: rgb(255 255 255 / " + textAlpha + ");"

        return style + alphaStyles
    }

    // CONTINUOUS SCROLLING
    let contentWidth = 0
    let alignWidth = 0
    let contentHeight = 0
    let alignHeight = 0

    $: copyCountHorizontal = contentWidth > 0 ? Math.ceil(alignWidth / (contentWidth + (item?.scrolling?.gap ?? 0))) + 2 : 2
    $: copyCountVertical = contentHeight > 0 ? Math.ceil(alignHeight / (contentHeight + (item?.scrolling?.gap ?? 0))) + 2 : 2

    function getColor(style: string | undefined) {
        if (!isStage || !useOriginalTextColor || !style) return ""

        const lineStyle = getStyles(style)
        return lineStyle.color ? `color: ${lineStyle.color};` : ""
    }

    function getAlphaValues(colorValue: string) {
        if (!colorValue) return 0
        let alpha = 0

        if (colorValue.includes("#")) alpha = alphaFromHex(colorValue)
        else if (colorValue.includes("rgb")) alpha = alphaFromRgb(colorValue)

        return alpha || 0
    }
    function alphaFromHex(colorValue: string) {
        const rx = /^#([0-9a-f]{2})[0-9a-f]{6}$/i
        const m = colorValue.match(rx)
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

    function resolveFontSize(style: string, outputStyle: Styles | null) {
        const baseFontSize = Number(getStyles(style, true)["font-size"] || 100) || 100

        let resolvedOutputStyle = outputStyle
        if (!resolvedOutputStyle) {
            const currentOutput = getFirstActiveOutput()
            resolvedOutputStyle = $styles[currentOutput?.style || ""] || null
        }
        if (!resolvedOutputStyle) return baseFontSize

        const customFontSizeRatio = (resolvedOutputStyle.aspectRatio?.fontSizeRatio ?? 100) / 100
        return baseFontSize * customFontSizeRatio
    }

    function getCustomFontSize(style: string, outputStyle: Styles | null) {
        return `;font-size: ${resolveFontSize(style, outputStyle)}px;`
    }

    // CHORDS

    let chordLines: string[] = []
    let chordOnlyLines: boolean[] = []
    $: if (chords && (item?.lines || fontSize)) setTimeout(createChordLines)
    function createChordLines() {
        chordLines = []
        chordOnlyLines = []
        if (!Array.isArray(item?.lines)) return

        item.lines.forEach((line, i) => {
            if (!line.chords?.length || !line.text) return

            const chords = clone(line.chords || [])
            const lineText = getLineText(line)
            const autosizeRatio = getChordSizeRatio()

            let html = ""
            if (!lineText.trim().length) {
                chordLines[i] = getChordOnlyHtml(chords)
                chordOnlyLines[i] = true
                return
            }

            let index = 0
            line.text.forEach((text) => {
                const value = text.value.trim().replaceAll("\n", "") || ""

                const letters = value.split("")
                letters.forEach((letter) => {
                    const chordIndex = chords.findIndex((a) => a.pos === index)
                    if (chordIndex >= 0) {
                        html += `<span class="chord" data-autosize-ratio="${autosizeRatio}">${chords[chordIndex].key}</span>`
                        chords.splice(chordIndex, 1)
                    }

                    // let size = fontSizeValue
                    const size = fontSize || 0
                    html += `<span class="invisible" style="${style ? getCustomStyle(text.style) : ""}${size ? `font-size: ${size}px;` : ""}">${letter}</span>`

                    index++
                })
            })

            chords.forEach((chord, i) => {
                html += `<span class="chord end" data-autosize-ratio="${autosizeRatio}" style="transform: translateX(calc(${1.4 * (i + 1)}em - 50%));">${chord.key}</span>`
            })

            if (!html) return
            chordLines[i] = html
            chordOnlyLines[i] = false
        })
    }

    function getLineText(line) {
        return line.text?.reduce((value, text) => (value += text.value || ""), "") || ""
    }

    function getChordOnlyHtml(chords) {
        const autosizeRatio = getChordSizeRatio()
        return chords
            .sort((a, b) => a.pos - b.pos)
            .map((chord, i, sorted) => {
                const previousPos = sorted[i - 1]?.pos ?? 0
                const gap = i === 0 ? Math.max(0, chord.pos) : Math.max(1, chord.pos - previousPos)

                return `<span class="chord" data-autosize-ratio="${autosizeRatio}" style="${gap ? `margin-left: ${gap * 0.65}em;` : ""}">${chord.key}</span>`
            })
            .join("")
    }

    function getChordSizeRatio() {
        return (stageItem?.chords?.size || stageItem?.chordsData?.size || item?.chords?.size || 50) / 100
    }

    // list-style${item.list?.style?.includes("disclosure") ? "-type:" : ": inside"} ${item.list?.style || "disc"};
    // font-size: inherit;
    $: defaultResolvedFontSize = (() => {
        const firstTextStyle = item?.lines?.[0]?.text?.[0]?.style
        if (!firstTextStyle) return 100
        return resolveFontSize(firstTextStyle, outputStyle)
    })()
    $: listStyle = item?.list?.enabled ? `;font-size: ${fontSize || defaultResolvedFontSize || 100}px;display: list-item;list-style: inside ${item.list?.style || "disc"};` : ""

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
    $: slideText = getItemText(item)
    $: hasDynamicValues = slideText.includes("{")

    // only update if text contains dynamic values
    $: if (hasDynamicValues) startInterval()
    else stopInterval()
    let dynamicInterval: NodeJS.Timeout | null = null
    function startInterval() {
        stopInterval()
        dynamicInterval = setInterval(update, 1000)
    }
    function stopInterval() {
        if (dynamicInterval) clearInterval(dynamicInterval)
        dynamicInterval = null
    }

    let updateDynamic = 0
    $: if ($variables) setTimeout(update)
    $: if ($outputs) setTimeout(update, isStage ? 250 : 0) // time with auto size
    function update() {
        if (!hasDynamicValues || !hasMounted || !updateDynamicValues) return
        updateDynamic++
    }

    let hasMounted = false
    onMount(() => {
        setTimeout(() => (hasMounted = true))
    })
    onDestroy(() => {
        stopInterval()
    })

    $: chordFontSize = chordLines.length ? stageItem?.chords?.size || stageItem?.chordsData?.size || item?.chords?.size || 50 : 0
    $: chordsStyle = `--chord-size: ${chordLines.length ? (fontSize || defaultResolvedFontSize || 100) * (chordFontSize / 100) : "undefined"}px;--chord-color: ${stageItem?.chords?.color || stageItem?.chordsData?.color || item?.chords?.color || "#FF851B"};`

    // $: isScripture = ref?.id === "scripture" || ref?.showId === "temp" || $showsCache[ref.showId || ""]?.reference?.type === "scripture"

    $: baseFontSize = fontSize || (style ? resolveFontSize(renderedLines[0]?.text[0]?.style, outputStyle) : 100)
</script>

<div class="align" class:hidden={hideContent} class:isStage class:scrolling={!isStage && item?.scrolling?.type} style="--scrollSpeed: {(item?.scrolling?.speed ?? 30) * 1.5}s;{style ? item?.align : null};" bind:clientWidth={alignWidth} bind:clientHeight={alignHeight}>
    <!-- scrolling lines -->
    {#if !isStage && item?.scrolling?.type && item?.scrolling?.type !== "none"}
        <div class="scrollWrapper" style="--copyCountHorizontal: {copyCountHorizontal}; --copyCountVertical: {copyCountVertical};" class:topBottomContinuousScrolling={!isStage && item?.scrolling?.type === "top_bottom"} class:bottomTopContinuousScrolling={!isStage && item?.scrolling?.type === "bottom_top"} class:leftRightContinuousScrolling={!isStage && item?.scrolling?.type === "left_right"} class:rightLeftContinuousScrolling={!isStage && item?.scrolling?.type === "right_left"}>
            {#each Array.from({ length: item?.scrolling?.type === "top_bottom" || item?.scrolling?.type === "bottom_top" ? copyCountVertical : copyCountHorizontal }) as _}
                <div class="scrollContent" style="{item?.scrolling?.type === 'top_bottom' || item?.scrolling?.type === 'bottom_top' ? 'margin-bottom' : 'margin-right'}: {item?.scrolling?.gap ?? 100}px;" bind:clientHeight={contentHeight} bind:clientWidth={contentWidth}>
                    <!-- WIP duplicate of "lines" down below -->
                    <div class="lines" data-chord-size-ratio={chordFontSize ? chordFontSize / 100 : null} style="{style ? lineStyleBox : ''}{smallFontSize || customFontSize !== null ? '--font-size: ' + (smallFontSize ? (-1.1 * $slidesOptions.columns + 10) * 5 : customFontSize) + 'px;' : ''}{textAnimation}{chordsStyle}">
                        {#each renderedLines as line, i}
                            <!-- set div height if chords, not last line, and no text content -->
                            {@const chordOnly = chords && chordOnlyLines[i]}
                            {@const height = chords && chordLines[i] && !chordOnly && i < renderedLines.length - 1 && !line.text?.reduce((value, t) => (value += t.value || ""), "")?.trim()?.length ? 80 : 0}
                            {@const lineHidden = (linesStart !== null && linesEnd !== null && (i < linesStart || i >= linesEnd)) || (maxLines && (maxLinesInvert ? i <= lines.length - maxLines - 1 : i >= maxLines))}

                            {#if !lineHidden || outputStyle?.showAsFaded}
                                {#if chords && chordLines[i]}
                                    <div class:first={i === 0} class="break chords" class:chordOnly class:stageChords={!!stageItem} style="--font-size: {fontSize || baseFontSize || defaultResolvedFontSize || 100}px;--offsetY: {(stageItem?.chords ? stageItem.chords.offsetY : item?.chords?.offsetY) || 0}px;{style ? line.align : ''}">
                                        {@html chordLines[i]}
                                    </div>
                                {/if}

                                <!-- class:height={!line.text[0]?.value.length} -->
                                {#if !chordOnly}
                                    <div
                                        class="break"
                                        class:normalWrap={normalWrap || (isStage ? typeof stageItem?.style === "string" && (stageItem?.style.includes("justify") || stageItem?.style.includes("nowrap")) : line.align?.includes("justify") || line.align?.includes("left") || JSON.stringify(line).includes("nowrap"))}
                                        class:reveal={(centerPreview || isStage) && item?.lineReveal && revealed < i}
                                        class:smallFontSize={smallFontSize || customFontSize || textAnimation.includes("font-size")}
                                        style="position: relative;{style ? lineStyle : ''}{style ? line.align : ''}{height ? `height: ${height}px;` : ''}{item?.list?.enabled && line.text?.reduce((value, t) => (value += t.value || ''), '')?.length ? listStyle : ''}{item?.list?.enabled ? `color: ${getStyles(line.text[0]?.style).color || ''};` : ''}{lineHidden && outputStyle?.showAsFaded ? `opacity: ${(outputStyle.lineOpacity ?? 50) / 100};` : ''}"
                                    >
                                        <!-- style Lines selection in center preview -->
                                        {#each highlighedLines || [] as box}
                                            {#if i >= box.from && i < box.to}
                                                <div style="position: absolute;top: {i === box.from ? '0' : '-2px'};bottom: {i === box.to - 1 ? '0' : '-2px'};left: 0px;right: 0px;border-left: 2px solid {box.color};border-right: 2px solid {box.color};{i === box.from ? 'border-top: 2px solid ' + box.color + ';' : ''}{i === box.to - 1 ? 'border-bottom: 2px solid ' + box.color + ';' : ''}pointer-events: none;"></div>
                                            {/if}
                                        {/each}

                                        {#if line.text?.length === 0}
                                            <span class="textContainer"><br /></span>
                                        {:else}
                                            {#each line.text || [] as text, ti}
                                                {@const value = text.value?.replaceAll("\n", "<br>") || "<br>"}
                                                {@const fontRatio = text.customType?.includes("disableTemplate") && !text.customType?.includes("jw") ? customTypeRatio : 1}

                                                <!-- NOTE: must be on the same line for rendering ...>{@html -->
                                                <span class="textContainer" style="{style ? getCustomStyle(text.style) : ''}{getColor(text.style)}{customStyle}{text.customType?.includes('disableTemplate') ? text.style : ''}{fontSize ? `;font-size: ${fontSize * fontRatio}px;` : style ? getCustomFontSize(text.style, outputStyle) : ''};--base-font-size: {baseFontSize}px;">{@html getTextValue(value, i, ti, updateDynamic)}</span>
                                            {/each}
                                        {/if}
                                    </div>
                                {/if}
                            {/if}
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <!-- non scrolling lines -->
        <div class="lines" data-chord-size-ratio={chordFontSize ? chordFontSize / 100 : null} style="{style ? lineStyleBox : ''}{smallFontSize || customFontSize !== null ? '--font-size: ' + (smallFontSize ? (-1.1 * $slidesOptions.columns + 10) * 5 : customFontSize) + 'px;' : ''}{textAnimation}{chordsStyle}">
            {#each renderedLines as line, i}
                <!-- set div height if chords, not last line, and no text content -->
                {@const chordOnly = chords && chordOnlyLines[i]}
                {@const height = chords && chordLines[i] && !chordOnly && i < renderedLines.length - 1 && !line.text?.reduce((value, t) => (value += t.value || ""), "")?.trim()?.length ? 80 : 0}
                {@const lineHidden = (linesStart !== null && linesEnd !== null && (i < linesStart || i >= linesEnd)) || (maxLines && (maxLinesInvert ? i <= lines.length - maxLines - 1 : i >= maxLines))}

                {#if !lineHidden || outputStyle?.showAsFaded}
                    {#if chords && chordLines[i]}
                        <div class:first={i === 0} class="break chords" class:chordOnly class:stageChords={!!stageItem} style="--font-size: {fontSize || baseFontSize || defaultResolvedFontSize || 100}px;--offsetY: {(stageItem?.chords ? stageItem.chords.offsetY : item?.chords?.offsetY) || 0}px;{style ? line.align : ''}">
                            {@html chordLines[i]}
                        </div>
                    {/if}

                    <!-- class:height={!line.text[0]?.value.length} -->
                    {#if !chordOnly}
                        <div
                            class="break"
                            class:normalWrap={normalWrap || (isStage ? typeof stageItem?.style === "string" && (stageItem?.style.includes("justify") || stageItem?.style.includes("nowrap")) : line.align?.includes("justify") || line.align?.includes("left") || JSON.stringify(line).includes("nowrap"))}
                            class:reveal={(centerPreview || isStage) && item?.lineReveal && revealed < i}
                            class:smallFontSize={smallFontSize || customFontSize || textAnimation.includes("font-size")}
                            style="position: relative;{style ? lineStyle : ''}{style ? line.align : ''}{height ? `height: ${height}px;` : ''}{item?.list?.enabled && line.text?.reduce((value, t) => (value += t.value || ''), '')?.length ? listStyle : ''}{item?.list?.enabled ? `color: ${getStyles(line.text[0]?.style).color || ''};` : ''}{lineHidden && outputStyle?.showAsFaded ? `opacity: ${(outputStyle.lineOpacity ?? 50) / 100};` : ''}"
                        >
                            <!-- style Lines selection in center preview -->
                            {#each highlighedLines || [] as box}
                                {#if i >= box.from && i < box.to}
                                    <div style="position: absolute;top: {i === box.from ? '0' : '-2px'};bottom: {i === box.to - 1 ? '0' : '-2px'};left: 0px;right: 0px;border-left: 2px solid {box.color};border-right: 2px solid {box.color};{i === box.from ? 'border-top: 2px solid ' + box.color + ';' : ''}{i === box.to - 1 ? 'border-bottom: 2px solid ' + box.color + ';' : ''}pointer-events: none;"></div>
                                {/if}
                            {/each}

                            {#if line.text?.length === 0}
                                <span class="textContainer"><br /></span>
                            {:else}
                                {#each line.text || [] as text, ti}
                                    {@const value = text.value?.replaceAll("\n", "<br>") || "<br>"}
                                    {@const fontRatio = text.customType?.includes("disableTemplate") && !text.customType?.includes("jw") ? customTypeRatio : 1}

                                    <!-- NOTE: must be on the same line for rendering ...>{@html -->
                                    <span class="textContainer" style="{style ? getCustomStyle(text.style) : ''}{getColor(text.style)}{customStyle}{text.customType?.includes('disableTemplate') ? text.style : ''}{fontSize ? `;font-size: ${fontSize * fontRatio}px;` : style ? getCustomFontSize(text.style, outputStyle) : ''};--base-font-size: {baseFontSize}px;">{@html getTextValue(value, i, ti, updateDynamic)}</span>
                                {/each}
                            {/if}
                        </div>
                    {/if}
                {/if}
            {/each}
        </div>
    {/if}
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
        justify-content: center;
    }

    .align.hidden {
        visibility: hidden !important;
        opacity: 0 !important;
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

        /* balanced breaking, looks much cleaner */
        text-wrap: balance;
    }

    /* normal wrap if "Text on one line (nowrap)" or Justify aligned */
    .break.normalWrap {
        text-wrap: unset;
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

    /* chords */
    .break.chords :global(.invisible) {
        opacity: 0;
        line-height: 0;
        font-size: var(--font-size);
    }
    .break.chords :global(.chord) {
        position: absolute;
        top: 0;
        color: var(--chord-color);
        font-size: var(--chord-size) !important;
        font-weight: bold;

        transform: translateY(calc(-1 * var(--offsetY)));
        line-height: 1;
        /* WIP chords goes over other (stage) items */
        z-index: 2;
    }
    /* .align.isStage .break.chords :global(.chord.end) {
        line-height: 0px;
    } */
    .align.isStage .break.chords :global(.chord) {
        transform: translateY(calc(-1 * var(--offsetY)));
    }
    .break.chords {
        height: calc(var(--chord-size) * 1.02);
        line-height: 0;
        max-height: none;
        position: relative;
        pointer-events: none;

        /* reset */
        font-weight: normal;
        font-style: normal;
    }
    .break.chords.first {
        line-height: 0 !important;
    }
    .break.chords.chordOnly {
        line-height: 1.1;
        max-height: unset;
        overflow-wrap: normal;
        text-wrap: unset;
        white-space: nowrap;
    }
    .break.chords.chordOnly :global(.chord) {
        display: inline-block;
        line-height: 1.1;
        position: static;
        transform: none !important;
    }

    .scrollWrapper {
        display: flex;
        flex-wrap: nowrap;
    }
    .scrollContent {
        flex-shrink: 0;
    }
    .topBottomContinuousScrolling {
        animation: topBottomContinuous calc(var(--scrollSpeed) / var(--copyCountVertical)) linear infinite normal;
        flex-direction: column;
        height: max-content;
    }
    .bottomTopContinuousScrolling {
        animation: bottomTopContinuous calc(var(--scrollSpeed) / var(--copyCountVertical)) linear infinite normal;
        flex-direction: column;
        height: max-content;
    }
    .leftRightContinuousScrolling {
        animation: leftRightContinuous calc(var(--scrollSpeed) / var(--copyCountHorizontal)) linear infinite normal;
        flex-direction: row;
        width: max-content;
    }
    .rightLeftContinuousScrolling {
        animation: rightLeftContinuous calc(var(--scrollSpeed) / var(--copyCountHorizontal)) linear infinite normal;
        flex-direction: row;
        width: max-content;
    }

    .leftRightContinuousScrolling .break,
    .rightLeftContinuousScrolling .break {
        white-space: nowrap;
        width: auto;
        text-wrap: none;
    }

    @keyframes rightLeftContinuous {
        from {
            transform: translateX(0);
        }
        to {
            transform: translateX(calc(-100% / var(--copyCountHorizontal)));
        }
    }

    @keyframes leftRightContinuous {
        from {
            transform: translateX(calc(-100% / var(--copyCountHorizontal)));
        }
        to {
            transform: translateX(0);
        }
    }

    @keyframes bottomTopContinuous {
        from {
            transform: translateY(0);
        }
        to {
            transform: translateY(calc(-100% / var(--copyCountVertical)));
        }
    }

    @keyframes topBottomContinuous {
        from {
            transform: translateY(calc(-100% / var(--copyCountVertical)));
        }
        to {
            transform: translateY(0);
        }
    }
</style>
