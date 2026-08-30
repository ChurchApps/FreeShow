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
    import { getActiveOutputs, getAllActiveOutputs, getFirstActiveOutput, getOutputLines, getOutputResolution, percentageStylePos } from "../helpers/output"
    import { createCSSVariables } from "../helpers/showActions"
    import { isCroppedItem } from "../helpers/cropping"
    import { getStyles, getItemStyle } from "../helpers/style"
    import SlideItems from "./SlideItems.svelte"
    import TextboxLines from "./TextboxLines.svelte"
    import { readAutoSizeCache, writeAutoSizeCache } from "./autosizeCache"

    export let item: Item
    export let itemIndex = -1
    export let slideIndex = 0
    export let preview = false
    export let isTemplatePreview = false
    export let mirror = true
    export let isOutputted = false
    export let ratio = 1
    export let outputId = ""
    export let filter = ""
    export let backdropFilter = ""
    export let key = false
    export let transition: Transition | null = null
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
        origin?: string
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
    export let updateDynamicValues = true

    // reuse autosize work across components by caching measurements alongside a signature
    // surface measurement completion for parents that want to precompute autosize
    const dispatch = createEventDispatcher<{
        autosizeReady: { key: string; fontSize: number }
    }>()

    $: lines = clone(item?.lines)
    $: if (linesStart !== null && linesEnd !== null && lines?.length) {
        lines = lines.filter((a) => Array.isArray(a.text) && a.text.filter((a) => a.value !== undefined)?.length)

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

    let hideSafetyTimeout: NodeJS.Timeout | null = null
    $: if (hideUntilAutosized) {
        if (hideSafetyTimeout) clearTimeout(hideSafetyTimeout)
        hideSafetyTimeout = setTimeout(() => {
            if (hideUntilAutosized) {
                hideUntilAutosized = false
                // markAutoSizeReady() // Ensure state is consistent
            }
        }, 600)
    } else {
        if (hideSafetyTimeout) clearTimeout(hideSafetyTimeout)
        hideSafetyTimeout = null
    }

    // remember which item signature we already reset local font size for
    let lastRenderedSignature = ""
    onMount(() => {
        if (preview) {
            loaded = true
        } else {
            setTimeout(() => {
                loaded = true
            }, 100)
        }
    })
    onDestroy(() => {
        if (dateInterval) clearInterval(dateInterval)
        if (debounceTimer) clearTimeout(debounceTimer)
        if (cssInterval) clearInterval(cssInterval)
    })

    // $: if (item.type === "timer") ref.id = item.timer!.id!

    let customOutputId = outputId
    $: if (!outputId) customOutputId = getActiveOutputs($outputs, true, true, true)[0]

    function getCustomStyle(currentStyle: string, outputId = "", styleIdOverride = "", _updater: any = null) {
        if (outputId && !isStage) {
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

        // favor output-driven templates first so overrides don't bleed between outputs
        const styleResolved = resolveTemplate(isScriptureContext ? styleScriptureTemplateId : outputStyle?.template || "")
        if (styleResolved) return styleResolved

        // group templates provide per-group defaults
        const groupResolved = resolveTemplate(groupTemplateId)
        if (groupResolved) return groupResolved

        const showResolved = resolveTemplate(currentShowTemplateId)
        if (showResolved) return showResolved

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

    $: stateSignature = `${item?.id || itemIndex}_${resolvedTemplateId}_${item?.lines?.length || 0}`

    $: if (stateSignature !== lastRenderedSignature) {
        lastRenderedSignature = stateSignature
        autoSizeReady = false
        const isTextItem = (item?.type || "text") === "text"
        const textFit = item?.textFit || (item?.auto ? (isTextItem ? "shrinkToFit" : "growToFit") : "none")
        const hasAutoSize = stageAutoSize || textFit !== "none"
        if (hasAutoSize) {
            const willHide = shouldHideUntilAutoSizeCompletes()

            if (isStage) {
                // Keep existing fontSize on stage to prevent flicker during drag
            } else if (willHide) {
                fontSize = 0
            } else if (preview) {
                fontSize = item?.previewAutoFontSize || item?.autoFontSize || 100
            } else {
                fontSize = item?.autoFontSize || 0
            }

            hideUntilAutosized = willHide
        }
    }
    let prevAutosizeSignature = ""
    $: autosizeSignature = `${isStage ? stageItem?.style || "" : item?.style || ""}_${resolvedTemplateId}_${chordLines ? 1 : 0}_${stageAutoSize ? 1 : 0}_${item?.textFit || ""}_${stageItem?.textFit || ""}_${JSON.stringify(item?.lines || stageItem?.lines || "")}_${ratio}`

    let debounceTimer: NodeJS.Timeout | null = null
    function debouncedCalculateAutosize(delay = 50) {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
            debounceTimer = null
            calculateAutosize()
        }, delay)
    }

    // Trigger calculation only when Content, Style, Template, or Ratio actually changes
    $: if (itemElem && loaded && autosizeSignature !== prevAutosizeSignature) {
        prevAutosizeSignature = autosizeSignature
        debouncedCalculateAutosize(isStage ? 60 : 0)
    }
    $: isDynamicText = (stageItem ? getItemText(stageItem) : getItemText(item)).includes("{")
    $: if (itemElem && loaded && $variables && isDynamicText) {
        debouncedCalculateAutosize(50)
    }

    // recalculate auto size if output template is different than show template
    $: currentShowTemplateId = $showsCache[ref.showId || ""]?.settings?.template || ""
    $: outputSlide = getFirstActiveOutput($outputs)?.out?.slide
    $: if (item?.type === "slide_tracker" && outputSlide) debouncedCalculateAutosize(50) // overlay progress update
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

    async function calculateAutosize() {
        if (item.type === "media" || item.type === "camera" || item.type === "icon") return
        if (isStage && !stageAutoSize) {
            return
        }

        const isTextItem = (item.type || "text") === "text"
        let textFit = item.textFit || (isTextItem ? (item?.auto ? "shrinkToFit" : "none") : "growToFit")
        if (textFit === "none" && !isStage) {
            fontSize = 0
            markAutoSizeReady()
            return
        }

        let elem = itemElem
        if (!elem) return

        const isDynamic = isTextItem && getItemText(isStage ? stageItem : item).includes("{")

        // Immediate cache check: if we already have a cached size for the current element dimensions, return it immediately without waiting!
        const cacheKey = buildAutoSizeCacheKey()
        const cacheSignature = buildAutoSizeSignature(undefined, undefined, chords)
        const cachedResult = cacheKey ? readAutoSizeCache(cacheKey) : undefined

        if (!isDynamic && !chords && !Number(outputStyle?.lines || 0) && cachedResult && cachedResult.signature === cacheSignature) {
            fontSize = cachedResult.fontSize
            if (item.type === "slide_tracker") {
                markAutoSizeReady()
                return
            }
            if (fontSize !== item.autoFontSize) setItemAutoFontSize(fontSize)
            markAutoSizeReady()
            return
        }

        // Wait for DOM to update with new template styles before measuring
        await tick()

        // Wait for CSS styles to fully cascade and layout to stabilize before measuring (only needed for output window)
        const isOutputContext = ratio < 0.5 && !preview && !isStage
        if (isOutputContext && itemElem) {
            let prevWidth = itemElem.clientWidth
            let prevHeight = itemElem.clientHeight
            let attempts = 0
            const maxAttempts = 20
            let totalWait = 0
            const maxWait = 500

            while (attempts < maxAttempts && totalWait < maxWait) {
                const waitTime = attempts === 0 ? 150 : attempts === 1 ? 50 : 20
                await wait(waitTime)
                totalWait += waitTime

                if (!itemElem) return

                const newWidth = itemElem.clientWidth
                const newHeight = itemElem.clientHeight

                if (newWidth === prevWidth && newHeight === prevHeight) {
                    break
                }

                prevWidth = newWidth
                prevHeight = newHeight
                attempts++
            }
        }

        let defaultFontSize
        let maxFontSize

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
            let itemFontSize = Number(getStyles(itemText[0]?.style, true)?.["font-size"] || "") || 100

            // get scripture verse ratio
            const verseItemText = allText.filter((a) => a.customType?.includes("disableTemplate")) || []
            const verseItemSize = Number(getStyles(verseItemText[0]?.style, true)?.["font-size"] || "") || 0
            customTypeRatio = verseItemSize / 100 || 1

            defaultFontSize = itemFontSize
            if (textFit === "growToFit" && isTextItem) maxFontSize = itemFontSize
        }

        elem = itemElem
        if (!elem) return

        // short-circuit expensive DOM work when we already measured identical content
        const finalCacheKey = buildAutoSizeCacheKey()
        const finalCacheSignature = buildAutoSizeSignature(undefined, undefined, chords)
        const finalCachedResult = finalCacheKey ? readAutoSizeCache(finalCacheKey) : undefined

        if (!isDynamic && !chords && !Number(outputStyle?.lines || 0) && finalCachedResult && finalCachedResult.signature === finalCacheSignature) {
            fontSize = finalCachedResult.fontSize
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

        try {
            fontSize = autosize(elem, {
                type: textFit,
                textQuery,
                defaultFontSize,
                maxFontSize,
                isList: item?.list?.enabled || false
            })
        } catch (e) {
            console.error(e)
        }

        // smaller in general if bullet list, because they are not accounted for
        if (item?.list?.enabled) fontSize *= 0.9

        if (item.type === "slide_tracker") {
            if (finalCacheKey) writeAutoSizeCache(finalCacheKey, { signature: finalCacheSignature, fontSize })
            markAutoSizeReady()
            return
        }
        // Store in separate field for previews vs OUTPUT
        if (preview && fontSize !== item.previewAutoFontSize) setItemPreviewAutoFontSize(fontSize)
        if (fontSize !== item.autoFontSize) setItemAutoFontSize(fontSize)
        if (!isDynamic && finalCacheKey) writeAutoSizeCache(finalCacheKey, { signature: finalCacheSignature, fontSize })

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
    function buildAutoSizeSignature(measuredWidth?: number, measuredHeight?: number, customChords?: boolean) {
        // Extract key dimensional properties from style to ensure cache invalidation
        const activeStyle = (isStage && stageItem?.style ? stageItem.style : item?.style) || ""
        const styles = activeStyle ? getStyles(activeStyle) : {}
        const boxDimensions: any = {
            width: styles.width,
            height: styles.height,
            left: styles.left,
            top: styles.top,
            fontSize: styles["font-size"]
        }

        // Fix for thumbnails getting stuck with wrong cache when dimensions change via CSS classes
        if (preview) {
            // Round measured width/height to nearest 5px to tolerate small container stretching fluctuations during load
            boxDimensions.measuredWidth = measuredWidth ? Math.round(measuredWidth / 5) * 5 : 0
            boxDimensions.measuredHeight = measuredHeight ? Math.round(measuredHeight / 5) * 5 : 0
        }

        // Fix for OUTPUT getting stuck with wrong cache when output window dimensions change
        // Include container dimensions to invalidate cache when OUTPUT resolution/size changes
        if (!preview && !isStage && itemElem) {
            const container = itemElem.parentElement
            if (container) {
                boxDimensions.containerWidth = container.clientWidth ? Math.round(container.clientWidth / 5) * 5 : 0
                boxDimensions.containerHeight = container.clientHeight ? Math.round(container.clientHeight / 5) * 5 : 0
            }
        }

        return JSON.stringify({
            lines: item?.lines || null,
            style: activeStyle,
            boxDimensions, // Add explicit dimensions for better cache invalidation
            textFit: item?.textFit || "none",
            list: item?.list || null,
            chords: !!(customChords !== undefined ? customChords : chords),
            stageAutoSize: !!stageAutoSize,
            stageItem: stageItem || null,
            fontSizeOverride: customFontSize || null,
            ratio: ratio && ratio >= 0.02 ? Math.round(ratio * 10) / 10 : 0.1,
            outputStyle: outputStyle || null,
            styleIdOverride: styleIdOverride || "",
            mirror: !!mirror,
            preview: !!preview,
            smallFontSize: !!smallFontSize,
            maxLines: maxLines || 0,
            maxLinesInvert: !!maxLinesInvert,
            centerPreview: !!centerPreview,
            // Include resolved template to invalidate cache when template changes
            resolvedTemplateId: resolvedTemplateId || ""
        })
    }

    // notify listeners that autosize finished (and stash readiness for this render)
    function markAutoSizeReady() {
        if (autoSizeReady) return
        autoSizeReady = true
        if (autoSizeKey) dispatch("autosizeReady", { key: autoSizeKey, fontSize })
        if (hideUntilAutosized) requestAnimationFrame(() => (hideUntilAutosized = false))
    }

    function shouldHideUntilAutoSizeCompletes() {
        if (preview || isStage) return false

        const isTextItem = (item?.type || "text") === "text"
        const textFit = item?.textFit || (item?.auto ? (isTextItem ? "shrinkToFit" : "growToFit") : "none")
        if (textFit === "none") return false

        // CHECK CACHE
        const cacheKey = buildAutoSizeCacheKey()
        if (!cacheKey) return true
        const cacheSignature = buildAutoSizeSignature(itemElem?.clientWidth, itemElem?.clientHeight, chords)
        const cachedResult = readAutoSizeCache(cacheKey)

        return !(cachedResult && cachedResult.signature === cacheSignature)
    }

    function setItemAutoFontSize(fontSize) {
        if (isStage || itemIndex < 0 || $currentWindow || ref.showId === "temp") return

        if (ref.type === "overlay") {
            const currentOverlays = $overlays
            if (!currentOverlays[ref.id]?.items?.[itemIndex] || currentOverlays[ref.id].items[itemIndex].autoFontSize === fontSize) return

            overlays.update((a) => {
                a[ref.id].items[itemIndex].autoFontSize = fontSize
                return a
            })
        } else if (ref.type === "template") {
            const currentTemplates = $templates
            if (!currentTemplates[ref.id]?.items?.[itemIndex] || currentTemplates[ref.id].items[itemIndex].autoFontSize === fontSize) return

            templates.update((a) => {
                a[ref.id].items[itemIndex].autoFontSize = fontSize
                return a
            })
        } else if (ref.showId) {
            const currentShows = $showsCache
            if (!currentShows[ref.showId]?.slides?.[ref.id]?.items?.[itemIndex] || currentShows[ref.showId].slides[ref.id].items[itemIndex].autoFontSize === fontSize) return

            showsCache.update((a) => {
                a[ref.showId!].slides[ref.id].items[itemIndex].autoFontSize = fontSize
                return a
            })
        }
    }

    function setItemPreviewAutoFontSize(fontSize) {
        if (isStage || itemIndex < 0 || $currentWindow || ref.showId === "temp") return

        if (ref.type === "overlay") {
            const currentOverlays = $overlays
            if (!currentOverlays[ref.id]?.items?.[itemIndex] || currentOverlays[ref.id].items[itemIndex].previewAutoFontSize === fontSize) return

            overlays.update((a) => {
                a[ref.id].items[itemIndex].previewAutoFontSize = fontSize
                return a
            })
        } else if (ref.type === "template") {
            const currentTemplates = $templates
            if (!currentTemplates[ref.id]?.items?.[itemIndex] || currentTemplates[ref.id].items[itemIndex].previewAutoFontSize === fontSize) return

            templates.update((a) => {
                a[ref.id].items[itemIndex].previewAutoFontSize = fontSize
                return a
            })
        } else if (ref.showId) {
            const currentShows = $showsCache
            if (!currentShows[ref.showId]?.slides?.[ref.id]?.items?.[itemIndex] || currentShows[ref.showId].slides[ref.id].items[itemIndex].previewAutoFontSize === fontSize) return

            showsCache.update((a) => {
                a[ref.showId!].slides[ref.id].items[itemIndex].previewAutoFontSize = fontSize
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

    function getPaddingCorrection(stageItem: any) {
        if (typeof stageItem?.style !== "string" || !stageItem.style.includes("padding")) return ""
        const match = stageItem.style.match(/(?:^|;)\s*padding:\s*(\d+)px/)
        if (match?.[1]) {
            const padding = parseInt(match[1], 10) * 2
            if (padding > 0) return `width: calc(100% - ${padding}px); height: calc(100% - ${padding}px);`
        }
        return ""
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

    let updateTrigger = 0
    const cssIntervalTime = preview || isTemplatePreview ? 3000 : 1000
    let cssInterval = setInterval(() => updateTrigger++, cssIntervalTime)

    // give CSS access to certain dynamic values
    $: cssVariables = createCSSVariables($variables, $outputs, isStage ? "stage" : "default", updateTrigger)

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

    $: normalWrap = ref?.origin === "powerpoint"

    // style Lines selection in center preview
    let highlighedLines: any[] = []
    $: if (centerPreview && isOutputted && $outputs) {
        let b: any[] = []
        const outputs = getAllActiveOutputs()
        outputs.forEach((o) => {
            const outSlide = o.out?.slide
            if (!outSlide) return

            const style = $styles[o.style || ""]
            const amount = style?.lines || 0
            if (amount === 0) return

            const visibleLines = getOutputLines(outSlide, amount)
            const from = visibleLines.start
            if (from === null) return

            b.push({ from, to: from + amount, color: o.color, styleLines: amount })
        })

        // output with fewest style lines on top
        highlighedLines = b.sort((a, b) => b.styleLines - a.styleLines)
    } else {
        highlighedLines = []
    }
</script>

<!-- lyrics view must have "width: 100%;height: 100%;" set -->
<div
    class="item"
    style="{style ? getCustomStyle(getItemStyle(item?.style, isCroppedItem(item)), customOutputId, styleIdOverride, { $styles }) : 'width: 100%;height: 100%;'};{paddingCorrection}{foregroundFilters}{animationStyle.item || ''}{cssVariables}{fixedWidth}"
    class:white={key && !lines?.length}
    class:key
    class:isStage
    class:stageNoAuto={isStage && !stageAutoSize}
    class:isDisabledVariable
    class:noTransition
    class:chords={chordLines.length}
    class:clickable={$currentWindow === "output" && (item?.button?.press || item?.button?.release)}
    class:reveal={(centerPreview || isStage) && item?.clickReveal && !clickRevealed}
    class:hidden
    bind:this={itemElem}
    on:mousedown={press}
    on:mouseup={release}
>
    {#if lines && !noTextMode}
        <TextboxLines
            {item}
            {slideIndex}
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
            styleOverrides={templateStyleOverrides}
            {useOriginalTextColor}
            hideContent={hideUntilAutosized}
            {normalWrap}
            {highlighedLines}
            on:updateAutoSize={calculateAutosize}
            {updateDynamicValues}
        />
    {:else}
        <SlideItems {item} {slideIndex} {preview} {isTemplatePreview} {ratio} {smallFontSize} {ref} {fontSize} {outputId} />
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
            /* not supported */ backdrop-filter 500ms;
        /* all 0.1s; */ /* with slide timeline items should not have a transition */
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
