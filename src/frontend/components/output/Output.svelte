<!-- Used in output window, and currently in draw! -->

<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { Main } from "../../../types/IPC/Main"
    import { OutData } from "../../../types/Output"
    import type { Styles } from "../../../types/Settings"
    import type { AnimationData, LayoutRef, OutBackground, OutSlide, Slide, SlideData, Template, Overlays as TOverlays } from "../../../types/Show"
    import { requestMain } from "../../IPC/main"
    import { allOutputs, colorbars, currentWindow, customMessageCredits, drawSettings, drawTool, effects, media, outputs, overlays, showsCache, styles, templates, transitionData } from "../../stores"
    import { wait } from "../../utils/common"
    import { custom } from "../../utils/transitions"
    import Draw from "../draw/Draw.svelte"
    import { clone } from "../helpers/array"
    import { decodeExif, defaultLayers, getCurrentStyle, getMetadata, getOutputLines, getOutputTransitions, getResolution, getSlideFilter, getStyleTemplate, joinMetadata, OutputMetadata, setTemplateStyle } from "../helpers/output"
    import { replaceDynamicValues } from "../helpers/showActions"
    import { _show } from "../helpers/shows"
    import Image from "../media/Image.svelte"
    import Zoomed from "../slide/Zoomed.svelte"
    import { updateAnimation } from "./animation"
    import EffectOutput from "./effects/EffectOutput.svelte"
    import Background from "./layers/Background.svelte"
    import Metadata from "./layers/Metadata.svelte"
    import Overlays from "./layers/Overlays.svelte"
    import PdfOutput from "./layers/PdfOutput.svelte"
    import SlideContent from "./layers/SlideContent.svelte"
    import Window from "./Window.svelte"

    export let outputId = ""
    export let style = ""
    export let ratio = 0
    export let mirror = false
    export let preview = false
    export let styleIdOverride = ""
    export let outOverride: OutData | null = null

    $: currentOutput = $outputs[outputId] || $allOutputs[outputId] || {}

    // output styling
    $: currentStyling = getCurrentStyle($styles, styleIdOverride || currentOutput.style)
    let currentStyle: Styles = { name: "" }
    // don't refresh content unless it changes
    $: if (JSON.stringify(currentStyling) !== JSON.stringify(currentStyle)) currentStyle = clone(currentStyling)

    $: alignPosition = currentStyle?.aspectRatio?.alignPosition || "center"

    // layers
    let layers: string[] = []
    let out: OutData = {}
    let slide: OutSlide | null = null
    let background: OutBackground | null = null
    let clonedOverlays: TOverlays | null = null

    $: effectsIds = clone(out.effects || [])
    $: allEffects = $effects
    $: effectsUnderSlide = effectsIds.filter((id) => allEffects[id]?.placeUnderSlide === true)
    $: effectsOverSlide = effectsIds.filter((id) => !allEffects[id]?.placeUnderSlide)

    // don't update when layer content changes, only when refreshing or adding/removing layer
    // currentOutput is set to refresh state when changed in preview
    $: if (currentOutput && JSON.stringify(layers) !== JSON.stringify(currentStyle.layers || defaultLayers)) setNewLayers()
    function setNewLayers() {
        layers = clone(Array.isArray(currentStyle.layers) ? currentStyle.layers : defaultLayers)
        if (!Array.isArray(layers)) layers = []
    }
    $: if (JSON.stringify(out) !== JSON.stringify(outOverride || currentOutput?.out || {})) out = clone(outOverride || currentOutput?.out || {})

    $: if (JSON.stringify(slide) !== JSON.stringify(out.slide || null)) updateOutData("slide")
    $: if (JSON.stringify(background) !== JSON.stringify(out.background || null)) updateOutData("background")

    $: refreshOutput = out.refresh
    $: if (outputId || refreshOutput) updateOutData()
    function updateOutData(type = "") {
        if (!type || type === "slide") {
            let noLineCurrent = clone(slide)
            if (noLineCurrent) delete noLineCurrent.line
            let noLineNew = clone(out?.slide)
            if (noLineNew) delete noLineNew.line

            // don't refresh if changing lines on another slide & content is unchanged
            if (!refreshOutput && !out?.slide?.type && lines[currentLineId || ""]?.start === null && JSON.stringify(noLineCurrent) === JSON.stringify(noLineNew)) return

            // WIP option to turn off "content refresh" if slide content is identical to previous content ?

            // this will reset transitions...
            // currentSlide = null
            // // timeout to allow component text to clear before removing component (needed for videoTime condition updates)
            // setTimeout(() => (slide = clone(out.slide || null)))

            slide = clone(out.slide || null)
        }
        if (!type || type === "background") background = clone(out.background || null)
        if (!type || type === "overlays") {
            storedOverlayIds = JSON.stringify(out.overlays)
            if (JSON.stringify($overlays) !== storedOverlays) {
                clonedOverlays = clone($overlays)
                storedOverlays = JSON.stringify($overlays)
            }
        }
    }

    // overlays
    $: overlayIds = out.overlays
    let storedOverlayIds = ""
    let storedOverlays = ""
    $: if (JSON.stringify(overlayIds) !== storedOverlayIds) updateOutData("overlays")
    $: outOverlays = out.overlays?.filter((id) => !clonedOverlays?.[id]?.placeUnderSlide) || []
    $: outUnderlays = out.overlays?.filter((id) => clonedOverlays?.[id]?.placeUnderSlide) || []

    // layout & slide data
    let currentLayout: LayoutRef[] = []
    let slideData: SlideData | null = null
    let currentSlide: Slide | null = null

    $: updateSlideData(slide, outputId)
    function updateSlideData(slide, _outputChanged) {
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
        if (JSON.stringify(formatSlide(newCurrentSlide)) !== JSON.stringify(currentSlide)) currentSlide = newCurrentSlide

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
            newSlide.items = setTemplateStyle(slide, currentStyle, newSlide.items, outputId)
            return newSlide
        }
    }

    // slide styling
    // currentSlide?.settings?.resolution
    $: resolution = getResolution(null, { currentOutput, currentStyle }, false, outputId, styleIdOverride)
    $: transitions = getOutputTransitions(slideData, currentStyle.transition, $transitionData, mirror && !preview)
    $: slideFilter = getSlideFilter(slideData)

    // custom template
    // WIP revert to old style when output style is reverted to no style (REFRESH OUTPUT)
    $: outputStyle = styleIdOverride || currentOutput?.style
    // currentSlide is so the background updates when scripture is removed (if template background on both) - not changed in preview
    $: if (outputStyle && currentStyle && currentSlide !== undefined) {
        if (currentSlide) setTemplateItems()
        getStyleTemplateData()
    }
    const setTemplateItems = () => (currentSlide!.items = setTemplateStyle(slide!, currentStyle, currentSlide!.items, outputId))
    let styleTemplate: Template | null = null
    const getStyleTemplateData = () => (styleTemplate = getStyleTemplate(slide!, currentStyle))
    $: templateBackground = styleTemplate?.settings?.backgroundPath || ""

    // lines
    let lines: { [key: string]: { start: number | null; end: number | null; linesStart?: number | null; linesEnd?: number | null; clickRevealed?: boolean } } = {}
    $: currentLineId = slide?.id
    const updateLinesTime = $currentWindow === "output" ? 50 : 10
    $: if (currentLineId) {
        // don't update until all outputs has updated their "line" value
        setTimeout(() => {
            lines[currentLineId] = getOutputLines(slide!, currentStyle.lines) // , currentSlide
        }, updateLinesTime)
    }

    // metadata
    let metadata: OutputMetadata = {}
    $: metadata = getMetadata(metadata, $showsCache[slide?.id || ""], currentStyle, $templates, slide)

    // media exif metadata
    $: getExifData = metadata.media
    $: if (getExifData && background?.path) getExif()
    async function getExif() {
        metadata.value = ""

        const data = await requestMain(Main.READ_EXIF, { id: background?.path || "" })
        if (!metadata.media || data.id !== background?.path) return

        let message = decodeExif(data)
        metadata.value = joinMetadata(message, currentStyle.metadataDivider)
    }

    // ANIMATE
    let animationData: AnimationData = {}
    let currentAnimationId = ""
    $: slideAnimation = slideData?.actions?.animate || null

    $: if (slide) stopAnimation()
    onDestroy(stopAnimation)
    function stopAnimation() {
        animationData = {}
        currentAnimationId = ""
    }

    // TODO: play slide animations on each textbox so animation can continue while transitioning
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

    $: cropping = currentOutput.cropping || currentStyle.cropping

    // values
    $: backgroundColor = currentOutput.transparent ? "transparent" : styleTemplate?.settings?.backgroundColor || currentSlide?.settings?.color || currentStyle.background || "black"
    $: messageText = $showsCache[slide?.id || ""]?.message?.text?.replaceAll("\n", "<br>") || ""
    // metadata display
    $: firstActiveSlideIndex = currentLayout.findIndex((a) => !a.data.disabled)
    $: lastActiveSlideIndex = currentLayout.length - 1 - [...currentLayout].reverse().findIndex((a) => !a.data.disabled)
    $: displayMetadata =
        metadata.value?.length &&
        (metadata.display === "always" ||
            (metadata.display?.includes("first") && (slide?.index === firstActiveSlideIndex || slide?.index === 0)) ||
            (metadata.display?.includes("last") && (slide?.index === lastActiveSlideIndex || slide?.index === currentLayout.length - 1)))
    // background image
    $: styleBackground = currentStyle?.clearStyleBackgroundOnText && (slide || background) ? "" : currentStyle?.backgroundImage || ""
    $: styleBackgroundData = { path: styleBackground, ...($media[styleBackground] || {}), loop: true }
    $: templateBackgroundData = { path: templateBackground, loop: true, ...($media[templateBackground] || {}) }
    $: backgroundData = templateBackground ? templateBackgroundData : background

    $: overlaysActive = !!(layers.includes("overlays") && clonedOverlays)

    // draw zoom
    $: zoomActive = currentOutput.active || (mirror && !preview)
    $: drawZoom = $drawTool === "zoom" && zoomActive ? ($drawSettings.zoom?.size || 200) / 100 : 1

    // CLEARING
    $: if (slide !== undefined || layers) updateSlide()
    let actualSlide: OutSlide | null = null
    let actualSlideData: SlideData | null = null
    let actualCurrentSlide: Slide | null = null
    let actualCurrentLineId: string | undefined = undefined
    let isSlideClearing = false
    function updateSlide() {
        // update clearing variable before setting slide value (used for conditions to not show up again while clearing)
        const slideActive = layers.includes("slide")
        isSlideClearing = !slide || !slideActive

        setTimeout(() => {
            actualSlide = slideActive ? clone(slide) : null
            actualSlideData = clone(slideData)
            actualCurrentSlide = clone(currentSlide)
            actualCurrentLineId = clone(currentLineId)
        })
    }

    // UPDATE DYNAMIC VALUES e.g. {time_} EVERY SECOND
    let updateDynamic = 0
    const dynamicInterval = setInterval(() => {
        updateDynamic++
    }, 1000)
    onDestroy(() => clearInterval(dynamicInterval))
