<script lang="ts">
  import type { Resolution } from "../../../types/Settings"
  import { activeShow, screen, shows } from "../../stores"
  // import { outSlide, screen, shows } from "../../stores"

  export let background: string = "black"
  export let center: boolean = false
  export let zoom: boolean = true
  export let hideOverflow: boolean = true
  export let resolution: Resolution = $activeShow?.id && $shows[$activeShow.id].settings.resolution ? $shows[$activeShow.id].settings.resolution! : $screen.resolution // 1920, 1080
  // let resolution = { width: 1600, height: 1200 }
  let fontSize: number = 100
  let slideWidth: number = 0
  export let ratio: number = 1
  $: ratio = slideWidth / resolution.width
</script>

<div class:center>
  <div
    bind:offsetWidth={slideWidth}
    class="slide"
    class:hideOverflow
    style="{$$props.style || ''}background-color: {background};font-size: {fontSize}px;aspect-ratio: {resolution.width}/{resolution.height};"
  >
    {#if zoom}
      <span style="zoom: {ratio};">
        <slot />
      </span>
    {:else}
      <slot />
    {/if}
  </div>
</div>

<style>
  .slide {
    position: relative;
    /* TODO: not edit */
    /* z-index: -1; */
  }

  .hideOverflow {
    overflow: hidden;
  }

  .center {
    width: 100%;
    height: 100%;

    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
