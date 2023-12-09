<!-- Used in output window, and currently in draw! -->

<script lang="ts">
    import { uid } from "uid"
    import { READ_EXIF } from "../../../types/Channels"
    import type { Animation } from "../../../types/Output"
    import type { Styles } from "../../../types/Settings"
    import type { Transition } from "../../../types/Show"
    import { activeAnimate, outputs, overlays, showsCache, styles, templates, transitionData } from "../../stores"
    import { custom } from "../../utils/transitions"
    import Draw from "../draw/Draw.svelte"
    import { clone } from "../helpers/array"
    import { getActiveOutputs, getResolution } from "../helpers/output"
    import { _show } from "../helpers/shows"
    import Textbox from "../slide/Textbox.svelte"
    import Zoomed from "../slide/Zoomed.svelte"
    import MediaOutput from "./MediaOutput.svelte"

    export let title: string = ""
    export let mirror: boolean = false
    export let preview: boolean = false

    export let outline: boolean = false
    export let disabled: boolean = false

    // TODO: dont show transition upon no changes
    export let transition: Transition = $transitionData.text
    export let mediaTransition: Transition = $transitionData.media
    export let disableTransitions: boolean = false
    export let style = ""
    export let center: boolean = false
    export let ratio: number = 0

    export let specificOutput: string = ""

    // out data
    const defaultLayers: string[] = ["background", "slide", "overlays"]
    $: outputId = specificOutput || getActiveOutputs($outputs, true, mirror)[0]
    $: currentOutput = $outputs[outputId] || {}

    let currentStyle: Styles = { name: "" }
    $: currentStyle = currentOutput?.style ? $styles[currentOutput?.style] || { name: "" } : { name: "" }

    let layers: any = currentStyle.layers || defaultLayers
    let out: any = currentOutput?.out || {}
    let slide: any = null
    let background: any = null

    $: if (outputId) updateOutData()
    function updateOutData(id: string = "") {
        if (!id || id === "slide") slide = clone(out.slide || null)
        if (!id || id === "background") background = clone(out.background || null)
    }

    $: if (JSON.stringify(layers) !== JSON.stringify(currentStyle.layers || defaultLayers)) layers = clone(currentStyle.layers || defaultLayers)
    $: if (JSON.stringify(out) !== JSON.stringify(currentOutput?.out || {})) out = clone(currentOutput?.out || {})
    $: if (out.refresh || JSON.stringify(slide) !== JSON.stringify(out.slide || null)) updateOutData("slide")
    $: if (out.refresh || JSON.stringify(background) !== JSON.stringify(out.background || null)) updateOutData("background")

    $: slideRef = $showsCache && slide && slide.id !== "temp" ? _show(slide?.id).layouts("active").ref()[0] : null

    // transition
    $: slideData = slideRef?.[slide.index!]?.data || null
    $: slideTextTransition = slideData ? slideData.transition : null
    $: slideMediaTransition = slideData ? slideData.mediaTransition : null
    $: transition = disableTransitions ? { type: "none" } : slideTextTransition ? slideTextTransition : $transitionData.text
    $: mediaTransition = disableTransitions ? { type: "none" } : slideMediaTransition ? slideMediaTransition : $transitionData.media
    $: overlayTransition = disableTransitions ? { type: "none" } : $transitionData.text

    $: currentLayout = slide ? _show(slide.id).layouts([slide.layout]).ref()[0] : []
    $: currentSlide = slide && outputId ? (slide.id === "temp" ? { items: slide.tempItems } : currentLayout ? clone(_show(slide.id).slides([currentLayout[slide.index!].id]).get()[0] || {}) : null) : null

    $: if (currentSlide && currentOutput?.style && currentStyle) setTemplateStyle()
    function setTemplateStyle() {
        // TODO: duplicate of history "template":1107
        let template = $templates[currentStyle.template || ""]?.items || []
        let templateTextItems = template.filter((a) => a.lines)
        let templateOtherItems = template.filter((a) => !a.lines && a.type !== "text")

        // TODO: replace other items with the same type if any

        if (templateTextItems.length || templateOtherItems.length) {
            templateTextItems.forEach((item: any, i: number) => {
                if (!currentSlide.items[i]) return

                currentSlide.items[i].style = item.style || ""
                currentSlide.items[i].align = item.align || ""
                currentSlide.items[i].lines?.forEach((line: any, j: number) => {
                    let templateLine = item.lines?.[j] || item.lines?.[0]
                    line.align = templateLine?.align || ""
                    line.text?.forEach((text: any, k: number) => {
                        text.style = templateLine?.text[k] ? templateLine.text[k].style || "" : templateLine?.text[0]?.style || ""
                    })
                })

                // scrolling, bindings
                currentSlide.items[i].specialStyle = item.specialStyle || {}
            })

            // add other items
            currentSlide.items = [...templateOtherItems, ...currentSlide.items]
        } else {
            // reset style
            currentSlide = slide && outputId ? (slide.id === "temp" ? { items: slide.tempItems } : currentLayout ? clone(_show(slide.id).slides([currentLayout[slide.index!].id]).get()[0] || {}) : null) : null
        }
    }

    $: resolution = getResolution(currentSlide?.settings?.resolution, { currentOutput, currentStyle })

    // lines
    let linesStart: any = {}
    let linesEnd: any = {}
    $: amountOfLinesToShow = currentStyle.lines !== undefined ? Number(currentStyle.lines) : 0
    $: linesIndex = amountOfLinesToShow && slide && slide.id !== "temp" ? slide.line || 0 : null
    $: currentLineId = slide?.id
    $: linesStart[currentLineId] = linesIndex !== null && currentLineId ? amountOfLinesToShow! * linesIndex : null
    $: linesEnd[currentLineId] = linesStart[currentLineId] !== undefined ? linesStart[currentLineId] + amountOfLinesToShow! : null

    // metadata
    $: autoMediaMeta = $showsCache[slide?.id]?.metadata?.autoMedia
    let metaMessage: { [key: string]: any } = {}
    $: metaMessage = autoMediaMeta ? {} : $showsCache[slide?.id]?.meta
    $: overrideOutput = $showsCache[slide?.id]?.metadata?.override
    $: metadataTemplate = overrideOutput ? $showsCache[slide?.id]?.metadata?.template : currentStyle.metadataTemplate || "metadata"
    $: metadataDisplay = overrideOutput ? $showsCache[slide?.id]?.metadata?.display : currentStyle.displayMetadata
    const defaultMetadataStyle = "top: 910px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;font-size: 30px;text-shadow: 2px 2px 4px rgb(0 0 0 / 80%);"
    let metadataStyle = defaultMetadataStyle
    $: metadataStyle = getTemplateStyle(metadataTemplate!, $templates) || defaultMetadataStyle

    $: messageTemplate = overrideOutput ? $showsCache[slide?.id]?.message?.template : currentStyle.messageTemplate || "message"
    const defaultMessageStyle = "top: 50px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;font-size: 50px;text-shadow: 2px 2px 4px rgb(0 0 0 / 80%);"
    let messageStyle = defaultMessageStyle
    $: messageStyle = getTemplateStyle(messageTemplate!, $templates) || defaultMessageStyle

    $: if (autoMediaMeta) window.api.send(READ_EXIF, { id: background.path })
    // https://www.npmjs.com/package/exif
    window.api.receive(READ_EXIF, (data: any) => {
        if (!autoMediaMeta || !data.exif) return
        // console.log(data)

        metaMessage = {}
        if (data.exif.exif.DateTimeOriginal) metaMessage.taken = "Date: " + data.exif.exif.DateTimeOriginal
        if (data.exif.exif.ApertureValue) metaMessage.aperture = "Aperture: " + data.exif.exif.ApertureValue
        if (data.exif.exif.BrightnessValue) metaMessage.brightness = "Brightness: " + data.exif.exif.BrightnessValue
        if (data.exif.exif.ExposureTime) metaMessage.exposure_time = "Exposure Time: " + data.exif.exif.ExposureTime.toFixed(4)
        if (data.exif.exif.FNumber) metaMessage.fnumber = "F Number: " + data.exif.exif.FNumber
        if (data.exif.exif.Flash) metaMessage.flash = "Flash: " + data.exif.exif.Flash
        if (data.exif.exif.FocalLength) metaMessage.focallength = "Focal Length: " + data.exif.exif.FocalLength
        if (data.exif.exif.ISO) metaMessage.iso = "ISO: " + data.exif.exif.ISO
        if (data.exif.exif.InteropOffset) metaMessage.interopoffset = "Interop Offset: " + data.exif.exif.InteropOffset
        if (data.exif.exif.LightSource) metaMessage.lightsource = "Light Source: " + data.exif.exif.LightSource
        if (data.exif.exif.ShutterSpeedValue) metaMessage.shutterspeed = "Shutter Speed: " + data.exif.exif.ShutterSpeedValue

        if (data.exif.exif.LensMake) metaMessage.lens = "Lens: " + data.exif.exif.LensMake
        if (data.exif.exif.LensModel) metaMessage.lensmodel = "Lens Model: " + data.exif.exif.LensModel

        if (data.exif.gps.GPSLatitude) metaMessage.gps = "Position: " + data.exif.gps.GPSLatitudeRef + data.exif.gps.GPSLatitude[0]
        if (data.exif.gps.GPSLongitude) metaMessage.gps += " " + data.exif.gps.GPSLongitudeRef + data.exif.gps.GPSLongitude[0]
        if (data.exif.gps.GPSAltitude) metaMessage.gps += " " + data.exif.gps.GPSAltitude

        if (data.exif.image.Make) metaMessage.device = "Device: " + data.exif.image.Make
        if (data.exif.image.Model) metaMessage.device += " " + data.exif.image.Model
        if (data.exif.image.Software) metaMessage.software = "Software: " + data.exif.image.Software
    })

    function getTemplateStyle(templateId: string, updater: any) {
        if (!templateId) return
        let template = updater[templateId]
        if (!template) return

        let style = template.items[0]?.style || ""
        let textStyle = template.items[0]?.lines?.[0]?.text?.[0]?.style || ""

        return style + textStyle
    }

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
            }, mediaTransition.duration + 100)
            return
        }

        mediaPath = background?.path || currentStyle?.backgroundImage
        oldPath = mediaPath

        pathTimeout = setTimeout(() => {
            oldPath = ""
        }, mediaTransition.duration + 100)
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
        }, mediaTransition.duration + 100)
    }

    // prevent too fast slide text updates (svelte transition bug)
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

    $: slideFilter = ""
    $: if (!slideData?.filterEnabled || slideData?.filterEnabled?.includes("background")) getSlideFilter()
    else slideFilter = ""
    function getSlideFilter() {
        slideFilter = ""
        if (!slideData) return

        if (slideData.filter) slideFilter += "filter: " + slideData.filter + ";"
        if (slideData["backdrop-filter"]) slideFilter += "backdrop-filter: " + slideData["backdrop-filter"] + ";"
    }

    // OVERLAYS
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

    // ANIMATE
    let animation: Animation = { actions: [] }
    let animationId = ""
    let animationStyle: any = {}
    let animationStyles: any = {}
    let animationTransitions: any = {}
    $: if (slide || slideData) {
        animationId = uid()
        animation = slideData?.actions?.animate || { actions: [] }

        let duration = 50
        if (transition.type !== "none" && transition.duration) duration = Math.max(duration, transition.duration / 2)

        setTimeout(resetAnimation, duration)
    }
    function resetAnimation() {
        animationStyle = {}
        animationStyles = {}
        animationTransitions = {}

        if (animation?.actions?.length) setTimeout(startAnimation)
    }

    function startAnimation() {
        let currentAnimationId = animationId
        console.log(animation.actions)
        animate(0)

        async function animate(currentIndex: number) {
            // give time for initial element & prevent infinite loops
            if (currentIndex === 0) await animations.wait({ duration: 0.1 })

            let currentAnimation = animation.actions[currentIndex]
            if (!currentAnimation || currentAnimationId !== animationId || !slide) {
                activeAnimate.set({ slide: -1, index: -1 })
                return
            }
            activeAnimate.set({ slide: slide.index, index: currentIndex })

            await animations[currentAnimation.type](currentAnimation as any)

            let newIndex = currentIndex + 1
            if (!animation.actions[newIndex] && animation.repeat) newIndex = 0
            animate(newIndex)
        }
    }

    const animations = {
        wait: async ({ duration }) => {
            return new Promise((resolve) => {
                setTimeout(
                    () => {
                        resolve("ended")
                    },
                    Number(duration) * 1000
                )
            })
        },
        set: ({ id, key, value, extension }) => {
            animations.change({ id, key, value, extension, duration: 0 })
        },
        change: ({ id, key, value, extension, duration }) => {
            value = value || 0
            if (extension) value += extension

            let initialValue = ""
            if (id === "background") {
                if (key === "filter") {
                    // filter
                } else {
                    key = "transform"
                    initialValue = "transform: scale(1.3);"
                    let randomNumber = Math.max(1, Math.random() * 1.3 + 0.6)
                    let randomTranslate1 = randomNumBetween(0, 50)
                    let randomTranslate2 = randomNumBetween(0, 50)
                    value = `scale(${randomNumber}) translate(${randomTranslate1}px, ${randomTranslate2}px);`
                }
            }

            if (!id) id = "text"

            let variable = ""
            if (key === "font-size") variable = "--"

            if (key === "rotate") {
                key = "transform"
                value = `rotate(${value});`
            }

            // previous transitions
            animationTransitions[id] = animationTransitions[id]?.filter((a) => !a.includes(key)) || []
            animationTransitions[id].push(`${key} ${duration}s`)

            let style = `${variable}${key}: ${value};`
            animationStyles[id] = animationStyles[id]?.filter((a) => !a.includes(key)) || []

            let easing = ""
            if (animation.easing) easing = `transition-timing-function: ${animation.easing};`

            // set transitions first so it can animate
            animationStyle[id] = animationStyles[id].join("") + `${initialValue}${id === "text" ? "--" : ""}transition: ${animationTransitions[id].join(", ")};${easing}`
            setTimeout(() => {
                if (!animationStyles[id]) return
                animationStyles[id].push(style)
                animationStyle[id] = animationStyles[id].join("") + `${id === "text" ? "--" : ""}transition: ${animationTransitions[id].join(", ")};${easing}`
            }, 40)

            console.log(animationStyle)
        },
    }
    function randomNumBetween(min = 0, max) {
        return Math.floor(Math.random() * (max - min + 1) + min)
    }
