<script lang="ts">
  import type { Slide } from "../../../../types/Show"

  import { activeShow, shows } from "../../../stores"

  interface Slides {
    [key: string]: Slide
  }
  let slides: Slides = { ...$shows[$activeShow!.id].slides }
  Object.values(slides).forEach((slide) => {
    if (slide.children) {
      slide.children.forEach((childSlide) => {
        if (slides[childSlide.id]) delete slides[childSlide.id]
      })
    }
  })
</script>

<div class="main">
  {#each Object.entries(slides) as slide}
    <div class="slide" style="background-color: {slide[1].color};">
      {slide[1].label}
    </div>
  {/each}
</div>

<style>
  .main {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px;
    flex: 1;
  }

  .slide {
    padding: 5px;
    font-size: 0.8em;
    font-weight: bold;
    align-items: center;
  }
</style>
