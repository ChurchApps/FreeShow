<script lang="ts">
    import { createEventDispatcher } from "svelte"

    export let scrollElem: Element | null = null
    export let timeout = 0
    export let smoothTimeout = 800
    export let offset = -1
    export let shouldSkipSmooth = 0
    export let disabled = false

    let instantScroll = false
    let skipSmoothTimeout: NodeJS.Timeout | null = null
    function skipSmooth() {
        instantScroll = true
        if (skipSmoothTimeout) clearTimeout(skipSmoothTimeout)
        skipSmoothTimeout = setTimeout(() => (instantScroll = false), smoothTimeout)
    }

    skipSmooth()
    $: if (shouldSkipSmooth) skipSmooth()

    let t: any = null
    let st: any = null
    $: if (offset >= 0) scroll(0)
    function scroll(index) {
        if (t !== null || disabled) return

        let elem = scrollElem
        if (!elem) return

        // set this to make it scroll (because of dropping when scrolled)
        if (elem.querySelector(".droparea")) elem = elem.querySelector(".droparea")
        if (elem?.querySelector(".droparea")) elem = elem.querySelector(".droparea")

        if (!elem) return
        elem.setAttribute("style", (elem.getAttribute("style") || "") + ";scroll-behavior: smooth;")

        // don't scroll if already in view
        // if (offset > elem.scrollTop && offset < elem.scrollTop + elem.clientHeight) return

        t = setTimeout(() => {
            if (!t) return
            elem.scrollTo(0, offset)
            t = null
        }, timeout)

        // make sure its scrolled
        if (index > 5 || offset === elem.scrollTop) return

        index++
        if (st) return

        st = setTimeout(() => {
            if (!st) return
            if (offset !== elem.scrollTop) scroll(index)
            st = null
        }, timeout + 400)
    }

    let dispatch = createEventDispatcher()
    function wheel(event: any) {
        dispatch("wheel", { event })
        t = null
        st = null
    }
</script>

<div class="scroll {$$props.class}" on:wheel|passive={wheel} bind:this={scrollElem} style={$$props.style || ""} class:instantScroll>
    <slot />
</div>

<style>
    .scroll {
        overflow-y: auto;
        flex: 1;

        scroll-behavior: smooth;
    }

    .scroll.instantScroll,
    .scroll.instantScroll :global(.droparea) {
        scroll-behavior: initial !important;
    }
</style>
