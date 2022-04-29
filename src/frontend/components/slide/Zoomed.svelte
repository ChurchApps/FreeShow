<script lang="ts">
  import type { Resolution } from "../../../types/Settings"
  import { activeShow, backgroundColor, screen, showsCache } from "../../stores"

  export let background: string = $backgroundColor || "#000000"
  export let center: boolean = false
  export let zoom: boolean = true
  export let disableStyle: boolean = false
  export let relative: boolean = false
  export let aspectRatio: boolean = true
  export let hideOverflow: boolean = true
  export let resolution: Resolution = $activeShow?.id && $showsCache[$activeShow.id]?.settings.resolution ? $showsCache[$activeShow.id].settings.resolution! : $screen.resolution
  let slideWidth: number = 0
  export let ratio: number = 1
  $: ratio = Math.max(0.01, slideWidth / resolution.width)
</script>

<div class:center style={$$props.style || "width: 100%;height: 100%;"}>
  <div
    bind:offsetWidth={slideWidth}
    class="slide"
    class:hideOverflow
    class:disableStyle
    class:relative
    style="{$$props.style || ''}background-color: {background};{aspectRatio ? `aspect-ratio: ${resolution.width}/${resolution.height};` : ''};"
  >
    {#if zoom}
      <span style="zoom: {ratio};">
        <slot {ratio} />
      </span>
    {:else}
      <slot ratio={1} />
    {/if}
  </div>
</div>

<style>
  .slide {
    position: relative;
    /* TODO: not edit */
    /* z-index: -1; */
  }

  .slide:not(.relative) :global(.item) {
    position: absolute;
    /* display: inline-flex; */
    overflow: hidden;
  }

  .slide:not(.disableStyle) :global(.item) {
    color: white;
    font-size: 100px;
    font-family: "CMGSans";
    line-height: 1;
    -webkit-text-stroke-color: #000000;
    text-shadow: 2px 2px 10px #000000;

    border-style: solid;
    border-width: 0px;
    border-color: #ffffff;

    height: 150px;
    width: 400px;
  }

  .hideOverflow {
    overflow: hidden;
  }

  .center {
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
