<script lang="ts">
  export let show: any
  export let disableStyle: boolean = false
  export let relative: boolean = false

  let resolution: any = show && show.settings.resolution ? show.settings.size : { width: 1920, height: 1080 } // $screen.resolution
  let slideWidth: number = 0
  let ratio: number = 1
  $: ratio = slideWidth / resolution.width

  // dynamic resolution
  resolution = { width: window.innerWidth, height: window.innerHeight }
</script>

<div class="center">
  <div bind:offsetWidth={slideWidth} class:disableStyle class:relative class="slide" style="{$$props.style || ''}aspect-ratio: {resolution.width}/{resolution.height};">
    <span style="zoom: {ratio};">
      <slot />
    </span>
  </div>
</div>

<style>
  .slide {
    position: relative;
    background-color: black;
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
    /* font-family: "CMGSans"; */
    font-family: system-ui;
    line-height: 1;
    -webkit-text-stroke-color: #000000;
    text-shadow: 2px 2px 10px #000000;

    border-style: solid;
    border-width: 0px;
    border-color: #ffffff;

    height: 150px;
    width: 400px;

    width: 100%;
    height: 100%;
    color: unset;
  }

  .center {
    width: 100%;
    height: 100%;

    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
