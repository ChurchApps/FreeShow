<script lang="ts">
  import Loader from "../main/Loader.svelte"

  export let loaded: boolean = true
  export let preview: boolean = false
  export let active: boolean = false
  export let columns: number = 4
</script>

<!-- TODO: use global resolution .... -->
<!-- display: table; -->
<div class="card" style="{$$props.style || ''};width: calc({100 / columns}% - 8px);" class:preview class:active on:click on:dblclick on:mouseenter on:mouseleave on:mousemove>
  {#if preview}
    <div class="overlay" />
  {:else}
    <div class="hover overlay" />
  {/if}
  {#if !loaded}
    <div class="loader">
      <Loader />
    </div>
  {/if}
  <slot />
</div>

<style>
  .card {
    display: flex;
    position: relative;
    /* flex-direction: column; */
    justify-content: center;
    /* aspect-ratio: 16/9; */
    aspect-ratio: 16/10.3;
    background-color: var(--primary);
    padding-bottom: 25px;
  }
  .card:hover > .hover {
    /* background-color: var(--primary-lighter); */
    /* filter: brightness(1.1); */
    opacity: 1;
  }
  .hover.overlay {
    opacity: 0;
    background-color: rgb(255 255 255 / 0.1);
  }

  .card.preview {
    outline: 2px solid var(--primary-lighter);
    outline-offset: 0px;
    /* filter: brightness(1.3); */
  }
  .overlay {
    pointer-events: none;
    position: absolute;
    top: 0;
    background-color: rgb(0 0 0 / 0.5);
    height: 100%;
    width: 100%;
    z-index: 1;
  }
  .card.active {
    outline: 2px solid var(--secondary);
    outline-offset: 0px;
  }

  .card :global(video),
  .card :global(canvas),
  .card :global(img) {
    max-width: 100%;
    max-height: 100%;
    align-self: center;
    pointer-events: none;
  }

  .loader {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
</style>
