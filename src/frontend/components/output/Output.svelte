<script lang="ts">
  import { shows, screen, outputWindow, outBackground, outSlide, outOverlays, outAudio, overlays } from "../../stores"
  import Textbox from "../slide/Textbox.svelte"
  import { fade } from "svelte/transition"
  import { getSlide } from "../helpers/get"
  import type { Resolution } from "../../../types/Settings"
  import MediaOutput from "./MediaOutput.svelte"
  import type { Transition } from "../../../types/Show"
  import { OUTPUT } from "../../../types/Channels"
  // import { getSlide } from "../helpers/get"

  export let video: any = null
  export let videoData: any = { time: 0, duration: 0, paused: true }

  if ($outputWindow) {
    window.api.receive(OUTPUT, (msg: any) => {
      if (msg.channel === "VIDEO_DATA") videoData = msg.data
    })
  }

  let slideWidth: number = 300

  export let hidden: boolean = false
  // export let zoom: number = 0.3
  let resolution: Resolution = $outSlide ? $shows[$outSlide.id].settings.resolution! : $screen.resolution
  $: zoom = slideWidth / resolution.width
  // TODO: precentages instead of pixels for text???

  let transition: Transition = { type: "fade", duration: 500 } // text (not background)
  // TODO: showing slide upon clear fade out will show black output (Transition bug!)
  // TODO: dont show transition upon no change!s
</script>

<!-- TODO: output aspect ratio / width/height -->

<!-- <div class="slide" class:hidden style="width: {resolution.width * zoom}px; height: {resolution.height * zoom}px;"> -->
<div bind:offsetWidth={slideWidth} class="slide" class:hidden style={$$props.style} class:noCursor={$outputWindow}>
  {#if $outBackground !== null}
    <!-- {#key $outBackground} -->
    <MediaOutput {...$outBackground} {transition} bind:video bind:videoData />
    <!-- {/key} -->
  {/if}
  {#if $outSlide}
    {#key $outSlide}
      <span style="zoom: {zoom};" transition:fade={transition}>
        <!-- {#each Object.values($shows[$activeShow.id].slides[Slide.id]) as item} -->
        <!-- {#each Object.values(GetShows().active().slides) as item} -->
        <!-- {#each Object.values(getSlide($activeShow.id, Slide.id)) as item} -->
        <!-- {#each GetShows().active.slides[GetActiveLayout().slides[Slide.index].id].items as item} -->
        {#each getSlide($outSlide.id, $outSlide.index).items as item}
          <Textbox {item} />
        {/each}
      </span>
    {/key}
  {/if}
  {#if $outOverlays.length}
    {#each $outOverlays as id}
      <div style="zoom: {zoom}; {$overlays[id].style}" transition:fade={transition}>
        {#each $overlays[id].items as item}
          <Textbox {item} />
        {/each}
      </div>
    {/each}
  {/if}
  {#if $outAudio.length}
    <!--  -->
  {/if}
</div>

<style>
  .slide {
    position: relative;
    background-color: black;
    /* width: 1920px;
    height: 1080px; */
    font-size: 5em;

    width: 100%;
    height: 100%;
    aspect-ratio: 16/9;
  }
  .slide.noCursor {
    cursor: none;
  }

  /* .slide span {
    position: absolute;
  } */

  .hidden {
    display: none;
  }
</style>
