<!-- Used in output window, and currently in draw! -->

<script lang="ts">
    import { onDestroy } from "svelte"
    import { compositedOutputs } from "../drawer/live/streamLayer"
    import { mediaFill, mediaLayered } from "./layers/mediaLayers"
    import { uid } from "uid"
    import type { OutData } from "../../../types/Output"
    import type { Styles } from "../../../types/Settings"
    import type { AnimationData, Item, LayoutRef, OutBackground, OutScene, OutSlide, Slide, SlideData, Template, Overlays as TOverlays, Transition } from "../../../types/Show"
    import { allOutputs, colorbars, currentWindow, drawSettings, drawTool, effects, media, outputs, overlays, showsCache, styles, templates, transitionData } from "../../stores"
    import { wait } from "../../utils/common"
    import { custom } from "../../utils/transitions"
    import Draw from "../draw/Draw.svelte"
    import { clone } from "../helpers/array"
    import { defaultLayers, getCurrentStyle, getMetadata, getOutputLines, getOutputTransitions, getResolution, getSlideFilter, getStyleTemplate, setTemplateStyle } from "../helpers/output"
    import { _show } from "../helpers/shows"
    import Image from "../media/Image.svelte"
    import Zoomed from "../slide/Zoomed.svelte"
    import { updateAnimation } from "./animation"
    import EffectOutput from "./effects/EffectOutput.svelte"
    import Background from "./layers/Background.svelte"
    import Overlay from "./layers/Overlay.svelte"
    import Overlays from "./layers/Overlays.svelte"
    import PdfOutput from "./layers/PdfOutput.svelte"
    import SceneMedia from "./layers/SceneMedia.svelte"
    import SlideContent from "./layers/SlideContent.svelte"
    import RepaintTick from "./RepaintTick.svelte"
    import Window from "./Window.svelte"

    export let outputId = ""
    export let style = ""
    export let ratio = 0
    export let mirror = false
    export let preview = false
    export let styleIdOverride = ""
    export let outOverride: OutData | null = null

    $: currentOutput = $outputs[outputId] || $allOutputs[outputId] || {}

    $: styleId = styleIdOverride || sceneStyleId || currentOutput?.style

    // output styling
    $: currentStyling = getCurrentStyle($styles, styleId)
    let currentStyle: Styles = { name: "" }
    let cachedStyleStr = ""
    // don't refresh content unless it changes
    $: {
        const newStr = JSON.stringify(currentStyling)
        if (newStr !== cachedStyleStr) {
            cachedStyleStr = newStr
            currentStyle = clone(currentStyling)
        }
    }

    $: alignPosition = currentStyle?.aspectRatio?.alignPosition || "center"

    // layers
    let layers: string[] = []
    let out: OutData = {}
    let slide: OutSlide | null = null
    let background: OutBackground | null = null
    let clonedOverlays: TOverlays | null = null
    let scene: OutScene | null = null

    let effectsIds: string[] = []
    $: allEffects = $effects
    $: outputtedEffectIds = sceneHideLayers ? [] : effectsIds || []
    $: effectIds = [...new Set(outputtedEffectIds)]
    $: effectsUnderSlide = effectIds.filter((id) => allEffects[id]?.placeUnderSlide === true)
    $: effectsOverSlide = effectIds.filter((id) => !allEffects[id]?.placeUnderSlide)

    // don't update when layer content changes, only when refreshing or adding/removing layer
    // currentOutput is set to refresh state when changed in preview
    let cachedLayersStr = ""
    $: if (currentOutput) {
        const newLayersStr = JSON.stringify(currentStyle.layers || defaultLayers)
        if (newLayersStr !== cachedLayersStr) {
            cachedLayersStr = newLayersStr
            layers = clone(Array.isArray(currentStyle.layers) ? currentStyle.layers : defaultLayers)
            if (!Array.isArray(layers)) layers = []
        }
    }
    let cachedOutStr = ""
    $: {
        const newOutStr = JSON.stringify(outOverride || currentOutput?.out || {})
        if (newOutStr !== cachedOutStr) {
            cachedOutStr = newOutStr
            out = clone(outOverride || currentOutput?.out || {})
        }
    }

    let cachedSlideStr = ""
    $: {
        const newSlideStr = JSON.stringify(out.slide || null)
        if (newSlideStr !== cachedSlideStr) {
            cachedSlideStr = newSlideStr
            updateOutData("slide")
        }
    }
    let cachedBgStr = ""
    $: {
        const newBgStr = JSON.stringify(out.background || null)
        if (newBgStr !== cachedBgStr) {
            cachedBgStr = newBgStr
            updateOutData("background")
        }
    }
    let cachedEffectsStr = ""
    $: {
        const newEffectsStr = JSON.stringify(out.effects || [])
        if (newEffectsStr !== cachedEffectsStr) {
            cachedEffectsStr = newEffectsStr
            effectsIds = clone(out.effects || [])
        }
    }

    let refreshVersion = 0
    let handledRefreshVersion = -1
    $: {
        refreshVersion = typeof out.refresh === "number" ? out.refresh : out.refresh ? 1 : 0
        if (refreshVersion !== handledRefreshVersion) {
            handledRefreshVersion = refreshVersion
            updateOutData("slide", true)
            updateOutData("overlays", true)
        }
    }
    $: if (outputId) updateOutData()
    function updateOutData(type = "", forceUpdate = false) {
        if (!type || type === "slide") {
            let noLineCurrent = clone(slide)
            if (noLineCurrent) delete noLineCurrent.line
            let noLineNew = clone(out?.slide)
            if (noLineNew) delete noLineNew.line

            // don't refresh if changing lines on another slide & content is unchanged
            if (!forceUpdate && !out?.slide?.type && lines[currentLineId || ""]?.start === null && JSON.stringify(noLineCurrent) === JSON.stringify(noLineNew)) return

            // WIP option to turn off "content refresh" if slide content is identical to previous content ?

            // this will reset transitions...
            // currentSlide = null
            // // timeout to allow component text to clear before removing component (needed for videoTime condition updates)
            // setTimeout(() => (slide = clone(out.slide || null)))

            slide = clone(out.slide || null)
        }
        if (!type || type === "background") background = clone(out.background || null)
        if (!type || type === "overlays") {
            storedOverlayIds = JSON.stringify(overlayIds)
            if (forceUpdate || JSON.stringify($overlays) !== storedOverlays) {
                clonedOverlays = clone($overlays)
                storedOverlays = JSON.stringify($overlays)
            }
        }
    }

    // scenes
    $: scene = out.scene || null
    $: sceneMedia = scene?.media || null
    $: sceneStyleId = scene?.style || ""
    $: sceneHiddenOverlays = scene?.hiddenOverlays || []
    $: sceneOverlays = (scene?.overlays || []).filter((id) => !sceneHiddenOverlays.includes(id))
    $: sceneHideLayers = styleIdOverride ? false : scene !== null && !sceneStyleId

    // overlays
    $: outputtedOverlayIds = sceneHideLayers ? [] : out.overlays || []
    $: overlayIds = [...new Set([...sceneOverlays, ...(layers.includes("overlays") ? outputtedOverlayIds : [])])]
    let storedOverlayIds = ""
    let storedOverlays = ""
    $: {
        const newOverlayIdsStr = JSON.stringify(overlayIds)
        if (newOverlayIdsStr !== storedOverlayIds) updateOutData("overlays")
    }
    $: outOverlays = overlayIds.filter((id) => !clonedOverlays?.[id]?.placeUnderSlide)
    $: outUnderlays = overlayIds.filter((id) => clonedOverlays?.[id]?.placeUnderSlide)

    // layout & slide data
    let currentLayout: LayoutRef[] = []
    let slideData: SlideData | null = null
    let currentSlide: Slide | null = null

    $: updateSlideData(slide, outputId, currentStyle)
    function updateSlideData(slide, _outputChanged, _styleChanged) {
        if (!slide) {
            currentLayout = []
            slideData = null
            currentSlide = null
            return
        }

        currentLayout = clone(_show(slide.id).layouts([slide.layout]).ref()[0] || [])
        slideData = currentLayout[slide?.index]?.data || null

        // don't refresh content unless it changes
        let newCurrentSlide = getCurrentSlide()
        const newSlideFormatStr = JSON.stringify(formatSlide(newCurrentSlide))
        const curSlideStr = JSON.stringify(currentSlide)
        if (newSlideFormatStr !== curSlideStr) currentSlide = newCurrentSlide

        function getCurrentSlide() {
            if (!slide && !outputId) return null
            if (slide.id === "temp" || slide.id === "tempText") return { items: slide.tempItems }
            if (!currentLayout) return null

            let slideId: string = currentLayout[slide?.index]?.id || ""
            return clone(_show(slide.id).slides([slideId]).get()[0] || {})
        }

        // add template item keys to not update item when no changes is made (when custom style template is set)
        function formatSlide(currentSlide) {
            if (!currentSlide) return null
            let newSlide = clone(currentSlide)
            newSlide.items = setTemplateStyle(slide, currentStyle, newSlide.items, outputId, newSlide.customDynamicValues)
            return newSlide
        }
    }

    // slide styling
    // currentSlide?.settings?.resolution
    $: resolution = getResolution(null, { currentOutput, currentStyle }, false, outputId, styleId)
    $: transitions = getOutputTransitions(slideData, currentStyle.transition, $transitionData, mirror && !preview)
    $: slideFilter = getSlideFilter(slideData)

    // custom template
    // currentSlide is so the background updates when scripture is removed (if template background on both) - not changed in preview
    $: if (currentStyle && currentSlide !== undefined) {
        if (styleId && currentSlide) setTemplateItems()
        getStyleTemplateData()
    }
    const setTemplateItems = () => (currentSlide!.items = setTemplateStyle(slide!, currentStyle, currentSlide!.items, outputId, currentSlide!.customDynamicValues))
    let styleTemplate: Template | null = null
    const getStyleTemplateData = () => (styleTemplate = getStyleTemplate(slide!, currentStyle))
    $: templateBackground = styleTemplate?.settings?.backgroundPath || ""

    // lines
    let lines: { [key: string]: { start: number | null; end: number | null; linesStart?: number | null; linesEnd?: number | null; clickRevealed?: boolean } } = {}
    $: currentLineId = slide?.id
    const updateLinesTime = $currentWindow === "output" ? 50 : 10
    let linesTimeout: NodeJS.Timeout | null = null
    $: if (currentLineId) {
        // don't update until all outputs has updated their "line" value
        if (linesTimeout) clearTimeout(linesTimeout)
        linesTimeout = setTimeout(() => {
            lines[currentLineId] = getOutputLines(slide!, currentStyle.lines) // , currentSlide
        }, updateLinesTime)
    }

    // metadata
    $: metadataItems = getMetadata($showsCache[(slide as any)?.id || ""], currentStyle, slide, $templates)
    let currentMetadataItems: Item[] = []
    let cachedMetadataStr = ""
    let isMetadataClearing = false
    $: if (metadataItems !== null) {
        isMetadataClearing = false
        const newMetaStr = JSON.stringify(metadataItems)
        if (newMetaStr !== cachedMetadataStr) {
            cachedMetadataStr = newMetaStr
            currentMetadataItems = clone(metadataItems)
        }
    } else {
        isMetadataClearing = true
        setTimeout(() => {
            currentMetadataItems = []
            cachedMetadataStr = ""
        })
    }

    // ANIMATE
    let animationData: AnimationData = {}
    let currentAnimationId = ""
    $: slideAnimation = slideData?.actions?.animate || null

    $: if (slide) stopAnimation()
    onDestroy(() => {
        stopAnimation()
        if (linesTimeout) clearTimeout(linesTimeout)
        if (slideTimeout) clearTimeout(slideTimeout)
    })
    function stopAnimation() {
        animationData = {}
        currentAnimationId = ""
    }

    // DEPRECATED!!
    $: if (slideAnimation) initializeAnimation()
    async function initializeAnimation() {
        if (!Object.keys(slideAnimation || {}).length) {
            stopAnimation()
            return
        }

        let duration = 50
        if (transitions.text?.type !== "none" && transitions.text?.duration) duration = Math.max(duration, transitions.text.duration / 2)

        let currentId = uid()
        let animation = clone(slideAnimation) || { actions: [] }
        animationData = { id: currentId, animation }

        await wait(duration)

        if (animationData.id !== currentId) return
        currentAnimationId = currentId

        startAnimation(currentId)
    }

    function startAnimation(currentId: string) {
        animate(0)

        async function animate(currentIndex: number) {
            if (currentAnimationId !== currentId) return

            animationData = await updateAnimation(animationData, currentIndex, slide, background)
            if (currentAnimationId !== currentId) {
                animationData = {}
                return
            }

            if (typeof animationData.newIndex !== "number") return

            // stop if ended & not repeating
            if (!animationData.animation?.repeat && !animationData.animation?.actions[animationData.newIndex]) return

            animate(animationData.newIndex)
        }
    }

    $: cropping = currentOutput?.cropping || currentStyle?.cropping

    // values
    // a composited stream (see streamLayer) is behind the page, so the background must let it through
    // Only the captured output window itself goes transparent for the composite; the worker draws the
    // video underneath the page there. A mirror is an ordinary copy drawn in this window, so making it
    // transparent showed nothing, and Zoomed animates a background color change, so it faded to black
    // for the best part of a second every time an input was triggered.
    $: opaqueBackground = styleTemplate?.settings?.backgroundColor || currentSlide?.settings?.color || currentStyle?.background || slide?.settings?.backgroundColor || "black"
    $: backgroundColor = currentOutput?.transparent || (!mirror && ($compositedOutputs[outputId] || $mediaLayered[outputId])) ? "transparent" : opaqueBackground
    // a media layer is drawn under the page by the capture worker, which fills around it with this color
    $: if (!mirror && outputId && $mediaFill[outputId] !== opaqueBackground) mediaFill.update((a) => ({ ...a, [outputId]: opaqueBackground }))
    // background image
    $: styleBackground = currentStyle?.clearStyleBackgroundOnText && (slide || background) ? "" : currentStyle?.backgroundImage || ""
    $: styleBackgroundData = { path: styleBackground, ...($media[styleBackground] || {}), loop: true }
    $: templateBackgroundData = { path: templateBackground, loop: true, ...($media[templateBackground] || {}) }
    $: backgroundData = templateBackground ? templateBackgroundData : background

    // remove slide transition when replaced by "foreground" media (drawn below slide)
    const noTransition: Transition = { type: "none", duration: 0, easing: "" }
    $: textTransition = !slide && backgroundData?.ignoreLayer ? noTransition : transitions.text
    // remove PDF/PPT transition when background is outputted
    $: slideMediaTransition = !slide && backgroundData ? noTransition : transitions.media

    $: overlaysActive = !!((scene === null ? layers.includes("overlays") : true) && clonedOverlays)
    // $: effectsActive = !!(layers.includes("overlays") && effectIds.length)

    // draw zoom
    $: zoomActive = currentOutput.active || (mirror && !preview)
    $: drawZoom = $drawTool === "zoom" && zoomActive ? ($drawSettings.zoom?.size || 200) / 100 : 1

    // CLEARING
    $: if (slide !== undefined || currentStyle || layers || sceneHideLayers !== undefined) updateSlide()
    let actualSlide: OutSlide | null = null
    let actualSlideData: SlideData | null = null
    let actualCurrentSlide: Slide | null = null
    let actualCurrentLineId: string | undefined = undefined
    let slideRemountCounter = 0
    let previousRefreshVersion = -1
    let pendingSlideRemounts = 0
    let isSlideClearing = false
    let slideTimeout: NodeJS.Timeout | null = null
    $: {
        if (previousRefreshVersion >= 0 && refreshVersion !== previousRefreshVersion) {
            pendingSlideRemounts++
        }
        previousRefreshVersion = refreshVersion
    }

    function updateSlide() {
        // update clearing variable before setting slide value (used for conditions to not show up again while clearing)
        const slideActive = layers.includes("slide") && !sceneHideLayers
        isSlideClearing = !slide || !slideActive

        if (slideTimeout) clearTimeout(slideTimeout)
        slideTimeout = setTimeout(
            () => {
                actualSlide = slideActive ? clone(slide) : null
                actualSlideData = clone(slideData)
                actualCurrentSlide = clone(currentSlide)
                actualCurrentLineId = clone(currentLineId)
                if (pendingSlideRemounts) {
                    slideRemountCounter += pendingSlideRemounts
                    pendingSlideRemounts = 0
                }
            },
            slide ? updateLinesTime : 0
        )
    }
