<script lang="ts">
    import { uid } from "uid"
    import type { Item, Transition } from "../../../../types/Show"
    import { currentWindow } from "../../../stores"
    import { clone } from "../../helpers/array"
    import OutputTransition from "./OutputTransition.svelte"

    export let slideTransition: Transition
    export let transitionEnabled: boolean = false
    export let preview: boolean = false
    export let item: Item
    export let outSlide: any
    export let lines: any[]

    // let transition: Transition = slideTransition // || { type: "fade", duration: 500, easing: "linear" }
    // $: transition = slideTransition

    let currentlyTransitioning: { [key: string]: any } = {}
    $: console.log(currentlyTransitioning)

    let hide: string[] = []
    let fadeOut: string[] = []

    $: if (item !== undefined || lines) startTransition()

    // causes loop for some reason
    // $: console.trace(item, lines)
    // const WAIT_TIMER = 2000 // 200
    // let waitTimeout: any = null
    // function initTransition() {
    //     // don't change too rapidly
    //     console.log(waitTimeout)
    //     if (waitTimeout) clearTimeout(waitTimeout)
    //     waitTimeout = setTimeout(startTransition, WAIT_TIMER)
    // }

    // WIP overlay item transitions...
    // WIP item hide duration not working when clearing as Output.svelte "slide" is removed!

    let transitioning: string[] = []
    function startTransition() {
        // remove previous
        let firstItemId = Object.keys(currentlyTransitioning).find((id) => !transitioning.includes(id))
        console.log(currentlyTransitioning)
        if (firstItemId) {
            // same item as previous
            if (JSON.stringify(item) === JSON.stringify(currentlyTransitioning[firstItemId].item) && JSON.stringify(outSlide) === JSON.stringify(currentlyTransitioning[firstItemId].outSlide)) return
            // WIP currentlyTransitioning[firstItemId].item is not what it should be..... (when clicking on preview to fullscreen)
            console.log(firstItemId, JSON.stringify(item) === JSON.stringify(currentlyTransitioning[firstItemId].item), item, currentlyTransitioning[firstItemId].item, JSON.stringify(item), JSON.stringify(currentlyTransitioning[firstItemId].item))

            transitioning.push(firstItemId)

            let hideDuration = $currentWindow === "output" || preview ? currentlyTransitioning[firstItemId].item?.actions?.hideTimer || 0 : 0
            console.log(hideDuration)
            setTimeout(() => {
                let fadeDuration = transitionEnabled ? currentlyTransitioning[firstItemId].outTransition : 0
                console.log(fadeDuration)

                fadeOut.push(firstItemId)
                fadeOut = fadeOut

                setTimeout(() => {
                    removeState(firstItemId)
                    fadeOut.splice(fadeOut.indexOf(firstItemId))
                    transitioning.splice(transitioning.indexOf(firstItemId))
                }, fadeDuration * 1.1)
            }, hideDuration * 1000)
        }

        if (!item) return

        // TRANSITION

        let itemTransitionAction = transitionEnabled && item.actions?.transition && item.actions.transition.type !== "none" && item.actions.transition.duration > 0
        let itemTransition = itemTransitionAction ? clone(item.actions.transition) : null
        // if (itemTransition?.type === "none") itemTransition = { duration: 0, type: "fade", easing: "linear" }

        let inTransition = itemTransition || slideTransition
        let outTransition = itemTransition || slideTransition
        console.log(slideTransition, itemTransition, inTransition)

        let stateId = uid(5)

        // SHOW

        let showDuration = $currentWindow === "output" || preview ? item?.actions?.showTimer || 0 : 0
        if (showDuration) {
            hide.push(stateId)
            console.log(showDuration)
            setTimeout(() => {
                hide.splice(hide.indexOf(stateId), 1)
                if (!transitioning.includes(stateId)) hide = hide
                // setState(stateId, "hidden", false)
            }, showDuration * 1000)
        }

        // SET

        item = clone(item)
        lines = clone(lines)
        outSlide = clone(outSlide)

        let state = {
            item,
            lines,
            outSlide,
            inTransition,
            outTransition,
        }

        console.log(state)

        currentlyTransitioning[stateId] = state
        currentlyTransitioning = currentlyTransitioning
    }

    // function setState(id: string, key: string, value: any) {
    //     if (!currentlyTransitioning[id]) return
    //     currentlyTransitioning[id][key] = value
    // }

    function removeState(id: string) {
        delete currentlyTransitioning[id]
        // currentlyTransitioning = currentlyTransitioning
    }
</script>

<!-- ITEM WAIT TO SHOW ACTION -->
<!-- ITEM TRANSITION (IN/OUT) -->
<!-- GLOBAL SLIDE(ITEM) TRANSITION -->

{#each Object.entries(currentlyTransitioning) as [id, transitioning]}
    {#if !fadeOut.includes(id) && !hide.includes(id)}
        <OutputTransition inTransition={transitionEnabled ? transitioning.inTransition : null} outTransition={transitionEnabled ? transitioning.outTransition : null}>
            <slot customItem={transitioning.item} customLines={transitioning.lines} customOut={transitioning.outSlide} />
        </OutputTransition>
    {/if}
{/each}
