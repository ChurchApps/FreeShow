<script lang="ts">
    export let scrollElem: any = null
    export let timeout: number = 0
    export let offset: number = -1

    let behaviour: string = ""
    setTimeout(() => (behaviour = "scroll-behavior: smooth;"), 800)

    let t: any = null
    $: if (offset >= 0) scroll()
    function scroll() {
        if (t !== null) return

        t = setTimeout(() => {
            scrollElem?.scrollTo(0, offset)
            t = null
        }, timeout)

        // make sure its scrolled
        setTimeout(() => {
            if (offset !== scrollElem?.scrollTop) scroll()
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
