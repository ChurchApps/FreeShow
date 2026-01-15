<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount, tick } from "svelte"
    import { OUTPUT } from "../../../types/Channels"
    import type { Styles } from "../../../types/Settings"
    import type { Item, Slide, TemplateStyleOverride, Transition } from "../../../types/Show"
    import { currentWindow, groups, outputs, overlays, scriptureSettings, showsCache, styles, templates, variables } from "../../stores"
    import { wait } from "../../utils/common"
    import { send } from "../../utils/request"
    import autosize from "../edit/scripts/autosize"
    import { getItemText } from "../edit/scripts/textStyle"
    import { clone } from "../helpers/array"
    import { getActiveOutputs, getFirstActiveOutput, getOutputResolution, percentageStylePos } from "../helpers/output"
    import { getNumberVariables } from "../helpers/showActions"
    import { getStyles } from "../helpers/style"
    import SlideItems from "./SlideItems.svelte"
    import TextboxLines from "./TextboxLines.svelte"
    import { readAutoSizeCache, writeAutoSizeCache } from "./autosizeCache"

    export let item: Item
    export let itemIndex = -1
    export let slideIndex = 0
    export let preview = false
    export let isTemplatePreview = false
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
    export let useOriginalTextColor = false
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
    // expose an optional key so parents can track autosize readiness per item
    export let autoSizeKey = ""

    // reuse autosize work across components by caching measurements alongside a signature
    // surface measurement completion for parents that want to precompute autosize
    const dispatch = createEventDispatcher<{
        autosizeReady: { key: string; fontSize: number }
    }>()

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
    // track readiness to avoid duplicate events for the same render cycle
    let autoSizeReady = false
    // hold onto whether the visible output should stay hidden until autosize finishes
    let hideUntilAutosized = false
    // remember which item signature we already reset local font size for
    let lastRenderedSignature = ""
    onMount(() => {
        if (preview) {
             // Defer slightly to ensure DOM layout is ready for measurement, preventing 0-width errors
             setTimeout(() => (loaded = true), 20)
        }
        else setTimeout(() => (loaded = true), 100)
    })
    onDestroy(() => {
        if (dateInterval) clearInterval(dateInterval)
        if (loopStop) clearTimeout(loopStop)
        if (paddingCorrTimeout) clearTimeout(paddingCorrTimeout)
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

    // WORD OVERRIDE

    // grab any template level overrides so we can re-use them later
    let templateStyleOverrides: TemplateStyleOverride[] = []
    let slideData: Slide | null = null
    let groupTemplateId = ""
    let resolvedTemplateId = ""
    let scriptureSettingsTemplateId = ""
    let showReference: any = null
    let isScriptureContext = false
    let scriptureTranslationKey = ""
    let styleScriptureTemplateId = ""
    $: slideData = (() => {
        if (!ref?.showId) return null
        const slideId = ref.slideId || ref.id
        if (!slideId) return null
        return ($showsCache[ref.showId]?.slides?.[slideId] as Slide) || null
    })()
    // remember show-level reference metadata so we can identify scripture flows
    $: showReference = (() => {
        if (!ref?.showId) return null
        return $showsCache[ref.showId]?.reference || null
    })()
    $: groupTemplateId = (() => {
        if (!slideData) return ""
        const groupId = slideData.globalGroup && slideData.globalGroup !== "none" ? slideData.globalGroup : slideData.group
        if (!groupId) return ""
        // pick up template supplied by group overrides (if present)
        return $groups[groupId]?.template || ""
    })()
    // scripture slides can come from drawer preview or a stored show reference
    $: isScriptureContext = (() => {
        if (ref?.id === "scripture" || ref?.showId === "temp") return true
        return (showReference?.type || "") === "scripture"
    })()
    // translation count dictates which style-specific template should apply
    $: scriptureTranslationKey = isScriptureContext ? buildScriptureTranslationKey(showReference) : ""
    // prefer the output-style scripture template when the current output overrides scripture layouts
    $: styleScriptureTemplateId = (() => {
        if (!isScriptureContext || !outputStyle) return ""
        const translationTemplate = scriptureTranslationKey ? (outputStyle[`templateScripture${scriptureTranslationKey}` as keyof Styles] as string | undefined) : undefined
        return translationTemplate || outputStyle.templateScripture || ""
    })()
    // fall back to the template captured when the scripture show was created
    $: scriptureSettingsTemplateId = (() => {
        if (ref?.id === "scripture" || ref?.showId === "temp") return $scriptureSettings.template || ""
        return ""
    })()
    // track whether this textbox belongs to the first slide for the active layout
    let isFirstLayoutSlide = false
    $: isFirstLayoutSlide = (() => {
        if (!ref?.showId) return false
        const slideId = ref.slideId || ref.id
        if (!slideId) return false
        const layoutId = ref.layoutId || $showsCache[ref.showId]?.settings?.activeLayout || ""
        if (!layoutId) return false
        const layout = $showsCache[ref.showId]?.layouts?.[layoutId]
        const firstId = layout?.slides?.[0]?.id || ""
        return !!firstId && firstId === slideId
    })()

    function resolveTemplate(baseId: string) {
        if (!baseId) return ""
        if (isFirstLayoutSlide) {
            // templates can specify a dedicated cover/first slide template; pick it when we are on that slide
            const firstSlideTemplateId = $templates[baseId]?.settings?.firstSlideTemplate || ""
            if (firstSlideTemplateId) return firstSlideTemplateId
        }
        return baseId
    }

    $: resolvedTemplateId = (() => {
        if (ref?.type === "template" && ref.id) return ref.id
        if (ref?.type === "overlay") return ""
        if (slideData?.settings?.template) return slideData.settings.template

        const groupResolved = resolveTemplate(groupTemplateId)
        if (groupResolved) return groupResolved

        const showResolved = resolveTemplate(currentShowTemplateId)
        if (showResolved) return showResolved

        // favor output-driven scripture layouts first so overrides don't bleed between outputs
        const styleScriptureResolved = resolveTemplate(styleScriptureTemplateId)
        if (styleScriptureResolved) return styleScriptureResolved

        const styleResolved = resolveTemplate(outputStyle?.template || "")
        if (styleResolved) return styleResolved

        // finally fall back to the template captured when the scripture show was generated
        const scriptureResolved = resolveTemplate(scriptureSettingsTemplateId)
        if (scriptureResolved) return scriptureResolved

        return ""
    })()
    // WIP this will update the output immediately when template changes, but shouldn't update until refreshing
    $: templateStyleOverrides = (() => {
        // ensure overrides follow whichever template actually drives this slide
        if (!resolvedTemplateId) return []
        return clone($templates[resolvedTemplateId]?.settings?.styleOverrides || [])
    })()

    // convert translation metadata into the suffix used by templateScripture_* settings
    function buildScriptureTranslationKey(reference: any) {
        const translationCount = getScriptureTranslationCount(reference)
        if (translationCount <= 1) return ""
        const limitedCount = Math.min(4, translationCount)
        return `_${limitedCount}`
    }

    // count how many translations are present for the current scripture selection
    function getScriptureTranslationCount(reference: any) {
        if (!reference?.data) return 1
        if (reference.data.translations) return Number(reference.data.translations) || 1
        const versionList = typeof reference.data.version === "string" ? reference.data.version.split("+") : []
        return versionList.filter((value) => value.trim().length).length || 1
    }

    // AUTO SIZE

    let itemElem: HTMLElement | undefined

    let previousItem = "{}"
    $: newItem = JSON.stringify(item)
    // Combine content and template to detect all layout-affecting changes
    $: stateSignature = newItem + "|" + resolvedTemplateId
    
    $: if (stateSignature !== lastRenderedSignature) autoSizeReady = false
    
    $: if (stateSignature !== lastRenderedSignature && (item?.auto || (item?.textFit || "none") !== "none")) {
        fontSize = item?.autoFontSize || 0
        lastRenderedSignature = stateSignature
        hideUntilAutosized = shouldHideUntilAutoSizeCompletes()
    }
    // Trigger calculation if Content OR Template changes (resolvedTemplateId added to dependency list)
    $: if (itemElem && loaded && (stageAutoSize || newItem !== previousItem || resolvedTemplateId || chordLines || stageItem)) calculateAutosize()
    $: if ($variables) setTimeout(calculateAutosize)

    // recalculate auto size if output template is different than show template
    $: currentShowTemplateId = $showsCache[ref.showId || ""]?.settings?.template || ""
    // let outputTemplateAutoSize = false
    $: outputSlide = getFirstActiveOutput($outputs)?.out?.slide
    $: if (item?.type === "slide_tracker" && outputSlide) setTimeout(calculateAutosize) // overlay progress update
    $: if ($currentWindow === "output" && outputStyle?.template && outputStyle.template !== currentShowTemplateId && !stageAutoSize) calculateAutosize()
    // else outputTemplateAutoSize = false

    // $: fontSizeValue = stageAutoSize || item.auto || outputTemplateAutoSize ? fontSize : fontSize

    let customTypeRatio = 1
    function deriveCustomTypeRatio() {
        if (isStage) {
            // Search all lines to find disableTemplate items (verse numbers may not be in first line)
            let allText: any[] = []
            stageItem?.lines?.forEach((line) => {
                if (line?.text) allText.push(...line.text)
            })
            if (!allText.length) return 1
            const verseItemText = allText.filter((a) => a.customType?.includes("disableTemplate")) || []
            if (!verseItemText.length) return 1
            const verseItemSize = Number(getStyles(verseItemText[0]?.style, true)?.["font-size"] || "") || 0
            const stageFontSize = Number(getStyles(stageItem?.style, true)?.["font-size"] || "") || 100
            return stageFontSize ? verseItemSize / stageFontSize || 1 : 1
        }

        // Search all lines to find disableTemplate items (verse numbers may not be in first line)
        let allText: any[] = []
        item?.lines?.forEach((line) => {
            if (line?.text) allText.push(...line.text)
        })
        if (!allText.length) return 1
        const verseItemText = allText.filter((a) => a.customType?.includes("disableTemplate")) || []
        if (!verseItemText.length) return 1
        const verseItemSize = Number(getStyles(verseItemText[0]?.style, true)?.["font-size"] || "") || 0
        return verseItemSize ? verseItemSize / 100 || 1 : 1
    }
    $: customTypeRatio = deriveCustomTypeRatio()

    let loopStop: NodeJS.Timeout | null = null
    let newCall = false
    async function calculateAutosize() {
        if (item.type === "media" || item.type === "camera" || item.type === "icon") return
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

        // Wait for DOM to update with new template styles before measuring
        await tick()
        
        // TEMP FIX for auto size sometimes not sized properly in show slides
        if (!preview && !isStage) await wait(70)

        let defaultFontSize
        let maxFontSize

        const isTextItem = (item.type || "text") === "text"
        const isDynamic = isTextItem && getItemText(isStage ? stageItem : item).includes("{")
        let textFit = item.textFit || (item.auto ? (isTextItem ? "shrinkToFit" : "growToFit") : "none")

        if (isStage) {
            // wait for text content to populate if dynamic value
            if (isDynamic) await wait(10)
            if (stageItem?.type !== "text") textFit = stageItem?.textFit || "growToFit"

            // const textItem = isTextItem ? item?.lines?.[0]?.text || [] : stageItem
            let itemFontSize = Number(getStyles(stageItem?.style, true)?.["font-size"] || "") || 100

            defaultFontSize = itemFontSize
            if (textFit === "growToFit" && itemFontSize !== 100) maxFontSize = itemFontSize
        } else {
            if (isTextItem && textFit === "none") {
                fontSize = 0
                return
            }

            // Search all lines to find disableTemplate items and regular text (verse numbers may not be in first line)
            let allText: any[] = []
            item?.lines?.forEach((line) => {
                if (line?.text && Array.isArray(line.text)) allText.push(...line.text)
            })
            const itemText = allText.filter((a) => !a.customType?.includes("disableTemplate")) || []
            let itemFontSize = Number(getStyles(itemText[0]?.style, true)?.[" font-size"] || "") || 100

            // get scripture verse ratio
            const verseItemText = allText.filter((a) => a.customType?.includes("disableTemplate")) || []
            const verseItemSize = Number(getStyles(verseItemText[0]?.style, true)?.[" font-size"] || "") || 0
            customTypeRatio = verseItemSize / 100 || 1

            defaultFontSize = itemFontSize
            if (textFit === "growToFit" && isTextItem) maxFontSize = itemFontSize
        }

        let elem = itemElem
        if (!elem) return



        // short-circuit expensive DOM work when we already measured identical content
        const cacheKey = buildAutoSizeCacheKey()
        const cacheSignature = buildAutoSizeSignature(elem.clientWidth, elem.clientHeight)
        const cachedResult = cacheKey ? readAutoSizeCache(cacheKey) : undefined
        if (!isDynamic && cachedResult && cachedResult.signature === cacheSignature) {
            fontSize = cachedResult.fontSize
            if (item.type === "slide_tracker") {
                markAutoSizeReady()
                return
            }
            if (fontSize !== item.autoFontSize) setItemAutoFontSize(fontSize)
            markAutoSizeReady()
            return
        }

        let textQuery = ""
        if (isTextItem) {
            elem = elem.querySelector(".align") as HTMLElement
            if (!elem) return
            textQuery = ".lines .break span"
        } else {
            textFit = "growToFit"
            if (item.type === "slide_tracker") textQuery = ".progress div"
        }
        // not working due to stage SlideText "loading" elem?
        // if (isStage) {
        //     elem = itemElem?.closest(".stage_item")
        //     textQuery = ".align .item .align " + textQuery
        // }

        fontSize = autosize(elem, {
            type: textFit,
            textQuery,
            defaultFontSize,
            maxFontSize
        })



        // smaller in general if bullet list, because they are not accounted for
        if (item?.list?.enabled) fontSize *= 0.9

        if (item.type === "slide_tracker") {
            if (cacheKey) writeAutoSizeCache(cacheKey, { signature: cacheSignature, fontSize })
            markAutoSizeReady()
            return
        }
        if (fontSize !== item.autoFontSize) setItemAutoFontSize(fontSize)
        if (!isDynamic && cacheKey) writeAutoSizeCache(cacheKey, { signature: cacheSignature, fontSize })
        markAutoSizeReady()
    }

    // generate a stable key scoped to the item and current output context
    function buildAutoSizeCacheKey() {
        if (!autoSizeKey && !ref?.id) return ""
        const base = autoSizeKey || `${ref?.id || ""}-${item?.id || itemIndex}`
        const target = isStage ? "stage" : ref?.type || "show"
        return `${target}:${base}`
    }

    // capture the bits of state that influence autosize outcomes for cache invalidation
    function buildAutoSizeSignature(measuredWidth?: number, measuredHeight?: number) {
        // Extract key dimensional properties from style to ensure cache invalidation
        const styles = item?.style ? getStyles(item.style) : {}
        const boxDimensions: any = {
            width: styles.width,
            height: styles.height,
            left: styles.left,
            top: styles.top,
            fontSize: styles['font-size']
        }
        
        // Fix for thumbnails getting stuck with wrong cache when dimensions change via CSS classes
        if (preview) {
            boxDimensions.measuredWidth = measuredWidth
            boxDimensions.measuredHeight = measuredHeight
        }

        return JSON.stringify({
            lines: item?.lines,
            style: item?.style,
            boxDimensions, // Add explicit dimensions for better cache invalidation
            textFit: item?.textFit,
            list: item?.list,
            chords,
            stageAutoSize,
            stageItem,
            fontSizeOverride: customFontSize,
            ratio,
            outputStyle,
            styleIdOverride,
            mirror,
            preview,
            smallFontSize,
            maxLines,
            maxLinesInvert,
            centerPreview,
            // Include resolved template to invalidate cache when template changes
            resolvedTemplateId
        })
    }

    // notify listeners that autosize finished (and stash readiness for this render)
    function markAutoSizeReady() {
        if (autoSizeReady) return
        autoSizeReady = true
        if (autoSizeKey) dispatch("autosizeReady", { key: autoSizeKey, fontSize })
        if (hideUntilAutosized) requestAnimationFrame(() => (hideUntilAutosized = false))
    }

    // determine whether we should keep the visible textbox hidden while autosize runs
    function shouldHideUntilAutoSizeCompletes() {
        if (isStage || preview) return false
        const type = item?.type || "text"
        if (type !== "text") return false
        
        // Use detailed validation to ensure we catch all autosize candidates
        const isExplicitNone = item?.textFit === "none"
        const isExplicitActive = item?.textFit && item?.textFit !== "none"
        const isImpliedActive = !item?.textFit && item?.auto

        if (isExplicitNone || (!isExplicitActive && !isImpliedActive)) {
             return false
        }
        
        // CHECK CACHE
        const cacheKey = buildAutoSizeCacheKey()
        const cacheSignature = buildAutoSizeSignature()
        const cachedResult = cacheKey ? readAutoSizeCache(cacheKey) : undefined

        if (cachedResult && cachedResult.signature === cacheSignature) {
            return false
        }
        
        return true
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
    let paddingCorrTimeout: NodeJS.Timeout | null = null
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

        if (paddingCorrTimeout) clearTimeout(paddingCorrTimeout)
        paddingCorrTimeout = setTimeout(calculateAutosize, 150)

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

    // fixed letter width
    $: fixedWidth = item?.type === "timer" || item?.type === "clock" ? "font-feature-settings: 'tnum' 1;" : ""

    // display duration
    // WIP not using transitions at the moment
    let hidden = false
    let hideTimeout: NodeJS.Timeout | null = null
    $: displayDuration = item?.actions?.displayDuration || 0
    $: if (displayDuration && clickRevealed) {
        hidden = false
        if (hideTimeout) clearTimeout(hideTimeout)
        hideTimeout = setTimeout(() => {
            hidden = true
        }, displayDuration * 1000)
    }

    $: noTextMode = ref?.type === "template" && $templates[ref?.id]?.settings?.mode === "item"
</script>

<!-- lyrics view must have "width: 100%;height: 100%;" set -->
<div
    class="item"
    style="{style ? getCustomStyle(item?.style, customOutputId, styleIdOverride, { $styles }) : 'width: 100%;height: 100%;'};{paddingCorrection}{foregroundFilters}{animationStyle.item || ''}{cssVariables}{fixedWidth}"
    class:white={key && !lines?.length}
    class:key
    class:isStage
    class:stageNoAuto={isStage && !stageAutoSize}
    class:isDisabledVariable
    class:noTransition
    class:chords={chordLines.length}
    class:clickable={$currentWindow === "output" && (item.button?.press || item.button?.release)}
    class:reveal={(centerPreview || isStage) && item.clickReveal && !clickRevealed}
    class:hidden={hidden}
    bind:this={itemElem}
    on:mousedown={press}
    on:mouseup={release}
>
    {#if lines && !noTextMode}
        <TextboxLines {item} {slideIndex} {isMirrorItem} {key} {smallFontSize} {animationStyle} {dynamicValues} {isStage} {customFontSize} {outputStyle} {ref} {style} {customStyle} {stageItem} {chords} {linesStart} {linesEnd} fontSize={smallFontSize ? 20 : fontSize} {customTypeRatio} {maxLines} {maxLinesInvert} {centerPreview} {revealed} styleOverrides={templateStyleOverrides} {useOriginalTextColor} hideContent={hideUntilAutosized} on:updateAutoSize={calculateAutosize} />
    {:else}
        <SlideItems {item} {slideIndex} {preview} {isTemplatePreview} {mirror} {isMirrorItem} {ratio} {disableListTransition} {smallFontSize} {ref} {fontSize} {outputId} />
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
            /* not supported */ backdrop-filter 500ms,
            all 0.1s;
    }
    .item.isStage {
        width: 100%;
        height: 100%;
    }
    .item.stageNoAuto,
    .item.stageNoAuto :global(.break),
    .item.stageNoAuto :global(span.textContainer) {
        font-size: unset;
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

    .item.hidden {
        visibility: hidden !important;
        opacity: 0 !important;
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
