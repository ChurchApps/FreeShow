<script lang="ts">
  import type { Resolution } from "../../../types/Settings"
  import { mediaOptions, screen } from "../../stores"
  import Loader from "../main/Loader.svelte"
  import Label from "./Label.svelte"

  export let loaded: boolean = true
  export let preview: boolean = false
  export let active: boolean = false
  export let label: string
  export let icon: null | string = null
  export let color: null | string = null
  export let white: boolean = true
  export let resolution: Resolution = $screen.resolution
</script>

<!-- TODO: use global resolution .... -->
<!-- display: table; -->
<div
  class="main {$$props.class}"
  style="flex-direction: {$mediaOptions.grid ? 'column' : 'row'};width: {$mediaOptions.grid ? 100 / $mediaOptions.columns : 100}%;"
  class:preview
  class:active
  on:click
  on:dblclick
>
  <div class="over" style="flex-direction: {$mediaOptions.grid ? 'column' : 'row'};width: 100%;">
    {#if preview}
      <div class="overlay" />
    {:else}
      <div class="hover overlay" />
    {/if}
    <div class="card" style="{$$props.style || ''};aspect-ratio: {resolution.width}/{resolution.height};" on:mouseenter on:mouseleave on:mousemove>
      {#if !loaded}
        <div class="loader">
          <Loader />
        </div>
      {/if}
      <slot />
    </div>
    <Label {label} {icon} {white} {color} />
  </div>
</div>

<style>
  .main {
    display: flex;
    padding: 5px;
    position: relative;
  }

  .over {
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .over:hover > .hover {
    /* background-color: var(--primary-lighter); */
    /* filter: brightness(1.1); */
    opacity: 1;
  }
  .hover.overlay {
    opacity: 0;
    /* transition: 0.1s opacity; */
    background-color: rgb(255 255 255 / 0.05);
    position: absolute;
    top: 0;
    left: 0;
  }

  .main.preview {
    outline: 2px solid var(--primary-lighter);
    outline-offset: -1px;
    z-index: 1;
    /* outline: 3px solid var(--primary-lighter);
    outline-offset: -2px;
    outline-offset: -5px; */
  }
  .overlay {
    pointer-events: none;
    position: absolute;
    top: 0;
    left: 0;
    background-color: rgb(0 0 0 / 0.5);
    height: 100%;
    width: 100%;
    z-index: 1;
  }
  .main.active {
    outline: 2px solid var(--secondary);
    outline-offset: -1px;
    z-index: 2;
    /* outline: 3px solid var(--secondary);
    outline-offset: -2px;
    outline-offset: -5px; */
  }

  .main :global(video),
  .main :global(canvas),
  .main :global(img) {
    max-width: 100%;
    max-height: 100%;
    align-self: center;
    pointer-events: none;
  }
  .main :global(.observer) {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
  }

  .card {
    display: flex;
    position: relative;
    /* flex-direction: column; */
    justify-content: center;
    /* aspect-ratio: 16/9; */
    background-color: var(--primary);
  }

  .loader {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
</style>
