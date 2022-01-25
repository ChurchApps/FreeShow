<script lang="ts">
  export let scrollElem: any = null
  export let offset: number = -1
  let behaviour: string = ""
  setTimeout(() => (behaviour = "scroll-behavior: smooth;"), 50)

  $: {
    if (offset >= 0) scrollElem?.scrollTo(0, offset)
  }

  // function keydown(e: any) {
  //   if (e.key.includes("Arrow")) e.preventDefault()
  // }
</script>

<!-- <svelte:window on:keydown={keydown} /> -->

<div class="scroll" on:wheel bind:this={scrollElem} style={($$props.style || "") + behaviour}>
  <slot />
</div>

<style>
  .scroll {
    overflow-y: auto;
    flex: 1;
  }
</style>
