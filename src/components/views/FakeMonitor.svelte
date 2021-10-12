<script lang="ts">
  import Output from "./Output.svelte"
  import { screen } from "../../stores"

  let active = false

  let maxHeight = Math.max($screen.resolution.height, window.innerHeight)
  let minHeight = Math.min($screen.resolution.height, window.innerHeight)
  let maxWidth = Math.max($screen.resolution.width, window.innerWidth)
  let minWidth = Math.min($screen.resolution.width, window.innerWidth)
  let height = $screen.resolution.height > window.innerHeight ? minHeight / maxHeight : 1
  let width = $screen.resolution.width > window.innerWidth ? minWidth / maxWidth : 1
  $: zoom = Math.min(height, width) - 0.05
</script>

<svelte:window
  on:keydown={(e) => {
    if (e.key === "1" && (e.ctrlKey || e.altKey)) {
      active = !active
    }
  }}
/>

<button on:click={() => (active = !active)}>
  {#if active}
    Hide
  {:else}
    Show
  {/if}
</button>

<div class:active>
  <span class="resolution">
    <p><b>Width:</b> {$screen.resolution.width}px</p>
    <p><b>Height:</b> {$screen.resolution.height}px</p>
  </span>
  <span style="zoom: {zoom};">
    <Output zoom={1} />
  </span>
</div>

<style>
  button {
    position: absolute;
    right: 10px;
    bottom: 10px;
    padding: 20px;
    /* z-index: 1; */
  }

  div {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border: 4px solid var(--secondary);

    display: none;
  }

  .resolution {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 5px;
    z-index: 30;
    color: var(--secondary-text);
    padding: 10px 12px;
    border-bottom-right-radius: 5px;
    background-color: var(--secondary-opacity);
  }
  .resolution p {
    display: flex;
    gap: 5px;
    justify-content: space-between;
  }

  /* span {
    width: 1920px;
    height: 1080px;
    zoom: .7;
  } */

  .active {
    display: block;
  }
</style>
