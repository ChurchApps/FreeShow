<script lang="ts">
    import { createEventDispatcher } from "svelte"

    export let scrollElem: any = null
    export let timeout: number = 0
    export let offset: number = -1

    let behaviour: string = ""
    setTimeout(() => (behaviour = "scroll-behavior: smooth;"), 800)

    let t: any = null
    let st: any = null
    $: if (offset >= 0) scroll(0)
    function scroll(index) {
        if (t !== null) return

        let elem = scrollElem
        if (!elem) return

        // set this to make it scroll (because of dropping when scrolled)
        if (elem.querySelector(".droparea")) elem = elem.querySelector(".droparea")
        if (elem.querySelector(".droparea")) elem = elem.querySelector(".droparea")
        elem.setAttribute("style", (elem.getAttribute("style") || "") + behaviour)

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

<div class="scroll {$$props.class}" on:wheel|passive={wheel} bind:this={scrollElem} style={($$props.style || "") + behaviour}>
    <slot />
</div>

<style>
    .scroll {
        overflow-y: auto;
        flex: 1;
    }
</style>
