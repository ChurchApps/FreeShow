<script>
import { activeSlide } from "../../stores";

  import Output from "./Output.svelte";

  export let mode;
</script>

<svelte:window on:keydown={e => {
  if (e.key === 'c' && (e.ctrlKey || e.altKey)) {
    activeSlide.set(null);
  }
}} />

<Output hidden={mode === 'live' ? false : true} />
<!-- {#if mode === 'live'}
{/if} -->


<button on:click={() => activeSlide.set(null)}>Clear All</button>