</script>

<Zoomed id={outputId} background={backgroundColor} checkered={(preview || mirror) && backgroundColor === "transparent"} backgroundDuration={transitions.media?.type === "none" ? 0 : (transitions.media?.duration ?? 800)} align={alignPosition} center {style} {resolution} styleIdOverride={styleId} {mirror} {drawZoom} {cropping} bind:ratio>
    <!-- always show style background (behind other backgrounds) -->
    {#if styleBackground && actualSlide?.type !== "pdf"}
        <Background data={styleBackgroundData} {outputId} transition={transitions.media} {currentStyle} {slideFilter} {ratio} animationStyle={animationData.style?.background || ""} mirror />
    {/if}

    <!-- scene media -->
    {#if sceneMedia}
        <SceneMedia media={sceneMedia} {mirror} {outputId} />
    {/if}

    <!-- background -->
    {#if (backgroundData?.ignoreLayer ? layers.includes("slide") : layers.includes("background")) && !sceneHideLayers && backgroundData}
        <Background data={backgroundData} {outputId} transition={transitions.media} {currentStyle} {slideFilter} {ratio} animationStyle={animationData.style?.background || ""} {mirror} />
    {/if}

    <!-- colorbars for testing -->
    {#if $colorbars[outputId]}
        <Image path="./assets/{$colorbars[outputId]}" mediaStyle={{ rendering: "pixelated", fit: "fill" }} />
    {/if}

    <!-- effects -->
    {#if effectsUnderSlide && layers.includes("overlays")}
        <EffectOutput ids={effectsUnderSlide} transition={transitions.overlay} {mirror} />
    {/if}

    <!-- "underlays" -->
    {#if overlaysActive}
        <!-- && outUnderlays?.length -->
        <Overlays {outputId} overlays={clonedOverlays} activeOverlays={outUnderlays} transition={transitions.overlay} {mirror} {preview} styleIdOverride={styleIdOverride || sceneStyleId} />
    {/if}

    <!-- slide -->
    {#if actualSlide?.type === "pdf" && layers.includes("background")}
        <span style="zoom: {1 / ratio};">
            <PdfOutput slide={actualSlide} {currentStyle} transition={slideMediaTransition} />
        </span>
    {:else if actualSlide?.type === "ppt" && layers.includes("slide")}
        <span style="zoom: {1 / ratio};">
            {#if actualSlide?.screen?.id}
                <Window id={actualSlide?.screen?.id} class="media" style="width: 100%;height: 100%;" />
            {/if}
        </span>
    {:else if actualSlide && actualSlide?.type !== "pdf"}
        <SlideContent {outputId} outSlide={actualSlide} isClearing={isSlideClearing} slideData={actualSlideData} currentSlide={actualCurrentSlide} {currentStyle} {animationData} currentLineId={actualCurrentLineId} {lines} {ratio} {mirror} {preview} transition={textTransition} transitionEnabled={!mirror || preview} styleIdOverride={styleIdOverride || sceneStyleId} refreshCounter={slideRemountCounter} />

        <!-- metadata -->
        <Overlay overlay={{ items: currentMetadataItems }} isClearing={isMetadataClearing || isSlideClearing} {outputId} transition={textTransition} styleIdOverride={styleIdOverride || sceneStyleId} />
    {/if}

    <!-- effects -->
    {#if effectsOverSlide && layers.includes("overlays")}
        <EffectOutput ids={effectsOverSlide} transition={transitions.overlay} {mirror} />
    {/if}

    <!-- overlays -->
    <!-- outOverlays?.length -->
    {#if overlaysActive}
        <Overlays {outputId} overlays={clonedOverlays} activeOverlays={outOverlays} transition={transitions.overlay} {mirror} {preview} styleIdOverride={styleIdOverride || sceneStyleId} />
    {/if}

    {#if actualSlide?.attributionString && layers.includes("slide")}
        {#if mirror}
            <p class="attributionString">{actualSlide.attributionString.slice(0, 135)}</p>
        {:else}
            <p class="attributionString" transition:custom={textTransition}>{actualSlide.attributionString.slice(0, 135)}</p>
        {/if}
    {/if}

    <!-- draw -->
    {#if zoomActive}
        <Draw />
    {/if}

    {#if !mirror && !preview}
        <RepaintTick {outputId} />
    {/if}
</Zoomed>

<style>
    .attributionString {
        position: absolute;
        bottom: 15px;
        left: 50%;
        transform: translateX(-50%);

        font-size: 28px;
        font-style: italic;
        opacity: 0.7;
    }
</style>
