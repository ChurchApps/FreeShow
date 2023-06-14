<script lang="ts">
    import MediaOutput from "./MediaOutput.svelte"
    import Textbox from "./Textbox.svelte"
    import Zoomed from "./Zoomed.svelte"

    export let show: any
    export let slide: any
    export let style: string = ""
    export let background: any
    $: console.log("SLIDE", slide)
    $: console.log("BACKGROUND", background)

    // export let video: any = null
    // export let videoData: any = { duration: 0, paused: true, muted: false, loop: false }
    // export let videoTime: number = 0
    // export let title: string = ""

    // export let transition: Transition = $transitionData.text
    // export let mediaTransition: Transition = $transitionData.media
    // export let disableTransitions: boolean = false
    // export let style = ""
    // export let center: boolean = false
    // export let ratio: number = 0

    // out data
    // const defaultLayers: string[] = ["background", "slide", "overlays"]
    // $: outputId = getActiveOutputs($outputs, true, mirror)[0]
    // $: currentOutput = $outputs[outputId] || {}

    // let currentStyle: Styles = { name: "" }
    // $: currentStyle = currentOutput?.style ? $styles[currentOutput?.style] : { name: "" }
    let currentStyle = {
        background: "black",
    }

    // let layers: any = currentStyle.layers || defaultLayers
    // let out: any = currentOutput?.out || {}
    // let slide: any = out.slide || null
    // let background: any = out.background || null

    // $: if (JSON.stringify(layers) !== JSON.stringify(currentStyle.layers || defaultLayers)) layers = JSON.parse(JSON.stringify(currentStyle.layers || defaultLayers))
    // $: if (JSON.stringify(out) !== JSON.stringify(currentOutput?.out || {})) out = JSON.parse(JSON.stringify(currentOutput?.out || {}))
    // $: if (out.refresh || outputId || JSON.stringify(slide) !== JSON.stringify(out.slide || null)) slide = JSON.parse(JSON.stringify(out.slide || null))
    // $: if (out.refresh || outputId || JSON.stringify(background) !== JSON.stringify(out.background || null)) background = JSON.parse(JSON.stringify(out.background || null))

    // transition
    // $: slideData = $showsCache && slide && slide.id !== "temp" ? _show(slide.id).layouts("active").ref()[0]?.[slide.index!]?.data : null
    // $: slideTextTransition = slideData ? slideData.transition : null
    // $: slideMediaTransition = slideData ? slideData.mediaTransition : null
    // $: transition = disableTransitions ? { type: "none" } : slideTextTransition ? slideTextTransition : $transitionData.text
    // $: mediaTransition = disableTransitions ? { type: "none" } : slideMediaTransition ? slideMediaTransition : $transitionData.media
    // $: overlayTransition = disableTransitions ? { type: "none" } : $transitionData.text

    // $: currentLayout = slide ? _show(slide.id).layouts([slide.layout]).ref()[0] : []
    // $: currentSlide = slide && outputId ? (slide.id === "temp" ? { items: slide.tempItems } : currentLayout ? JSON.parse(JSON.stringify(_show(slide.id).slides([currentLayout[slide.index!].id]).get()[0] || {})) : null) : null
    $: currentSlide = slide

    // $: if (currentSlide && currentOutput?.style && currentStyle) setTemplateStyle()
    // function setTemplateStyle() {
    //     // TODO: duplicate of history "template":1107
    //     let template = $templates[currentStyle.template || ""]
    //     if (template?.items?.length) {
    //         template.items.forEach((item: any, i: number) => {
    //             if (currentSlide.items[i]) {
    //                 currentSlide.items[i].style = item.style || ""
    //                 currentSlide.items[i].align = item.align || ""
    //                 currentSlide.items[i].lines?.forEach((line: any, j: number) => {
    //                     let templateLine = item.lines?.[j] || item.lines?.[0]
    //                     line.align = templateLine?.align || ""
    //                     line.text.forEach((text: any, k: number) => {
    //                         text.style = templateLine?.text[k] ? templateLine.text[k].style || "" : templateLine?.text[0]?.style || ""
    //                     })
    //                 })
    //             }
    //         })
    //     } else {
    //         // reset style
    //         currentSlide = slide && outputId ? (slide.id === "temp" ? { items: slide.tempItems } : currentLayout ? JSON.parse(JSON.stringify(_show(slide.id).slides([currentLayout[slide.index!].id]).get()[0] || {})) : null) : null
    //     }
    // }

    // $: resolution = currentSlide?.settings?.resolution || show.settings.resolution || {width: 1920, height: 1080}

    // lines
    // let linesStart: null | number = null
    // let linesEnd: null | number = null
    // $: amountOfLinesToShow = currentStyle.lines !== undefined ? Number(currentStyle.lines) : 0
    // $: linesIndex = amountOfLinesToShow && slide ? slide.line || 0 : null
    // $: linesStart = linesIndex !== null ? amountOfLinesToShow! * linesIndex : null
    // $: linesEnd = linesStart !== null ? linesStart + amountOfLinesToShow! : null

    // metadata
    // $: autoMediaMeta = $showsCache[slide?.id]?.metadata?.autoMedia
    // let metaMessage: { [key: string]: any } = {}
    // $: metaMessage = autoMediaMeta ? {} : $showsCache[slide?.id]?.meta
    // $: overrideOutput = $showsCache[slide?.id]?.metadata?.override
    // $: metadataTemplate = overrideOutput ? $showsCache[slide?.id]?.metadata?.template : currentStyle.metadataTemplate || "metadata"
    // $: metadataDisplay = overrideOutput ? $showsCache[slide?.id]?.metadata?.display : currentStyle.displayMetadata
    // const defaultMetadataStyle = "top: 910px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;font-size: 30px;text-shadow: 2px 2px 4px rgb(0 0 0 / 80%);"
    // let metadataStyle = defaultMetadataStyle
    // $: metadataStyle = getTemplateStyle(metadataTemplate!, $templates) || defaultMetadataStyle

    // $: messageTemplate = overrideOutput ? $showsCache[slide?.id]?.message?.template : currentStyle.messageTemplate || "message"
    // const defaultMessageStyle = "top: 50px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;font-size: 50px;text-shadow: 2px 2px 4px rgb(0 0 0 / 80%);"
    // let messageStyle = defaultMessageStyle
    // $: messageStyle = getTemplateStyle(messageTemplate!, $templates) || defaultMessageStyle

    // $: slideFilter = ""
    // $: if (!slideData?.filterEnabled || slideData?.filterEnabled?.includes("background")) getSlideFilter()
    // function getSlideFilter() {
    //     if (!slideData) return
    //     slideFilter = ""
    //     if (slideData.filter) slideFilter += "filter: " + slideData.filter + ";"
    //     if (slideData["backdrop-filter"]) slideFilter += "backdrop-filter: " + slideData["backdrop-filter"] + ";"
    // }

    let ratio = 1
