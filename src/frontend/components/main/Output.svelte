<script lang="ts">
  import { shows, output, screen, outputWindow } from "../../stores"
  import Textbox from "../slide/Textbox.svelte"
  import { fade } from "svelte/transition"
  import { getSlide } from "../helpers/get"
  import type { Resolution } from "../../../types/Settings"
  // import { getSlide } from "../helpers/get"

  $: Background = $output.background
  $: Slide = $output.slide
  $: Overlay = $output.overlay
  $: Audio = $output.audio

  let slideWidth: number = 300

  export let hidden: boolean = false
  // export let zoom: number = 0.3
  let resolution: Resolution = Slide ? $shows[$output.slide!.id].settings.resolution! : $screen.resolution
  $: zoom = slideWidth / resolution.width
  // TODO: precentages instead of pixels for text???

  let transition = { duration: 500 } // text (not background)
  // TODO: showing slide upon clear fade out will show black output (Transition bug!)
  // TODO: dont show transition upon no change!s
</script>

<!-- <div class="slide" class:hidden style="width: {resolution.width * zoom}px; height: {resolution.height * zoom}px;"> -->
<div bind:offsetWidth={slideWidth} class="slide" class:hidden style={$$props.style} class:noCursor={$outputWindow}>
  {#if Background !== null}
    <!--  -->
  {/if}
  {#if Slide}
    {#key Slide}
      <span style="zoom: {zoom};" transition:fade={transition}>
        <!-- {#each Object.values($shows[$activeShow.id].slides[Slide.id]) as item} -->
        <!-- {#each Object.values(GetShows().active().slides) as item} -->
        <!-- {#each Object.values(getSlide($activeShow.id, Slide.id)) as item} -->
        <!-- {#each GetShows().active.slides[GetActiveLayout().slides[Slide.index].id].items as item} -->
        {#each getSlide(Slide.id, Slide.index).items as item}
          <Textbox {item} />
        {/each}
      </span>
    {/key}
  {/if}
  {#if Overlay !== null}
    <!--  -->
  {/if}
  {#if Audio !== null}
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

  .hidden {
    display: none;
  }
</style>
