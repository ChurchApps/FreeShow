<script lang="ts">
    import { uid } from "uid"
    import type { Item, Transition } from "../../../../types/Show"
    import { currentWindow, scriptureSettings, templates } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { getStyleTemplate, slideHasAutoSizeItem } from "../../helpers/output"
    import OutputTransition from "./OutputTransition.svelte"
    // import { onMount } from "svelte"

    export let globalTransition: Transition
    export let transitionEnabled = false
    export let transitioningBetween = false
    export let preview = false
    export let item: Item
    export let currentSlide: any = {}
    export let outSlide: any = {}
    export let lines: any[] = []
    export let currentStyle: any = {}

    let currentlyTransitioning: { [key: string]: any } = {}

    $: if (item !== undefined || lines) startTransition()

    // WIP item wait out time will not clear other items without wait time if between transition
    // WIP slide direction from top to bottom is a bit buggy
    // WIP image is flashing a bit in scripture transition none

    function startTransition() {
        let itemTransition = item.actions?.transition ? clone(item.actions.transition) : null
        if (itemTransition?.type === "none") itemTransition.duration = 0

        // SET TRANSITION
        // globalTransition also has style & slide transition
        // priority: item > slide > style > global
        let transition = itemTransition || globalTransition
        if (transition?.type === "none") transition.duration = 0

        let inTransition = clone(transition.in || transition)
        let outTransition = clone(transition.out || transition)
        let transitionBetween = clone(transition.between || transition)
        if (transitioningBetween) inTransition = clone(transitionBetween)

        let inDelay = 0
        let outDelay = 0

        // ITEM IN/OUT DELAY
        let showDuration = $currentWindow === "output" || preview ? item?.actions?.showTimer || 0 : 0
        inDelay = showDuration ? showDuration * 1000 : 0
        let hideDuration = $currentWindow === "output" || preview ? item?.actions?.hideTimer || 0 : 0
        outDelay = hideDuration ? hideDuration * 1000 : 0

        // EXTRA DELAY

        // auto size delay
        if (!outDelay) {
            let customTemplate = getStyleTemplate(outSlide, currentStyle)
            if (!Object.keys(customTemplate).length && outSlide?.id === "temp") customTemplate = $templates[$scriptureSettings.template] || {}

            // only keep the legacy autosize delay when nothing has pre-populated a font size yet
            const templateNeedsAutoSize = Object.keys(customTemplate).length ? slideHasAutoSizeItem(customTemplate) : false
            const itemNeedsAutoSize = item.auto && !item.autoFontSize

            if (templateNeedsAutoSize || itemNeedsAutoSize) {
                outDelay = 500
                if (!inDelay) inDelay = outDelay * 0.98
            }
        }

        // add some time in case an identical item is "fading" in
        if (!outDelay && itemTransition?.duration === 0 && item.type === "media") outDelay = 250
        // the previous fallback kept the old item visible a moment longer to avoid a black flash,
        // but the autosize precompute path already keeps the new content ready, so we let the
        // zero-duration case swap immediately to prevent overlapping text.
        // WIP having outDelay on just 1 item will cause all other items to not clear until that is finished!

        // SET DELAY

        inTransition.delay = inDelay
        outTransition.delay = outDelay
        transitionBetween.delay = outDelay

        // delay won't work if no transition
        if (inDelay && (inTransition.type === "none" || inTransition?.duration === 0)) inTransition = { ...inTransition, type: "fade", duration: 1 }
        if (outDelay && (outTransition.type === "none" || outTransition?.duration === 0)) outTransition = { ...outTransition, type: "fade", duration: 1 }

        // console.log(inTransition, outTransition)

        // SET

        let stateId = uid(5)
        let state = {
            item: clone(item),
            lines: clone(lines),
            outSlide: clone(outSlide),
            currentSlide: clone(currentSlide),
            inTransition,
            outTransition,
            transitionBetween
        }

        currentlyTransitioning[stateId] = state
        currentlyTransitioning = currentlyTransitioning
    }

    // only update if new ID! Previous is removed, but output should not update until a new value is set
    let currentIds: string[] = []
    let currentOut: { [key: string]: any } = {}
    $: if (Object.keys(currentlyTransitioning).find(id => !currentIds.includes(id))) updateOut()
    function updateOut() {
        currentOut = clone(currentlyTransitioning)
        currentIds = Object.keys(currentlyTransitioning)
    }
</script>

{#each Object.values(currentOut) as transitioning}
    <OutputTransition inTransition={transitionEnabled ? transitioning.inTransition : null} outTransition={transitionEnabled ? (transitioningBetween ? transitioning.transitionBetween : transitioning.outTransition) : null}>
        <slot customItem={transitioning.item} customLines={transitioning.lines} customOut={transitioning.outSlide} customSlide={transitioning.currentSlide} transition={transitionEnabled ? transitioning.inTransition : null} />
    </OutputTransition>
{/each}