</script>

<Zoomed {style} background={currentSlide?.settings?.color || currentStyle.background || "black"} {show} dynamicResolution={false} bind:ratio>
    <!-- layers.includes("background") -->
    {#if background?.path}
        <div class="media" style="height: 100%;zoom: {1 / ratio};">
            <MediaOutput {background} />
        </div>
    {/if}

    <!-- layers.includes("slide") -->
    {#if slide}
        {#key currentSlide}
            <span style="pointer-events: none;display: block;">
                {#if currentSlide?.items}
                    {#each currentSlide?.items as item}
                        <!-- filter={slideData?.filterEnabled?.includes("foreground") ? slideData?.filter : ""}
                    backdropFilter={slideData?.filterEnabled?.includes("foreground") ? slideData?.["backdrop-filter"] : ""}
                    {ratio}
                    ref={{ showId: slide.id, slideId: currentSlide.id, id: currentSlide.id }} -->
                        <Textbox {item} autoStage={false} {ratio} />
                    {/each}
                {/if}
            </span>
        {/key}
    {/if}

    <!-- {#if layers.includes("overlays")}
        <!-- message -- >
        {#if $showsCache[slide?.id]?.message?.text}
            <div class="meta" transition:custom={transition} style={messageStyle} class:key={currentOutput.isKeyOutput}>
                {$showsCache[slide?.id]?.message?.text}
            </div>
        {/if}
        <!-- metadata -- >
        {#if Object.keys($showsCache[slide?.id]?.meta || {}).length && (metadataDisplay === "always" || (metadataDisplay?.includes("first") && slide.index === 0) || (metadataDisplay?.includes("last") && slide.index === currentLayout.length - 1))}
            <div class="meta" transition:custom={transition} style={metadataStyle} class:key={currentOutput.isKeyOutput}>
                {Object.values(metaMessage)
                    .filter((a) => a.length)
                    .join("; ")}
            </div>
        {/if}
        <!-- overlays -- >
        {#if out.overlays?.length}
            {#each out.overlays as id}
                {#if $overlays[id]}
                    <div transition:custom={overlayTransition} class:key={currentOutput.isKeyOutput}>
                        <div>
                            {#each $overlays[id].items as item}
                                <Textbox {item} ref={{ type: "overlay", id }} />
                            {/each}
                        </div>
                    </div>
                {/if}
            {/each}
        {/if}
    {/if} -->
</Zoomed>

<!-- <style>
    .meta {
        position: absolute;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .key {
        filter: grayscale(1) brightness(1000) contrast(100);
    }
</style> -->
