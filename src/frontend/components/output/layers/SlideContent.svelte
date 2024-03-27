<script lang="ts">
    import type { Slide } from "../../../../types/Show"
    import { currentWindow, templates, textLoaded } from "../../../stores"
    import { clone } from "../../helpers/array"
    import Textbox from "../../slide/Textbox.svelte"
    import OutputTransition from "./OutputTransition.svelte"

    export let outputId: string
    export let outSlide: any

    export let slideData: any
    export let currentSlide: any
    export let currentStyle: any

    export let animationData: any
    export let currentLineId: any
    export let lines: any

    export let ratio: number
    export let mirror: boolean = false
    export let customTemplate: string = ""
    export let transition: any = {}
    export let transitionEnabled: boolean = false
    export let isKeyOutput: boolean = false

    $: duration = transition?.duration || 500

    // WIP text sometimes won't load when changing slides quickly

    // LOAD ONE AT A TIME
    let firstActive: boolean = false
    let slide1: any = null
    let slide2: any = null

    let loading: boolean = false
    let timeout: any = null
    $: if (currentSlide || lines) createSlide()
    function createSlide() {
        let slideRef = JSON.stringify({ currentSlide, outSlide })

        // update existing slide, if same
        let activeRef = firstActive ? slide1?.ref : slide2?.ref
        if (activeRef === slideRef) {
            if (firstActive) {
                slide1.data = clone(currentSlide)
                slide1.lines = clone(lines)
            } else {
                slide2.data = clone(currentSlide)
                slide2.lines = clone(lines)
            }
            return
        }

        if (loading) loading = false

        // prevent svelte bug creating multiple items if creating new while old clears
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(
            () => {
                loading = true
                let loadingFirst = !slide1

                if (!slide1) slide1 = { ref: slideRef, data: clone(currentSlide), lines: clone(lines) }
                else slide2 = { ref: slideRef, data: clone(currentSlide), lines: clone(lines) }

                // wait for scripture auto size
                let autoSize = outSlide?.id === "temp"
                // check output template auto size
                if (customTemplate) {
                    let templateItems = $templates[customTemplate]?.items || []
                    let hasAuto = templateItems.find((a) => a.auto)
                    if (hasAuto) autoSize = true
                }

                // WIP wait for autoSize to finish!
                let timeoutDuration = 10
                if (autoSize) timeoutDuration = 400
                // let font load on initial load
                if ($currentWindow === "output" && !$textLoaded) timeoutDuration = 2000

                // max 2 seconds loading time...
                timeout = setTimeout(() => {
                    if (loading) loaded(loadingFirst)

                    timeout = null
                    textLoaded.set(true)
                }, timeoutDuration)
            },
            duration / 4 + 20
        )
    }

    function loaded(isFirst: boolean) {
        if (!loading) return

        loading = false
        firstActive = isFirst

        // allow firstActive to trigger first
        setTimeout(() => {
            if (isFirst) {
                slide2 = null
            } else {
                slide1 = null
            }
        })
    }

    // don't remove data when clearing
    let slide1Data: Slide
    let slide2Data: Slide
    $: if (slide1) slide1Data = clone(slide1.data)
    $: if (slide2) slide2Data = clone(slide2.data)
</script>

{#if slide1}
    <div class="slide" class:hidden={loading && !firstActive}>
        <!-- WIP crossfade: in:cReceive={{ key: "slide" }} out:cSend={{ key: "slide" }} -->
        <!-- svelte transition bug when changing between pages -->
        <OutputTransition {transition}>
            {#if slide1Data?.items}
                {#each slide1Data.items as item}
                    {#if !item.bindings?.length || item.bindings.includes(outputId)}
                        <Textbox
                            filter={slideData?.filterEnabled?.includes("foreground") ? slideData?.filter : ""}
                            backdropFilter={slideData?.filterEnabled?.includes("foreground") ? slideData?.["backdrop-filter"] : ""}
                            key={isKeyOutput}
                            disableListTransition={mirror}
                            chords={item.chords?.enabled}
                            animationStyle={animationData.style || {}}
                            {item}
                            {ratio}
                            ref={{ showId: outSlide.id, slideId: slide1Data.id, id: slide1Data.id || "", layoutId: outSlide.layout }}
                            linesStart={slide1.lines?.[currentLineId]?.start}
                            linesEnd={slide1.lines?.[currentLineId]?.end}
                            {transitionEnabled}
                            outputStyle={currentStyle}
                            {mirror}
                            slideIndex={outSlide.index}
                        />
                    {/if}
                {/each}
            {/if}
        </OutputTransition>
    </div>
{/if}

{#if slide2}
    <div class="slide" class:hidden={loading && firstActive}>
        <OutputTransition {transition}>
            {#if slide2Data?.items}
                {#each slide2Data.items as item}
                    {#if !item.bindings?.length || item.bindings.includes(outputId)}
                        <Textbox
                            filter={slideData?.filterEnabled?.includes("foreground") ? slideData?.filter : ""}
                            backdropFilter={slideData?.filterEnabled?.includes("foreground") ? slideData?.["backdrop-filter"] : ""}
                            key={isKeyOutput}
                            disableListTransition={mirror}
                            chords={item.chords?.enabled}
                            animationStyle={animationData.style || {}}
                            {item}
                            {ratio}
                            ref={{ showId: outSlide.id, slideId: slide2Data.id, id: slide2Data.id || "", layoutId: outSlide.layout }}
                            linesStart={slide2.lines?.[currentLineId]?.start}
                            linesEnd={slide2.lines?.[currentLineId]?.end}
                            {transitionEnabled}
                            outputStyle={currentStyle}
                            {mirror}
                            slideIndex={outSlide.index}
                        />
                    {/if}
                {/each}
            {/if}
        </OutputTransition>
    </div>
{/if}

<style>
    .hidden {
        opacity: 0;
    }

    .slide {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        transform: translate(-50%, -50%);

        /* used for drawing */
        pointer-events: none;
    }
</style>