</script>

<Zoomed
    id={outputId}
    background={backgroundColor}
    checkered={(preview || mirror) && backgroundColor === "transparent"}
    backgroundDuration={transitions.media?.type === "none" ? 0 : (transitions.media?.duration ?? 800)}
    align={alignPosition}
    center
    {style}
    {resolution}
    {mirror}
    {drawZoom}
    {cropping}
    bind:ratio
>
    <!-- always show style background (behind other backgrounds) -->
    {#if styleBackground && actualSlide?.type !== "pdf"}
        <Background data={styleBackgroundData} {outputId} transition={transitions.media} {currentStyle} {slideFilter} {ratio} animationStyle={animationData.style?.background || ""} mirror styleBackground />
    {/if}

    <!-- background -->
    {#if (layers.includes("background") || backgroundData?.ignoreLayer) && backgroundData}
        <Background data={backgroundData} {outputId} transition={transitions.media} {currentStyle} {slideFilter} {ratio} animationStyle={animationData.style?.background || ""} {mirror} />
    {/if}

    <!-- colorbars for testing -->
    {#if $colorbars[outputId]}
        <Image path="./assets/{$colorbars[outputId]}" mediaStyle={{ rendering: "pixelated", fit: "fill" }} />
    {/if}

    <!-- effects -->
    {#if effectsUnderSlide}
        <EffectOutput ids={effectsUnderSlide} transition={transitions.overlay} {mirror} />
    {/if}

    <!-- "underlays" -->
    {#if overlaysActive}
        <!-- && outUnderlays?.length -->
        <Overlays {outputId} overlays={clonedOverlays} activeOverlays={outUnderlays} transition={transitions.overlay} {mirror} {preview} />
    {/if}

    <!-- slide -->
    {#if actualSlide?.type === "pdf" && layers.includes("background")}
        <span style="zoom: {1 / ratio};">
            <PdfOutput slide={actualSlide} {currentStyle} transition={transitions.media} />
        </span>
    {:else if actualSlide?.type === "ppt" && layers.includes("slide")}
        <span style="zoom: {1 / ratio};">
            {#if actualSlide?.screen?.id}
                <Window id={actualSlide?.screen?.id} class="media" style="width: 100%;height: 100%;" />
            {/if}
        </span>
    {:else if actualSlide && actualSlide?.type !== "pdf"}
        <SlideContent
            {outputId}
            outSlide={actualSlide}
            isClearing={isSlideClearing}
            slideData={actualSlideData}
            currentSlide={actualCurrentSlide}
            {currentStyle}
            {animationData}
            currentLineId={actualCurrentLineId}
            {lines}
            {ratio}
            {mirror}
            {preview}
            transition={transitions.text}
            transitionEnabled={!mirror || preview}
            {styleIdOverride}
        />
    {/if}

    {#if layers.includes("overlays")}
        <!-- message -->
        {#if messageText}
            <Metadata
                value={messageText.includes("{") ? replaceDynamicValues(messageText, { showId: actualSlide?.id, layoutId: actualSlide?.layout, slideIndex: actualSlide?.index }, updateDynamic) : messageText}
                style={metadata.messageStyle || ""}
                transition={metadata.messageTransition || transitions.overlay}
            />
        {/if}

        <!-- metadata -->
        {#if displayMetadata || ((layers.includes("background") || backgroundData?.ignoreLayer) && $customMessageCredits)}
            <!-- value={metadata.value ? (metadata.value.includes("{") ? createMetadataLayout(metadata.value, { showId: actualSlide?.id, layoutId: actualSlide?.layout, slideIndex: actualSlide?.index }, updateDynamic) : metadata.value) : $customMessageCredits || ""} -->
            <Metadata value={metadata.value || $customMessageCredits || ""} style={metadata.style || ""} conditions={metadata.condition} isClearing={isSlideClearing} {outputId} transition={metadata.transition || transitions.overlay} />
        {/if}

        <!-- effects -->
        {#if effectsOverSlide}
            <EffectOutput ids={effectsOverSlide} transition={transitions.overlay} {mirror} />
        {/if}

        <!-- overlays -->
        <!-- outOverlays?.length -->
        {#if overlaysActive}
            <Overlays {outputId} overlays={clonedOverlays} activeOverlays={outOverlays} transition={transitions.overlay} {mirror} {preview} />
        {/if}
    {/if}

    {#if actualSlide?.attributionString && layers.includes("slide")}
        {#if mirror}
            <p class="attributionString">{actualSlide.attributionString}</p>
        {:else}
            <p class="attributionString" transition:custom={transitions.text}>{actualSlide.attributionString}</p>
        {/if}
    {/if}

    <!-- draw -->
    {#if zoomActive}
        <Draw />
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
