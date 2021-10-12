<script lang="ts">
  // import { OutputObject } from "../../classes/OutputObject";

  import { output } from "../../stores"

  import Output from "./Output.svelte"

  export let mode
</script>

<svelte:window
  on:keydown={(e) => {
    if (e.key === "c" && (e.ctrlKey || e.altKey)) {
      output.set({ background: null, slide: null, overlay: null, audio: null })
    }
  }}
/>

<Output hidden={mode === "live" ? false : true} />
<!-- {#if mode === 'live'}
{/if} -->

<!-- <button on:click={() => output.set(new OutputObject())}>Clear All</button> -->
<button on:click={() => output.set({ background: null, slide: null, overlay: null, audio: null })}>Clear All</button>
