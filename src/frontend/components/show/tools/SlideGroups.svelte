<script lang="ts">
  import { activeShow, selected, shows } from "../../../stores"
  import type { Slide } from "../../../../types/Show"
  import Draggable from "../../system/Draggable.svelte"
  import { drop } from "../../helpers/dropSlide"
  import SelectElem from "../../system/SelectElem.svelte"

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
  // $: sortedSlides = sortObject(slides, "label")
</script>

<!-- TODO: tooltips... (Click or drag to add groups) -->

<div class="main">
  {#each sortedSlides as slide, index}
    {#if !children.includes(slide.id)}
      <SelectElem id="slide_group" data={{ id: slide.id, color: slide.color, index }}>
        <Draggable id="slide_group" {index} type="copy">
          <div
            id={slide.id}
            class="slide"
            style="background-color: {slide.color};"
            on:click={(e) => {
              if (!e.ctrlKey) {
                selected.set({ id: "slide_group", elems: [{ id: slide.id, color: slide.color, index }] })
                drop()
                selected.set({ id: null, elems: [] })
              }
            }}
          >
            {slide.label || "—"}
          </div>
        </Draggable>
      </SelectElem>
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
