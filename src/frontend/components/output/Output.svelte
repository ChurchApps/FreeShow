<!-- Used in output window, and currently in draw! -->

<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { MAIN } from "../../../types/Channels"
    import { outputs, overlays, showsCache, styles, templates, transitionData } from "../../stores"
    import { destroy, receive, send } from "../../utils/request"
    import { custom } from "../../utils/transitions"
    import Draw from "../draw/Draw.svelte"
    import { clone } from "../helpers/array"
    import { OutputMetadata, decodeExif, defaultLayers, getCurrentStyle, getMetadata, getOutputLines, getOutputTransitions, getResolution, getSlideFilter, joinMetadata, setTemplateStyle } from "../helpers/output"
    import { _show } from "../helpers/shows"
    import Zoomed from "../slide/Zoomed.svelte"
    import MediaOutput from "./MediaOutput.svelte"
    import { updateAnimation, wait } from "./animation"
    import Metadata from "./layers/Metadata.svelte"
    import Overlays from "./layers/Overlays.svelte"
    import SlideContent from "./layers/SlideContent.svelte"

    export let outputId: string = ""
    export let style = ""
    export let ratio: number = 0
    export let mirror: boolean = false

    // output & styling
    $: currentOutput = $outputs[outputId] || {}
    $: currentStyle = getCurrentStyle($styles, currentOutput.style)

    // resolution
    $: resolution = getResolution(currentSlide?.settings?.resolution, { currentOutput, currentStyle })

    // layers
    let layers: string[] = []
    let out: any = {}
    let slide: any = null
    let background: any = null
    // let allOverlays: any = null

    $: if (JSON.stringify(layers) !== JSON.stringify(currentStyle.layers || defaultLayers)) layers = clone(currentStyle.layers || defaultLayers)
    $: if (JSON.stringify(out) !== JSON.stringify(currentOutput?.out || {})) out = clone(currentOutput?.out || {})
    $: if (out.refresh || JSON.stringify(slide) !== JSON.stringify(out.slide || null)) updateOutData("slide")
    $: if (out.refresh || JSON.stringify(background) !== JSON.stringify(out.background || null)) updateOutData("background")
    // $: if (out.refresh || JSON.stringify(allOverlays) !== JSON.stringify(out.overlays || null)) updateOutData("overlays")

    $: if (outputId) updateOutData()
    function updateOutData(type: string = "") {
        if (!type || type === "slide") slide = clone(out.slide || null)
        if (!type || type === "background") background = clone(out.background || null)
        // if (!type || type === "overlays") allOverlays = clone(out.overlays || null)
    }

    // OVERLAYS
    // $: outOverlays = allOverlays?.filter((a) => !a?.placeUnderSlide)
    // $: outUnderlays = allOverlays?.filter((a) => a?.placeUnderSlide)
    // prevent updated when editing or when output changes
    let clonedOverlays = {}
    let outOverlays: any[] = []
    let outUnderlays: any[] = []
    $: if (out.refresh || JSON.stringify(out.overlays?.filter((a) => !a?.placeUnderSlide)) !== JSON.stringify(outOverlays)) updateOverlays()
    $: if (out.refresh || JSON.stringify(out.overlays?.filter((a) => a?.placeUnderSlide)) !== JSON.stringify(outUnderlays)) updateOverlays()
    function updateOverlays() {
        clonedOverlays = clone($overlays)
        if (!out.overlays) return

        outUnderlays = []
        outOverlays = []
        out.overlays.forEach((id) => {
            if (clonedOverlays[id]?.placeUnderSlide) outUnderlays.push(id)
            else outOverlays.push(id)
        })
    }

    // layout & slide data
    $: currentLayout = $showsCache && slide && slide.id !== "temp" ? clone(_show(slide.id).layouts([slide.layout]).ref()?.[0] || []) : []
    $: slideId = currentLayout[slide?.index]?.id || ""
    $: slideData = currentLayout[slide?.index]?.data || null
    $: currentSlide = slide && outputId ? (slide.id === "temp" ? { items: slide.tempItems } : currentLayout ? cloneCurrentSlide() : null) : null
    // TODO: weird svele bug not updating slideId when it's used in "$: currentSlide" (affecting draw slide index)
    function cloneCurrentSlide() {
        return clone(_show(slide.id).slides([slideId]).get()[0] || {})
    }

    // filters
    $: slideFilter = getSlideFilter(slideData)

    // transitions
    $: transitions = getOutputTransitions(slideData, $transitionData, mirror)

    // template items
    $: if (currentSlide && currentOutput?.style && currentStyle) setTemplateItems()
    const setTemplateItems = () => (currentSlide.items = setTemplateStyle(slide, currentStyle.template, currentSlide.items))

    // lines
    let lines: any = {}
    $: currentLineId = slide?.id
    $: lines[currentLineId] = getOutputLines(slide, currentStyle.lines)

    // metadata
    let metadata: OutputMetadata = {}
    $: metadata = getMetadata(metadata, $showsCache[slide?.id], currentStyle, $templates, slide)

    // media metadata
    $: getExifData = metadata.media
    $: if (getExifData && background.path) getExif()
    function getExif() {
        metadata.value = ""
        send(MAIN, ["READ_EXIF"], { id: background.path })
    }
    const receiveExif: any = {
        READ_EXIF: (data: any) => {
            if (!metadata.media || data.id !== background.path) return
            let message = decodeExif(data)
            metadata.value = joinMetadata(message, currentStyle.metadataDivider)
        },
    }
    let listener = uid()
    receive(MAIN, receiveExif, listener)
    onDestroy(() => destroy(MAIN, listener))

    ////////////// WIP ///////////////

    // give time for video to clear
    let tempVideoBG: any = null
    // let getTimeout: any = null
    $: if (background || currentStyle?.backgroundImage) getTempBG()
    else resetTempBG()

    // svelte bug: dont allow path to change while video is transitioning
    let mediaPath: string = ""
    let oldPath: string = ""
    let pathTimeout: any = null
    $: if (background?.path || currentStyle?.backgroundImage) getPath()
    function getPath() {
        clearTimeout(pathTimeout)

        if (oldPath === (background?.path || currentStyle?.backgroundImage)) {
            pathTimeout = setTimeout(() => {
                if (!background?.path && !currentStyle?.backgroundImage) return
                mediaPath = background?.path || currentStyle?.backgroundImage
            }, transitions.media.duration + 100)
            return
        }

        mediaPath = background?.path || currentStyle?.backgroundImage
        oldPath = mediaPath

        pathTimeout = setTimeout(() => {
            oldPath = ""
        }, transitions.media.duration + 100)
    }

    function getTempBG() {
        if (clearing) return

        if (!background || !layers.includes("background")) {
            if (!currentStyle?.backgroundImage) {
                tempVideoBG = null
                return
            }

            tempVideoBG = { path: currentStyle?.backgroundImage }
            return
        }

        tempVideoBG = background
    }

    let clearing: boolean = false
    function resetTempBG() {
        if (tempVideoBG === null) return

        clearing = true
        tempVideoBG = null

        setTimeout(() => {
            clearing = false
            if (background || currentStyle?.backgroundImage) getTempBG()
        }, transitions.media.duration + 100)
    }

    // prevent too fast slide text updates (svelte transition bug)
    // WIP svelte transition bug makes output unresponsive (Uncaught TypeError: Cannot read properties of null (reading 'removeChild'))
    let slideClone: any = {}
    let previousIndex: number = -1
    let slideTimeout: any = null

    $: startSlideTimer(currentSlide)
    function startSlideTimer(_updater) {
        if (slideTimeout !== null || (JSON.stringify(slideClone) === JSON.stringify(_updater) && previousIndex === slide?.index)) return

        slideTimeout = setTimeout(() => {
            slideClone = clone(currentSlide)
            previousIndex = slide?.index ?? -1
            slideTimeout = null
        }, 50)
    }

    ////////////// WIP ///////////////

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
    $: backgroundColor = currentOutput.isKeyOutput ? "black" : currentOutput.transparent ? "transparent" : currentSlide?.settings?.color || currentStyle.background || "black"
    $: isKeyOutput = currentOutput.isKeyOutput
    $: messageText = $showsCache[slide?.id]?.message?.text || ""
    $: metadataValue = metadata.value?.length && (metadata.display === "always" || (metadata.display?.includes("first") && slide.index === 0) || (metadata.display?.includes("last") && slide.index === currentLayout.length - 1))
