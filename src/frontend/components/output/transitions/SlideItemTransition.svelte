<script lang="ts">
    import { uid } from "uid"
    import type { Item, Transition } from "../../../../types/Show"
    import { currentWindow, scriptureSettings, templates } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { getStyleTemplate, itemNeedsAutoSize, slideHasAutoSizeItem } from "../../helpers/output"
    import OutputTransition from "./OutputTransition.svelte"
    // import { onMount } from "svelte"

    export let globalTransition: Transition
    export let transitionEnabled = false
    export let transitioningBetween = false
    export let isClearing = false
    // outgoing items hold for auto size delay while incoming content calculates font size
    export let incomingNeedsAutoSize = true
    export let preview = false
    export let item: Item
    export let currentSlide: any = {}
    export let outSlide: any = {}
    export let lines: any[] = []
    export let currentStyle: any = {}

    let currentlyTransitioning: { [key: string]: any } = {}

    $: if (item !== undefined || lines) startTransition()

    // update out transition if cleared without incoming content or transition changed
    $: clearingOutTransition = getClearingOutTransition(globalTransition, item)
    function getClearingOutTransition(global: Transition, currentItem: Item): Transition {
        const transition = currentItem?.actions?.transition || global || ({} as Transition)
        const out = clone(transition.out || transition) as Transition

        if (out.type === "none") out.duration = 0

        // keep custom "hide" delay, without auto size delay
        const hideDuration = $currentWindow === "output" || preview ? currentItem?.actions?.hideTimer || 0 : 0
        out.delay = hideDuration ? hideDuration * 1000 : 0

        // delay won't work if no transition
        if (out.delay && (out.type === "none" || !out.duration)) return { ...out, type: "fade", duration: 1 }

        return out
    }

    // WIP item wait out time will not clear other items without wait time if between transition
    // WIP slide direction from top to bottom is a bit buggy
    // WIP image is flashing a bit in scripture transition none

    function startTransition() {
        // prevent stacking of the same item on update
        const lastStateId = Object.keys(currentlyTransitioning).pop()
        if (lastStateId) {
            const lastState = currentlyTransitioning[lastStateId]
            if (JSON.stringify(lastState.item) === JSON.stringify(item) && JSON.stringify(lastState.lines) === JSON.stringify(lines) && JSON.stringify(lastState.outSlide) === JSON.stringify(outSlide) && JSON.stringify(lastState.currentSlide) === JSON.stringify(currentSlide)) {
                return
            }
        }

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
        let autoSizeDelay = 0

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
            const templateNeedsAutoSize = slideHasAutoSizeItem(customTemplate)

            if (templateNeedsAutoSize || itemNeedsAutoSize(item)) {
                autoSizeDelay = 500
                outDelay = autoSizeDelay
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
            transitionBetween,
            autoSizeDelay
        }

        currentlyTransitioning[stateId] = state
        currentlyTransitioning = currentlyTransitioning
    }

    function getOutTransition(transitioning: any, incomingNeedsAutoSize: boolean, transitioningBetween: boolean): Transition {
        const transition = transitioningBetween ? transitioning.transitionBetween : transitioning.outTransition
        if (!incomingNeedsAutoSize && transitioning.autoSizeDelay) {
            return { ...transition, delay: Math.max(0, (transition.delay || 0) - transitioning.autoSizeDelay) }
        }
        return transition
    }

    // only update if new ID! Previous is removed, but output should not update until a new value is set
    let currentIds: string[] = []
    let currentOut: { [key: string]: any } = {}
    $: if (Object.keys(currentlyTransitioning).find((id) => !currentIds.includes(id))) updateOut()
    function updateOut() {
        currentOut = clone(currentlyTransitioning)
        currentIds = Object.keys(currentlyTransitioning)
    }
</script>

{#each Object.values(currentOut) as transitioning}
    {@const outTransition = !transitionEnabled ? null : isClearing ? clearingOutTransition : getOutTransition(transitioning, incomingNeedsAutoSize, transitioningBetween)}
    <OutputTransition inTransition={transitionEnabled ? transitioning.inTransition : null} {outTransition}>
        <slot customItem={transitioning.item} customLines={transitioning.lines} customOut={transitioning.outSlide} customSlide={transitioning.currentSlide} transition={transitionEnabled ? transitioning.inTransition : null} />
    </OutputTransition>
{/each}
