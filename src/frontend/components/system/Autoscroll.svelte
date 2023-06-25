<script lang="ts">
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

        t = setTimeout(() => {
            scrollElem?.scrollTo(0, offset)
            t = null
        }, timeout)

        // make sure its scrolled
        if (index > 5 || offset === scrollElem?.scrollTop) return
        index++
        if (st) return
        st = setTimeout(() => {
            if (offset !== scrollElem?.scrollTop) scroll(index)
            st = null
        }, timeout + 400)
    }
</script>

<div class="scroll {$$props.class}" on:wheel bind:this={scrollElem} style={($$props.style || "") + behaviour}>
    <slot />
</div>

<style>
    .scroll {
        overflow-y: auto;
        flex: 1;
    }
</style>
