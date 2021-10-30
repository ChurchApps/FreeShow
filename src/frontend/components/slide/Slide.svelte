<script lang="ts">
  import { createEventDispatcher } from "svelte"
  import type { Resolution } from "../../../types/Settings"

  import type { Slide } from "../../../types/Show"
  import { activeShow, screen, shows } from "../../stores"
  import Textbox from "./Textbox.svelte"

  export let slide: Slide
  export let color: string | null = slide.color
  export let index: number
  export let zoom: number = 1
  export let active: boolean = false

  let resolution: Resolution = $shows[$activeShow!.id].settings.resolution || $screen.resolution

  const dispatch = createEventDispatcher()
  function click() {
    dispatch("click")
  }
</script>

<!-- TODO: disabled -->
<div class="slide context_slide" class:active style="background-color: {color};" tabindex={0} on:click={click}>
  <!-- TODO: tab select on enter -->
  <div class="slideContent" style="width: {resolution.width * zoom}px; height: {resolution.height * zoom}px;">
    <span style="zoom: {zoom};">
      <!-- TODO: check if showid exists in shows -->
      {#each slide.items as item}
        <Textbox {item} />
      {/each}
    </span>
  </div>
  <!-- TODO: BG: white, color: black -->
  <div class="label" style="width: {resolution.width * zoom}px;" title={slide.label || ""}>
    <!-- font-size: 0.8em; -->
    <span style="position: absolute;display: contents;">{index + 1}</span>
    <span class="text">{slide.label || ""}</span>
  </div>
</div>

<style>
  .slide {
    padding: 5px;
    /* width: 100%; */ /* WIP */
    /* position: relative;
    background-color: black; */
    /* width: 1920px;
    height: 1080px; */
    /* font-size: 5em; */
  }
  .slide.active {
    outline: 2px solid var(--secondary);
    outline-offset: 0px;
  }

  .slideContent {
    position: relative;
    background-color: black;
    /* width: 1920px;
    height: 1080px; */
    font-size: 5em;
  }

  .label {
    display: flex;
    padding-top: 5px;
    font-size: 0.8em;
    font-weight: bold;
    align-items: center;
    /* opacity: 0.8; */
  }

  .label .text {
    width: 100%;
    margin: 0 20px;
    text-align: center;
    overflow-x: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
