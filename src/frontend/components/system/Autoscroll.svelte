<script lang="ts">
  export let scrollElem: any
  export let offset: number = -1
  let behaviour: string = ""
  setTimeout(() => (behaviour = "scroll-behavior: smooth;"), 50)

  $: {
    if (offset >= 0) scrollElem?.scrollTo(0, offset)
  }
</script>

<div class="scroll" bind:this={scrollElem} style={($$props.style || "") + behaviour}>
  <slot />
</div>

<style>
  .scroll {
    overflow-y: auto;
    flex: 1;
  }
</style>
