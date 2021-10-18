<script lang="ts">
  import { shows, activeShow, output, screen } from "../../stores"
  import Textbox from "../slide/Textbox.svelte"
  import { fade, slide } from "svelte/transition"
  import { GetShows, getSlide } from "../helpers/get"
  import { identity } from "svelte/internal"
  // import { getSlide } from "../helpers/get"

  $: Background = $output.background
  $: Slide = $output.slide
  $: Overlay = $output.overlay
  $: Audio = $output.audio

  export let hidden: boolean = false
  export let zoom: number = 0.3
  let resolution = Slide ? $shows[$output.slide.id].settings.resolution : $screen.resolution

  let transition = { duration: 500 } // text (not background)
  // TODO: showing slide upon clear fade out will show black output (Transition bug!)
  // TODO: dont show transition upon no change!s
</script>

<div class="slide" class:hidden style="width: {resolution.width * zoom}px; height: {resolution.height * zoom}px;">
  {#if Background !== null}
    <!--  -->
  {/if}
  {#if Slide !== null}
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
</div>

<style>
  .slide {
    position: relative;
    background-color: black;
    width: 1920px;
    height: 1080px;
    font-size: 5em;
  }

  .hidden {
    display: none;
  }
</style>
