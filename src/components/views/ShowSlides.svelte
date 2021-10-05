<script>
  import { shows, activeShow, activeSlide, screen } from "../../stores";
import Textbox from "./slide/Textbox.svelte";

  let resolution = $shows[$activeShow.id].show.resolution || $screen.resolution;
  let zoom = .15;

  export let editor;

  $: id = $activeShow.id;
  // let type = 
</script>

<svelte:window on:keydown={e => {
  if (!editor) {
    if (e.key === 'ArrowRight' || e.key === ' ') {
      document.activeElement.blur();
      if ($activeSlide?.id === id) {
        let newSlide = $activeSlide;
        if ($shows[$activeSlide.id].slides[newSlide.index + 1]) newSlide.index = newSlide.index + 1;
        // Check for loop to beginning slide...
        // Go to next show?
        // if (e.ctrlKey && ) { // TODO: if ctrl key, go to next show
        //   newSlide = {id: , index: 0}
        // }
        activeSlide.set(newSlide);
      } else {
        activeSlide.set({id: $activeShow.id, index: 0});
      }
    } else if (e.key === 'ArrowLeft') {
      if ($activeSlide?.id === id) {
        let newSlide = $activeSlide;
        if (newSlide.index - 1 >= 0) newSlide.index = newSlide.index - 1;
        activeSlide.set(newSlide);
      } else {
        activeSlide.set({id: $activeShow.id, index: $shows[$activeShow.id].slides.length - 1});
      }
    }
  }
}} />

<div class="grid" style="{editor ? "flex-direction: column;" : ""}">
  {#each $shows[id].slides as slide, i}
  <!-- {console.log()} -->
    <div class="slide {($activeSlide?.index === i && $activeSlide?.id === id) ? "active" : ""}" style="width: {resolution.width * zoom}px; height: {resolution.height * zoom}px;" on:click={() => activeSlide.set({id, index: i})}>
      <span style="zoom: {zoom};">
        <!-- TODO: check if showid exists in shows -->
        {#each slide as textbox}
          <Textbox {textbox} />
        {/each}
      </span>
    </div>
  {/each}
</div>

<style>
  .grid {
    --gap: 10px;
    display: flex;
    gap: var(--gap);
    margin: var(--gap);
  }

  .slide {
    position: relative;
    background-color: black;
    width: 1920px;
    height: 1080px;
    font-size: 5em;
  }
  .slide.active {
    outline: 2px solid var(--secondary);
    outline-offset: 4px;
  }
</style>