<!-- Used in output window, and currently in draw! -->

<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { MAIN } from "../../../types/Channels"
    import type { Styles } from "../../../types/Settings"
    import { outputs, overlays, showsCache, styles, templates, transitionData } from "../../stores"
    import { destroy, receive, send } from "../../utils/request"
    import Draw from "../draw/Draw.svelte"
    import { clone } from "../helpers/array"
    import { OutputMetadata, decodeExif, defaultLayers, getCurrentStyle, getMetadata, getOutputLines, getOutputTransitions, getResolution, getSlideFilter, joinMetadata, setTemplateStyle } from "../helpers/output"
    import { _show } from "../helpers/shows"
    import Zoomed from "../slide/Zoomed.svelte"
    import { updateAnimation, wait } from "./animation"
    import Background from "./layers/Background.svelte"
    import Metadata from "./layers/Metadata.svelte"
    import Overlays from "./layers/Overlays.svelte"
    import SlideContent from "./layers/SlideContent.svelte"

    export let outputId: string = ""
    export let style = ""
    export let ratio: number = 0
    export let mirror: boolean = false

    $: currentOutput = $outputs[outputId] || {}

    // output styling
    $: currentStyling = getCurrentStyle($styles, currentOutput.style)
    let currentStyle: Styles = { name: "" }
    // don't refresh content unless it changes
    $: if (JSON.stringify(currentStyling) !== JSON.stringify(currentStyle)) currentStyle = currentStyling

    // layers
    let layers: string[] = []
    let out: any = {}
    let slide: any = null
    let background: any = null
    let clonedOverlays: any = {}

    // don't update when layer content changes, only when refreshing or adding/removing layer
    $: if (JSON.stringify(layers) !== JSON.stringify(currentStyle.layers || defaultLayers)) layers = clone(currentStyle.layers || defaultLayers)
    $: if (JSON.stringify(out) !== JSON.stringify(currentOutput?.out || {})) out = clone(currentOutput?.out || {})

    $: if (JSON.stringify(slide) !== JSON.stringify(out.slide || null)) updateOutData("slide")
    $: if (JSON.stringify(background) !== JSON.stringify(out.background || null)) updateOutData("background")

    $: refreshOutput = out.refresh
    $: if (outputId || refreshOutput) updateOutData()
    function updateOutData(type: string = "") {
        if (!type || type === "slide") slide = clone(out.slide || null)
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
    $: resolution = getResolution(currentSlide?.settings?.resolution, { currentOutput, currentStyle })
    $: transitions = getOutputTransitions(slideData, $transitionData, mirror)
    $: slideFilter = getSlideFilter(slideData)

    // custom template
    $: outputStyle = currentOutput?.style
    $: if (currentSlide && outputStyle && currentStyle) setTemplateItems()
    const setTemplateItems = () => (currentSlide.items = setTemplateStyle(slide, currentStyle.template, currentSlide.items))

    // lines
    let lines: any = {}
    $: currentLineId = slide?.id
    $: lines[currentLineId] = getOutputLines(slide, currentStyle.lines)

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
    $: currentAnimationId = ""
    $: slideAnimation = slideData?.actions?.animate || {}

    $: if (slideAnimation) initializeAnimation()
    async function initializeAnimation() {
        if (!Object.keys(slideAnimation).length) {
            animationData = {}
            currentAnimationId = ""
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

            if (typeof animationData.newIndex !== "number") return
            animate(animationData.newIndex)
        }
    }

    // values
    $: isKeyOutput = currentOutput.isKeyOutput
    $: backgroundColor = isKeyOutput ? "black" : currentOutput.transparent ? "transparent" : currentSlide?.settings?.color || currentStyle.background || "black"
    $: messageText = $showsCache[slide?.id]?.message?.text || ""
    $: metadataValue = metadata.value?.length && (metadata.display === "always" || (metadata.display?.includes("first") && slide?.index === 0) || (metadata.display?.includes("last") && slide?.index === currentLayout.length - 1))
    $: backgroundData = background || { path: currentStyle?.backgroundImage || "" }
</script>

<Zoomed id={outputId} background={backgroundColor} backgroundDuration={transitions.media?.duration || 800} center {style} {resolution} {mirror} cropping={currentStyle.cropping} bind:ratio>
    <!-- background -->
    {#if layers.includes("background") || currentStyle?.backgroundImage}
        <Background data={backgroundData} {outputId} transition={transitions.media} {currentStyle} {slideFilter} {ratio} {isKeyOutput} animationStyle={animationData.style?.background || ""} mirror={isKeyOutput || mirror} />
    {/if}

    <!-- "underlays" -->
    {#if layers.includes("overlays") && outUnderlays?.length}
        <Overlays {outputId} overlays={clonedOverlays} activeOverlays={outUnderlays} transition={transitions.overlay} {isKeyOutput} {mirror} />
    {/if}

    <!-- slide -->
    {#if slide && layers.includes("slide")}
        <SlideContent
            {outputId}
            outSlide={slide}
            {slideData}
            {currentSlide}
            {currentStyle}
            {animationData}
            {currentLineId}
            {lines}
            {ratio}
            {mirror}
            customTemplate={currentStyle.template}
            transition={transitions.text}
            transitionEnabled={!mirror && transitions.text?.type !== "none" && transitions.text?.duration}
            {isKeyOutput}
        />
    {/if}

    {#if layers.includes("overlays")}
        <!-- message -->
        {#if messageText}
            <Metadata value={messageText.replaceAll("\n", "<br>") || ""} style={metadata.messageStyle || ""} transition={transitions.overlay} {isKeyOutput} />
        {/if}

        <!-- metadata -->
        {#if metadataValue}
            <Metadata value={metadata.value || ""} style={metadata.style || ""} transition={transitions.overlay} {isKeyOutput} />
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
