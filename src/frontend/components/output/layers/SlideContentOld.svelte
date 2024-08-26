<script lang="ts">
    import type { Slide } from "../../../../types/Show"
    import { templates, textLoaded } from "../../../stores"
    import { getSlideText } from "../../edit/scripts/textStyle"
    import { clone } from "../../helpers/array"
    import Textbox from "../../slide/Textbox.svelte"
    import OutputTransition from "../transitions/OutputTransition.svelte"

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
    export let preview: boolean = false
    export let customTemplate: string = ""
    export let transition: any = {}
    export let transitionEnabled: boolean = false
    export let isKeyOutput: boolean = false

    // $: duration = transition?.duration || 500

    // LOAD ONE AT A TIME
    let firstActive: boolean = false
    let slide1: any = null
    let slide2: any = null

    let loading: boolean = false
    let timeout: any = null
    $: if (currentSlide || lines) createSlide()
    let isAutoSize: boolean = false
    function createSlide() {
        // prevent svelte bug creating multiple items if creating new while old clears
        if (timeout) clearTimeout(timeout)

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

        timeout = setTimeout(
            () => {
                loading = true
                // always use first if no transition
                let loadingFirst = !slide1 // || !transitionActive

                if (loadingFirst) slide1 = { ref: slideRef, data: clone(currentSlide), lines: clone(lines) }
                else slide2 = { ref: slideRef, data: clone(currentSlide), lines: clone(lines) }

                // wait for scripture auto size
                let autoSize = outSlide?.id === "temp"
                // check output template auto size
                if (!autoSize && customTemplate) {
                    let templateItems = $templates[customTemplate]?.items || []
                    let hasAuto = templateItems.find((a) => a.auto)
                    if (hasAuto) autoSize = true
                }

                // WIP transition.duration === 0 && autoSize will remove text while loading...
                // WIP wait for autoSize to finish!
                let timeoutDuration = 10
                if (autoSize) timeoutDuration = 400
                isAutoSize = autoSize

                // max 2 seconds loading time...
                timeout = setTimeout(() => {
                    if (loading) loaded(loadingFirst)

                    textLoaded.set(true) // not in use
                }, timeoutDuration)
            },
            10 // add a buffer to reduce flickering on rapid changes (duration / 4)
        )
    }

    function loaded(isFirst: boolean) {
        if (!loading) return

        // check difference
        let text1 = getSlideText(slide1?.data)
        let text2 = getSlideText(slide2?.data)

        // start showing next before hiding current (to reduce "black" fade if transitioning to same element)
        // this might not show very clear if transitioning between two texts that are the same! - That should show a little indication of change...
        if (text1 === text2) {
            loading = false
            firstActive = isFirst
            timeout = setTimeout(() => {
                hideCurrent()
                timeout = null
            }, customOpacityDuration * 0.7)
        } else {
            // if text is different, start hiding current before loading next, this looks better
            hideCurrent()
            timeout = setTimeout(() => {
                loading = false
                firstActive = isFirst
                timeout = null
            }, customOpacityDuration * 0.5)
        }

        function hideCurrent() {
            if (isFirst) {
                slide2 = null
            } else {
                slide1 = null
            }
        }
    }

    // don't remove data when clearing
    let slide1Data: Slide
    let slide2Data: Slide
    $: if (slide1) slide1Data = clone(slide1.data)
    $: if (slide2) slide2Data = clone(slide2.data)

    // this can be used to not wait for auto size if transition is set to 0
    // $: transitionActive = transition.duration !== 0 && transition.type !== "none"
    // $: isFirstHidden = transitionActive && loading && !firstActive
    // $: isSecondHidden = !transitionActive || (loading && firstActive)
    $: isFirstHidden = loading && !firstActive
    $: isSecondHidden = loading && firstActive

    $: hasChanged = !!(transition.duration === 0 && !isAutoSize && slide1)

    // WIP text should fade, but items that are the same between slides should not & items with custom transitions should not use the global slide transition

    // WIP transition should be per item, so the item transition will override the global transition!!

    // custom item transition
    // $: itemTransitionEnabled = transitionEnabled && item.actions?.transition && item.actions.transition.type !== "none" && item.actions.transition.duration > 0
    // $: itemTransition = transition ? clone(item.actions.transition) : {}
    // $: if (itemTransition.type === "none") itemTransition = { duration: 0, type: "fade", easing: "linear" }

    $: customOpacityDuration = transition?.type === "none" || !transition?.duration ? 0 : transition.duration

    // WIP fix text clipping in when it has not loaded?
    // $: console.log(slide1, slide2)
    // $: console.log(isFirstHidden, isSecondHidden)
</script>

{#if slide1}
    <div class="slide" class:hidden={isFirstHidden} style="--duration: {(customOpacityDuration ?? 500) * 0.8}ms">
        <!-- WIP crossfade: in:cReceive={{ key: "slide" }} out:cSend={{ key: "slide" }} -->
        <!-- svelte transition bug when changing between pages -->
        <OutputTransition {transition}>
            {#key hasChanged}
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
                                {preview}
                                slideIndex={outSlide.index}
                            />
                        {/if}
                    {/each}
                {/if}
            {/key}
        </OutputTransition>
    </div>
{/if}

{#if slide2}
    <div class="slide" class:hidden={isSecondHidden} style="--duration: {(customOpacityDuration ?? 500) * 0.8}ms">
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
    .slide {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        transform: translate(-50%, -50%);

        /* used for drawing */
        pointer-events: none;

        /* hidden */
        --duration: 400ms; /* 500 * 0.8 */
        transition: opacity var(--duration);
        opacity: 1;
    }
    .slide.hidden {
        transition: none;
        opacity: 0;
    }
</style>
