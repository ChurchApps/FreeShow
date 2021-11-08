<script lang="ts">
  import { activeShow, shows } from "../../../stores"
  import type { Slide } from "../../../../types/Show"

  $: active = $activeShow!.id
  let children: string[] = []

  interface Slides extends Slide {
    id: string
  }
  let slides: Slides[] = []

  $: Object.entries($shows[active].slides).forEach((slide, i) => {
    if (i === 0) slides = []
    slides.push({ id: slide[0], ...slide[1] })
    if (slide[1].children) {
      slide[1].children.forEach((childSlide: any) => {
        children.push(childSlide.id)
      })
    }
  })
  $: sortedSlides = slides.sort((a, b) => (a.label !== null && b.label !== null && a.label > b.label ? 1 : a.label === null || b.label === null || b.label > a.label ? -1 : 0))
</script>

<div class="main">
  {#each sortedSlides as slide}
    {#if !children.includes(slide.id)}
      <div id={slide.id} class="slide" style="background-color: {slide.color};">
        {slide.label || "—"}
      </div>
    {/if}
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
    text-align: center;
    background-color: var(--primary-lighter);
    cursor: pointer;
  }
  .slide:hover {
    filter: brightness(1.1);
  }
</style>
