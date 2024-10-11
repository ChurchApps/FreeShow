<!-- Used in output window, and currently in draw! -->

<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { MAIN } from "../../../types/Channels"
    import type { Styles } from "../../../types/Settings"
    import { colorbars, customMessageCredits, drawSettings, drawTool, media, outputs, overlays, showsCache, styles, templates, transitionData } from "../../stores"
    import { wait } from "../../utils/common"
    import { destroy, receive, send } from "../../utils/request"
    import Draw from "../draw/Draw.svelte"
    import { clone } from "../helpers/array"
    import { OutputMetadata, decodeExif, defaultLayers, getCurrentStyle, getMetadata, getOutputLines, getOutputTransitions, getResolution, getSlideFilter, getStyleTemplate, joinMetadata, setTemplateStyle } from "../helpers/output"
    import { replaceDynamicValues } from "../helpers/showActions"
    import { _show } from "../helpers/shows"
    import Image from "../media/Image.svelte"
    import Zoomed from "../slide/Zoomed.svelte"
    import { updateAnimation } from "./animation"
    import Background from "./layers/Background.svelte"
    import Metadata from "./layers/Metadata.svelte"
    import Overlays from "./layers/Overlays.svelte"
    import PdfOutput from "./layers/PdfOutput.svelte"
    import SlideContent from "./layers/SlideContent.svelte"
    import Window from "./Window.svelte"

    export let outputId: string = ""
    export let style = ""
    export let ratio: number = 0
    export let mirror: boolean = false
    export let preview: boolean = false

    $: currentOutput = $outputs[outputId] || {}

    // output styling
    $: currentStyling = getCurrentStyle($styles, currentOutput.style)
    let currentStyle: Styles = { name: "" }
    // don't refresh content unless it changes
    $: if (JSON.stringify(currentStyling) !== JSON.stringify(currentStyle)) currentStyle = clone(currentStyling)

    // layers
    let layers: string[] = []
    let out: any = {}
    let slide: any = null
    let background: any = null
    let clonedOverlays: any = {}

    // don't update when layer content changes, only when refreshing or adding/removing layer
    // currentOutput is set to refresh state when changed in preview
    $: if (currentOutput && JSON.stringify(layers) !== JSON.stringify(currentStyle.layers || defaultLayers)) setNewLayers()
    function setNewLayers() {
        layers = clone(currentStyle.layers || defaultLayers)
    }
    $: if (JSON.stringify(out) !== JSON.stringify(currentOutput?.out || {})) out = clone(currentOutput?.out || {})

    $: if (JSON.stringify(slide) !== JSON.stringify(out.slide || null)) updateOutData("slide")
    $: if (JSON.stringify(background) !== JSON.stringify(out.background || null)) updateOutData("background")

    $: refreshOutput = out.refresh
    $: if (outputId || refreshOutput) updateOutData()
    function updateOutData(type: string = "") {
        if (!type || type === "slide") {
            let noLineCurrent = clone(slide || {})
            delete noLineCurrent.line
            let noLineNew = clone(out?.slide || {})
            delete noLineNew.line

            // don't refresh if changing lines on another slide & content is unchanged
            if (!refreshOutput && !out?.slide?.type && lines[currentLineId]?.start === null && JSON.stringify(noLineCurrent) === JSON.stringify(noLineNew)) return

            // WIP option to turn off "content refresh" if slide content is identical to previous content ?

            slide = clone(out.slide || null)
        }
        if (!type || type === "background") background = clone(out.background || null)
        if (!type || type === "overlays") {
            storedOverlayIds = JSON.stringify(out.overlays)
            clonedOverlays = clone($overlays)
        }
    }

    // overlays
    $: overlayIds = out.overlays
    let storedOverlayIds: string = ""
    $: if (JSON.stringify(overlayIds) !== storedOverlayIds) updateOutData("overlays")
    $: outOverlays = out.overlays?.filter((id) => !clonedOverlays[id]?.placeUnderSlide)
    $: outUnderlays = out.overlays?.filter((id) => clonedOverlays[id]?.placeUnderSlide)

    // layout & slide data
    let currentLayout: any[] = []
    let slideData: any = null
    let currentSlide: any = null

    $: updateSlideData(slide, outputId)
    function updateSlideData(slide, _outputChanged) {
        if (!slide) {
            currentLayout = []
            slideData = null
            currentSlide = null
            return
        }

        currentLayout = clone(_show(slide.id).layouts([slide.layout]).ref()?.[0] || [])
        slideData = currentLayout[slide?.index]?.data || null

        // don't refresh content unless it changes
        let newCurrentSlide = getCurrentSlide()
        if (JSON.stringify(newCurrentSlide) !== JSON.stringify(currentSlide)) currentSlide = newCurrentSlide

        function getCurrentSlide() {
            if (!slide && !outputId) return null
            if (slide.id === "temp") return { items: slide.tempItems }
            if (!currentLayout) return null

            let slideId: string = currentLayout[slide?.index]?.id || ""
            return clone(_show(slide.id).slides([slideId]).get()[0] || {})
        }
    }

    // slide styling
    $: resolution = getResolution(currentSlide?.settings?.resolution, { currentOutput, currentStyle }, false, outputId)
    $: transitions = getOutputTransitions(slideData, currentStyle.transition, $transitionData, mirror && !preview)
    $: slideFilter = getSlideFilter(slideData)

    // custom template
    // WIP revert to old style when output style is reverted to no style (REFRESH OUTPUT)
    $: outputStyle = currentOutput?.style
    // currentSlide is so the background updates when scripture is removed (if template background on both) - not changed in preview
    $: if (outputStyle && currentStyle && currentSlide !== undefined) {
        if (currentSlide) setTemplateItems()
        getTemplateBackground()
    }
    const setTemplateItems = () => (currentSlide.items = setTemplateStyle(slide, currentStyle, currentSlide.items))
    let templateBackground = ""
    const getTemplateBackground = () => (templateBackground = getStyleTemplate(slide, currentStyle).settings?.backgroundPath || "")

    // lines
    let lines: any = {}
    $: currentLineId = slide?.id
    $: if (currentLineId) lines[currentLineId] = getOutputLines(slide, currentStyle.lines)

    // metadata
    let metadata: OutputMetadata = {}
    $: metadata = getMetadata(metadata, $showsCache[slide?.id], currentStyle, $templates, slide)

    // media exif metadata
    $: getExifData = metadata.media
    $: if (getExifData && background?.path) getExif()
    function getExif() {
        metadata.value = ""
        send(MAIN, ["READ_EXIF"], { id: background.path })
    }
    const receiveExif: any = {
        READ_EXIF: (data: any) => {
            if (!metadata.media || data.id !== background?.path) return
            let message = decodeExif(data)
            metadata.value = joinMetadata(message, currentStyle.metadataDivider)
        },
    }
    let listener = uid()
    receive(MAIN, receiveExif, listener)
    onDestroy(() => destroy(MAIN, listener))

    // ANIMATE
    let animationData: any = {}
    let currentAnimationId = ""
    $: slideAnimation = slideData?.actions?.animate || {}

    $: if (slide) stopAnimation()
    onDestroy(stopAnimation)
    function stopAnimation() {
        animationData = {}
        currentAnimationId = ""
    }

    // TODO: play slide animations on each textbox so animation can continue while transitioning
    $: if (slideAnimation) initializeAnimation()
    async function initializeAnimation() {
        if (!Object.keys(slideAnimation).length) {
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

            animationData = await updateAnimation(animationData, currentIndex, slide)
            if (currentAnimationId !== currentId) {
                animationData = {}
                return
            }

            if (typeof animationData.newIndex !== "number") return

            // stop if ended & not repeating
            if (!animationData.animation.repeat && !animationData.animation.actions[animationData.newIndex]) return

            animate(animationData.newIndex)
        }
    }

    // values
    $: isKeyOutput = currentOutput.isKeyOutput
    $: backgroundColor = isKeyOutput ? "black" : currentOutput.transparent ? "transparent" : currentSlide?.settings?.color || currentStyle.background || "black"
    $: messageText = $showsCache[slide?.id]?.message?.text?.replaceAll("\n", "<br>") || ""
    $: metadataValue = metadata.value?.length && (metadata.display === "always" || (metadata.display?.includes("first") && slide?.index === 0) || (metadata.display?.includes("last") && slide?.index === currentLayout.length - 1))
    $: styleBackground = currentStyle?.clearStyleBackgroundOnText && slide ? "" : currentStyle?.backgroundImage || ""
    $: styleBackgroundData = { path: styleBackground, ...($media[styleBackground] || {}), loop: true }
    $: templateBackgroundData = { path: templateBackground, loop: true, ...($media[templateBackground] || {}) }
    $: backgroundData = templateBackground ? templateBackgroundData : background

    // draw zoom
    $: drawZoom = $drawTool === "zoom" ? ($drawSettings.zoom?.size || 200) / 100 : 1

    // UPDATE DYNAMIC VALUES e.g. {time_} EVERY SECOND
    let updateDynamic = 0
    setInterval(() => {
        updateDynamic++
    }, 1000)
