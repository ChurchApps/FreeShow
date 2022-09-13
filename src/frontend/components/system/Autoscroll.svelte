<script lang="ts">
  export let scrollElem: any = null
  export let timeout: number = 0
  export let offset: number = -1

  let behaviour: string = ""
  setTimeout(() => (behaviour = "scroll-behavior: smooth;"), 800)

  let t: any = null
  $: {
    if (offset >= 0) {
      if (t !== null) clearTimeout(t)
      t = setTimeout(() => scrollElem?.scrollTo(0, offset), timeout)
    }
  }
</script>

<div class="scroll" on:wheel bind:this={scrollElem} style={($$props.style || "") + behaviour}>
  <slot />
</div>

<style>
  .scroll {
    overflow-y: auto;
    flex: 1;
  }
</style>
