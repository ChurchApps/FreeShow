<script lang="ts">
  import type { Resolution } from "../../../../types/Settings"

  export let background: string = "black"
  export let center: boolean = false
  export let hideOverflow: boolean = true
  export let resolution: Resolution
  // let resolution = { width: 1600, height: 1200 }
  let slideWidth: number = 0
  export let ratio: number = 1
  $: ratio = slideWidth / resolution.width
</script>

<div class:center>
  <div
    bind:offsetWidth={slideWidth}
    class="slide"
    class:hideOverflow
    style="{$$props.style || ''}background-color: {background};aspect-ratio: {resolution.width}/{resolution.height};"
  >
    <span style="zoom: {ratio};">
      <slot />
    </span>
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
    line-height: 1.1;
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
    width: 100%;
    height: 100%;

    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
