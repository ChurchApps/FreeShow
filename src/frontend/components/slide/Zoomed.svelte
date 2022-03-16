<script lang="ts">
  import type { Resolution } from "../../../types/Settings"
  import { activeShow, screen, showsCache } from "../../stores"

  export let background: string = "black"
  export let center: boolean = false
  export let zoom: boolean = true
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
    style="{$$props.style || ''}background-color: {background};aspect-ratio: {resolution.width}/{resolution.height};"
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

  .slide :global(.item) {
    position: absolute;
    /* display: inline-flex; */
    overflow: hidden;

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
