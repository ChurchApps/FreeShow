<script lang="ts">
  import icons from "../helpers/icons"

  export let id: string
  export let size: number = 1
  export let white: boolean = false

  $: width = size + "rem"
  $: height = size + "rem"
  let box: number = 24
</script>

{#if icons[id]}
  <svg class={$$props.class} class:white style="{$$props.style || ''} min-width: {width}" {width} {height} viewBox="0 0 {box} {box}">{@html icons[id]}</svg>
{/if}

<style>
  svg {
    fill: var(--secondary);
  }

  svg.white {
    fill: var(--text);
  }
</style>
