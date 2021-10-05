<script>
  import { shows, activeShow, activeSlide, screen } from "../../stores";
  import Textbox from "./slide/Textbox.svelte";
	import { fade } from 'svelte/transition';

  $: slide = $activeSlide;

  export let hidden;
  export let zoom = .3;
  let resolution = slide ? $shows[$activeSlide.id].show.resolution : $screen.resolution;

  let transition = {duration: 500}; // text (not background)
  // TODO: showing slide upon clear fade out will show black output (Transition bug!)
  // TODO: dont show transition upon no change!s
</script>

<div class="slide" class:hidden style="width: {resolution.width * zoom}px; height: {resolution.height * zoom}px;">
  {#if slide}
    {#if slide.type === 'video'}
      <!--  -->
    {:else}
      {#key slide}
        <span style="zoom: {zoom};" transition:fade="{transition}">
          {#each $shows[slide.id].slides[slide.index] as textbox}
            <Textbox {textbox} />
          {/each}
        </span>
      {/key}
    {/if}
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