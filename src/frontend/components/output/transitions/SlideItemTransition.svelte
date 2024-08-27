<script lang="ts">
    import { uid } from "uid"
    import type { Item, Transition } from "../../../../types/Show"
    import { currentWindow } from "../../../stores"
    import { clone } from "../../helpers/array"
    import OutputTransition from "./OutputTransition.svelte"

    export let globalTransition: Transition
    export let transitionEnabled: boolean = false
    export let preview: boolean = false
    export let item: Item
    export let currentSlide: any
    export let outSlide: any
    export let lines: any[]
    export let customTemplate: any

    let currentlyTransitioning: { [key: string]: any } = {}
    $: console.log(currentlyTransitioning)

    $: if (item !== undefined || lines) startTransition()
    $: console.log(item, lines)

    // WIP overlay item transitions...
    // WIP item hide duration not working when clearing as Output.svelte "slide" is removed!

    // let transitioning: string[] = []
    function startTransition() {
        // // TODO: this fade out is never called as the entire item is just removed....!
        // // remove previous
        // let firstItemId = Object.keys(currentlyTransitioning).find((id) => !transitioning.includes(id))
        // console.log(currentlyTransitioning)
        // if (firstItemId) {
        //     // same item as previous
        //     if (JSON.stringify(item) === JSON.stringify(currentlyTransitioning[firstItemId].item) && JSON.stringify(outSlide) === JSON.stringify(currentlyTransitioning[firstItemId].outSlide)) return
        //     // WIP currentlyTransitioning[firstItemId].item is not what it should be..... (when clicking on preview to fullscreen)
        //     console.log(firstItemId, JSON.stringify(item) === JSON.stringify(currentlyTransitioning[firstItemId].item), item, currentlyTransitioning[firstItemId].item, JSON.stringify(item), JSON.stringify(currentlyTransitioning[firstItemId].item))

        //     transitioning.push(firstItemId)

        //     let hideDuration = $currentWindow === "output" || preview ? currentlyTransitioning[firstItemId].item?.actions?.hideTimer || 0 : 0
        //     console.log(hideDuration)
        //     setTimeout(() => {
        //         let fadeDuration = transitionEnabled ? currentlyTransitioning[firstItemId].outTransition : 0
        //         console.log(fadeDuration)

        //         fadeOut.push(firstItemId)
        //         fadeOut = fadeOut

        //         setTimeout(() => {
        //             removeState(firstItemId)
        //             fadeOut.splice(fadeOut.indexOf(firstItemId))
        //             transitioning.splice(transitioning.indexOf(firstItemId))
        //         }, fadeDuration * 1.1)
        //     }, hideDuration * 1000)
        // }

        // if (!item) return

        // TRANSITION

        // let itemTransitionAction = transitionEnabled && item.actions?.transition && item.actions.transition.type !== "none" && item.actions.transition.duration > 0
        // let itemTransition = itemTransitionAction ? clone(item.actions.transition) : null
        let itemTransition = item.actions?.transition ? clone(item.actions.transition) : null
        if (itemTransition?.type === "none") itemTransition.duration = 0

        // WIP get slide transition

        let inTransition = itemTransition || globalTransition
        let outTransition = itemTransition || globalTransition

        // ITEM IN/OUT DELAY
        let showDuration = $currentWindow === "output" || preview ? item?.actions?.showTimer || 0 : 0
        if (showDuration) inTransition.delay = showDuration * 1000
        let hideDuration = $currentWindow === "output" || preview ? item?.actions?.hideTimer || 0 : 0
        if (hideDuration) outTransition.delay = hideDuration * 1000

        // DELAY

        // WIP increased delay each time
        // WIP don't fade to black in betweendelay..
        let delay: number = 0
        console.log(customTemplate)
        // // wait for scripture auto size
        // let delay: number = outSlide?.id === "temp" ? 400 : 0
        // // check output template auto size
        // if (!delay && customTemplate) {
        //     let templateItems = $templates[customTemplate]?.items || []
        //     let hasAuto = templateItems.find((a) => a.auto)
        //     if (hasAuto) delay = 400
        // }

        // add some time in case an identical item is "fading" in
        if (delay && itemTransition?.duration === 0) {
            outTransition = { type: "fade", duration: 1, easing: "linear", delay: (outTransition.delay || 0) + 100 }
        }
        if (delay) outTransition.delay = (outTransition.delay || 0) + delay

        console.log(globalTransition, itemTransition, inTransition, outTransition)

        // SET

        let stateId = uid(5)
        item = clone(item)
        lines = clone(lines)
        outSlide = clone(outSlide)
        currentSlide = clone(currentSlide)

        let state = {
            item,
            lines,
            outSlide,
            currentSlide,
            inTransition,
            outTransition,
        }

        console.log(state)

        currentlyTransitioning[stateId] = state
        currentlyTransitioning = currentlyTransitioning
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

<!-- ITEM WAIT TO SHOW ACTION -->
<!-- ITEM TRANSITION (IN/OUT) -->
<!-- GLOBAL SLIDE(ITEM) TRANSITION -->

{#each Object.entries(currentOut) as [id, transitioning]}
    <span style="font-size: 0;position: absolute;">{console.log(transitioning, id, transitionEnabled ? transitioning.inTransition : null)}</span>
    <OutputTransition inTransition={transitionEnabled ? transitioning.inTransition : null} outTransition={transitionEnabled ? transitioning.outTransition : null}>
        <slot customItem={transitioning.item} customLines={transitioning.lines} customOut={transitioning.outSlide} customSlide={transitioning.currentSlide} />
    </OutputTransition>
{/each}