</script>

<Zoomed
    id={outputId}
    background={currentOutput.isKeyOutput ? "black" : currentOutput.transparent ? "transparent" : currentSlide?.settings?.color || currentStyle.background || "black"}
    backgroundDuration={mediaTransition?.duration || 800}
    {center}
    {style}
    {resolution}
    {mirror}
    outline={outline ? currentOutput.color : ""}
    {disabled}
    cropping={currentStyle.cropping}
    bind:ratio
>
    {#if tempVideoBG && (layers.includes("background") || currentStyle?.backgroundImage)}
        <div class="media" style="height: 100%;zoom: {1 / ratio};transition: filter {mediaTransition.duration || 800}ms, backdrop-filter {mediaTransition.duration || 800}ms;{slideFilter}" class:key={currentOutput.isKeyOutput}>
            <MediaOutput {...tempVideoBG} background={tempVideoBG} path={mediaPath} {outputId} {currentStyle} animationStyle={animationStyle.background || ""} transition={mediaTransition} bind:title mirror={currentOutput.isKeyOutput || mirror} />
        </div>
    {/if}

    <!-- "underlays" -->
    {#if outUnderlays?.length}
        {#key out.refresh}
            {#each outUnderlays as id}
                {#if clonedOverlays[id]}
                    {#if overlayTransition.type === "none"}
                        <div class:key={currentOutput.isKeyOutput}>
                            <div>
                                {#each clonedOverlays[id].items || [] as item}
                                    {#if !item.bindings?.length || item.bindings.includes(outputId)}
                                        <Textbox {item} ref={{ type: "overlay", id }} {preview} {mirror} />
                                    {/if}
                                {/each}
                            </div>
                        </div>
                    {:else}
                        <div transition:custom={overlayTransition} class:key={currentOutput.isKeyOutput}>
                            <div>
                                {#each clonedOverlays[id].items || [] as item}
                                    {#if !item.bindings?.length || item.bindings.includes(outputId)}
                                        <Textbox {item} ref={{ type: "overlay", id }} {preview} {mirror} transitionEnabled />
                                    {/if}
                                {/each}
                            </div>
                        </div>
                    {/if}
                {/if}
            {/each}
        {/key}
    {/if}

    {#if slide && layers.includes("slide")}
        {#key slideClone || linesIndex}
            <!-- WIP svelte transition bug makes output unresponsive (Uncaught TypeError: Cannot read properties of null (reading 'removeChild')) -->
            <!-- svelte transition bug when changing between pages -->
            {#if transition.type === "none"}
                <span style="pointer-events: none;display: block;">
                    {#if slideClone?.items}
                        {#each slideClone.items as item}
                            {#if !item.bindings?.length || item.bindings.includes(outputId)}
                                <Textbox
                                    filter={slideData?.filterEnabled?.includes("foreground") ? slideData?.filter : ""}
                                    backdropFilter={slideData?.filterEnabled?.includes("foreground") ? slideData?.["backdrop-filter"] : ""}
                                    key={currentOutput.isKeyOutput}
                                    disableListTransition={disableTransitions}
                                    chords={item.chords?.enabled}
                                    {animationStyle}
                                    {preview}
                                    {item}
                                    {ratio}
                                    ref={{ showId: slide.id, slideId: slideClone.id, id: slideClone.id }}
                                    linesStart={linesStart[currentLineId]}
                                    linesEnd={linesEnd[currentLineId]}
                                    transitionEnabled={!mirror}
                                    outputStyle={currentStyle}
                                />
                            {/if}
                        {/each}
                    {/if}
                </span>
            {:else}
                <!-- WIP crossfade: in:cReceive={{ key: "slide" }} out:cSend={{ key: "slide" }} -->
                <span transition:custom={transition} style="pointer-events: none;display: block;">
                    {#if slideClone?.items}
                        {#each slideClone.items as item}
                            {#if !item.bindings?.length || item.bindings.includes(outputId)}
                                <!-- <span class="itemTransition" style="pointer-events: none;position: absolute;{item.style}" transition:custom={item.actions?.transition || {}}> -->
                                <Textbox
                                    filter={slideData?.filterEnabled?.includes("foreground") ? slideData?.filter : ""}
                                    backdropFilter={slideData?.filterEnabled?.includes("foreground") ? slideData?.["backdrop-filter"] : ""}
                                    key={currentOutput.isKeyOutput}
                                    disableListTransition={disableTransitions}
                                    chords={item.chords?.enabled}
                                    {animationStyle}
                                    {preview}
                                    {item}
                                    {ratio}
                                    ref={{ showId: slide.id, slideId: slideClone.id, id: slideClone.id }}
                                    linesStart={linesStart[currentLineId]}
                                    linesEnd={linesEnd[currentLineId]}
                                    transitionEnabled
                                    outputStyle={currentStyle}
                                />
                                <!-- </span> -->
                            {/if}
                        {/each}
                    {/if}
                </span>
            {/if}
        {/key}
    {/if}

    {#if layers.includes("overlays")}
        <!-- message -->
        {#if $showsCache[slide?.id]?.message?.text}
            {#if overlayTransition.type === "none"}
                <div class="meta" style={messageStyle} class:key={currentOutput.isKeyOutput}>
                    {@html $showsCache[slide?.id]?.message?.text.replaceAll("\n", "<br>")}
                </div>
            {:else}
                <div class="meta" transition:custom={overlayTransition} style={messageStyle} class:key={currentOutput.isKeyOutput}>
                    {@html $showsCache[slide?.id]?.message?.text.replaceAll("\n", "<br>")}
                </div>
            {/if}
        {/if}
        <!-- metadata -->
        {#if Object.keys($showsCache[slide?.id]?.meta || {}).length && (metadataDisplay === "always" || (metadataDisplay?.includes("first") && slide.index === 0) || (metadataDisplay?.includes("last") && slide.index === currentLayout.length - 1))}
            {#if overlayTransition.type === "none"}
                <div class="meta" style={metadataStyle} class:key={currentOutput.isKeyOutput}>
                    {@html Object.values(metaMessage)
                        .filter((a) => a.length)
                        .join(currentStyle.metadataDivider || "; ")}
                </div>
            {:else}
                <div class="meta" transition:custom={overlayTransition} style={metadataStyle} class:key={currentOutput.isKeyOutput}>
                    {@html Object.values(metaMessage)
                        .filter((a) => a.length)
                        .join(currentStyle.metadataDivider || "; ")}
                </div>
            {/if}
        {/if}

        <!-- overlays -->
        {#if outOverlays?.length}
            {#key out.refresh}
                {#each outOverlays as id}
                    {#if clonedOverlays[id]}
                        {#if overlayTransition.type === "none"}
                            <div class:key={currentOutput.isKeyOutput}>
                                <div>
                                    {#each clonedOverlays[id].items || [] as item}
                                        {#if !item.bindings?.length || item.bindings.includes(outputId)}
                                            <Textbox {item} ref={{ type: "overlay", id }} {preview} {mirror} />
                                        {/if}
                                    {/each}
                                </div>
                            </div>
                        {:else}
                            <div transition:custom={overlayTransition} class:key={currentOutput.isKeyOutput}>
                                <div>
                                    {#each clonedOverlays[id].items || [] as item}
                                        {#if !item.bindings?.length || item.bindings.includes(outputId)}
                                            <Textbox {item} ref={{ type: "overlay", id }} {preview} {mirror} transitionEnabled />
                                        {/if}
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    {/if}
                {/each}
            {/key}
        {/if}
    {/if}

    {#if mirror || currentOutput.active}
        <Draw />
    {/if}
</Zoomed>

<style>
    .meta {
        position: absolute;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .key {
        /* filter: brightness(50); */
        filter: grayscale(1) brightness(1000) contrast(100);
        /* filter: invert(1) grayscale(1) brightness(1000); */
    }
</style>