</script>

<Zoomed id={outputId} background={backgroundColor} backgroundDuration={transitions.media?.type === "none" ? 0 : (transitions.media?.duration ?? 800)} center {style} {resolution} {mirror} {drawZoom} cropping={currentStyle.cropping} bind:ratio>
    <!-- always show style background (behind other backgrounds) -->
    {#if styleBackground && slide?.type !== "pdf"}
        <Background data={styleBackgroundData} {outputId} transition={transitions.media} {currentStyle} {slideFilter} {ratio} {isKeyOutput} animationStyle={animationData.style?.background || ""} mirror styleBackground />
    {/if}

    <!-- background -->
    {#if layers.includes("background") && backgroundData}
        <Background data={backgroundData} {outputId} transition={transitions.media} {currentStyle} {slideFilter} {ratio} {isKeyOutput} animationStyle={animationData.style?.background || ""} mirror={isKeyOutput || mirror} />
    {/if}

    <!-- colorbars for testing -->
    {#if $colorbars}
        <Image path="./assets/{$colorbars}" mediaStyle={{ rendering: "pixelated" }} />
    {/if}

    <!-- "underlays" -->
    {#if layers.includes("overlays") && outUnderlays?.length}
        <Overlays {outputId} overlays={clonedOverlays} activeOverlays={outUnderlays} transition={transitions.overlay} {isKeyOutput} {mirror} />
    {/if}

    <!-- slide -->
    {#if slide?.type === "pdf" && layers.includes("background")}
        <span style="zoom: {1 / ratio};">
            <PdfOutput {slide} {currentStyle} transition={transitions.media} />
        </span>
    {:else if slide?.type === "ppt" && layers.includes("slide")}
        <span style="zoom: {1 / ratio};">
            {#if slide?.screen?.id}
                <Window id={slide?.screen?.id} class="media" style="width: 100%;height: 100%;" />
            {/if}
        </span>
    {:else if slide && slide.type !== "pdf" && layers.includes("slide")}
        <SlideContent {outputId} outSlide={slide} {slideData} {currentSlide} {currentStyle} {animationData} {currentLineId} {lines} {ratio} {mirror} {preview} transition={transitions.text} transitionEnabled={!mirror || preview} {isKeyOutput} />
    {/if}

    {#if layers.includes("overlays")}
        <!-- message -->
        {#if messageText}
            <Metadata
                value={messageText.includes("{") ? replaceDynamicValues(messageText, { showId: slide?.id, layoutId: slide?.layout, slideIndex: slide?.index }, updateDynamic) : messageText}
                style={metadata.messageStyle || ""}
                transition={transitions.overlay}
                {isKeyOutput}
            />
        {/if}

        <!-- metadata -->
        {#if metadataValue || $customMessageCredits}
            <!-- value={metadata.value ? (metadata.value.includes("{") ? createMetadataLayout(metadata.value, { showId: slide?.id, layoutId: slide?.layout, slideIndex: slide?.index }, updateDynamic) : metadata.value) : $customMessageCredits || ""} -->
            <Metadata value={metadata.value || $customMessageCredits || ""} style={metadata.style || ""} transition={transitions.overlay} {isKeyOutput} />
        {/if}

        <!-- overlays -->
        {#if outOverlays?.length}
            <Overlays {outputId} overlays={clonedOverlays} activeOverlays={outOverlays} transition={transitions.overlay} {isKeyOutput} {mirror} />
        {/if}
    {/if}

    <!-- draw -->
    {#if currentOutput.active || mirror}
        <Draw />
    {/if}
</Zoomed>
