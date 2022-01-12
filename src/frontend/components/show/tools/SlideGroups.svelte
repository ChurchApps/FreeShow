<script lang="ts">
  import { activeShow, selected, shows } from "../../../stores"
  import type { Slide } from "../../../../types/Show"
  import Draggable from "../../system/Draggable.svelte"
  import SelectElem from "../../system/SelectElem.svelte"
  import { ondrop } from "../../helpers/drop"

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
  $: sortedSlides = slides.filter((a) => a.label !== null).sort((a, b) => a.label!.localeCompare(b.label!))
</script>

<!-- TODO: tooltips... (Click or drag to add groups) -->

<div class="main">
  {#each sortedSlides as slide}
    {#if !children.includes(slide.id)}
      <SelectElem id="slide_group" data={{ id: slide.id }}>
        <Draggable type="copy">
          <div
            id={slide.id}
            class="slide"
            style="background-color: {slide.color};"
            on:click={(e) => {
              if (!e.ctrlKey) {
                selected.set({ id: "slide_group", elems: [{ id: slide.id }] })
                // drop(index)
                ondrop(null, "slide")
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