</script>

<Zoomed id={outputId} background={backgroundColor} backgroundDuration={transitions.media?.duration || 800} center {style} {resolution} {mirror} cropping={currentStyle.cropping} bind:ratio>
    <!-- background -->
    {#if tempVideoBG && (layers.includes("background") || currentStyle?.backgroundImage)}
        <div class="media" style="height: 100%;zoom: {1 / ratio};transition: filter {transitions.media.duration || 800}ms, backdrop-filter {transitions.media.duration || 800}ms;{slideFilter}" class:key={currentOutput.isKeyOutput}>
            <MediaOutput {...tempVideoBG} background={tempVideoBG} path={mediaPath} {outputId} {currentStyle} animationStyle={animationData.style?.background || ""} transition={transitions.media} mirror={currentOutput.isKeyOutput || mirror} />
        </div>
    {/if}

    <!-- "underlays" -->
    {#if outUnderlays?.length}
        {#key out.refresh}
            <Overlays {outputId} overlays={clonedOverlays} activeOverlays={outUnderlays} transition={transitions.overlay} {isKeyOutput} {mirror} />
        {/key}
    {/if}

    <!-- slide -->
    {#if slide && layers.includes("slide")}
        {#key slideClone || lines[currentLineId]?.index}
            <!-- svelte transition bug when changing between pages -->
            {#if transitions.text.type === "none" || transitions.text.duration === 0}
                <span style="pointer-events: none;display: block;">
                    <SlideContent {outputId} outSlide={slide} {slideData} {slideClone} {currentStyle} {animationData} {currentLineId} {lines} {ratio} {mirror} transitionEnabled={!mirror} {isKeyOutput} />
                </span>
            {:else}
                <!-- WIP crossfade: in:cReceive={{ key: "slide" }} out:cSend={{ key: "slide" }} -->
                <span transition:custom={transitions.text} style="pointer-events: none;display: block;">
                    <SlideContent {outputId} outSlide={slide} {slideData} {slideClone} {currentStyle} {animationData} {currentLineId} {lines} {ratio} {mirror} transitionEnabled {isKeyOutput} />
                </span>
            {/if}
        {/key}
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
            {#key out.refresh}
                <Overlays {outputId} overlays={clonedOverlays} activeOverlays={outOverlays} transition={transitions.overlay} {isKeyOutput} {mirror} />
            {/key}
        {/if}
    {/if}

    <!-- draw -->
    {#if currentOutput.active || mirror}
        <Draw />
    {/if}
</Zoomed>

<style>
    .key {
        /* filter: brightness(50); */
        filter: grayscale(1) brightness(1000) contrast(100);
        /* filter: invert(1) grayscale(1) brightness(1000); */
    }
</style>
