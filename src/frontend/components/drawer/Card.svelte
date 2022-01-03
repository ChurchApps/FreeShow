<script lang="ts">
  import Loader from "../main/Loader.svelte"

  export let loaded: boolean = true
  export let active: boolean = false
  export let columns: number = 4
</script>

<!-- TODO: use global resolution .... -->
<!-- display: table; -->
<div class="card" style="width: calc({100 / columns}% - 8px);" class:active on:click on:mouseenter on:mouseleave on:mousemove>
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
