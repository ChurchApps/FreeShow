<script lang="ts">
  // import {flip} from 'svelte/animate';
  import type { Resolution } from "../../../types/Settings"

  import { shows, activeShow, screen, slidesOptions, outSlide } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import Slide from "../slide/Slide.svelte"
  // import { GetLayout } from "../helpers/get"

  let viewWidth: number = window.innerWidth / 3
  let columns: number = $slidesOptions.columns
  let resolution: Resolution = $shows[$activeShow!.id].settings.resolution || $screen.resolution
  // let zoom = 0.15
  // console.log(elem)

  // = width / main padding - slide padding - extra - columns*gaps/padding / columns / resolution
  $: zoom = (viewWidth - 20 - 0 - 0 - (columns - 1) * (10 + 0)) / columns / resolution.width

  $: id = $activeShow!.id

  $: currentShow = $shows[$activeShow!.id]

  // $: layoutSlides = GetLayout($activeShow!.id)
  $: layoutSlides = [$shows[$activeShow!.id].layouts[$shows[$activeShow!.id].settings.activeLayout].slides, GetLayout($activeShow!.id)][1]
  // // $: ShowSlides = GetLayout(id)?.slides || []
  // let layoutSlides: SlideData[] = []
  // console.log(currentShow)

  // $: {
  //   layoutSlides = []
  //   currentShow.layouts[currentShow.settings.activeLayout].slides.forEach((ls) => {
  //     let slide = currentShow.slides[ls.id]
  //     layoutSlides.push({ ...ls, color: slide.color })
  //     if (slide.children) {
  //       slide.children.forEach((sc) => {
  //         layoutSlides.push({ ...sc, color: slide.color })
  //       })
  //       // layoutSlides = [...layoutSlides, ...slide.children]
  //     }
  //   })
  // }

  $: console.log(layoutSlides)
  $: console.log(currentShow.settings.activeLayout)

  // let groups: string[] = []
  // $: {
  //   groups = []
  //   let prevLabel: null | string = null
  //   layoutSlides.forEach((ls) => {
  //     let slide = currentShow.slides[ls.id]
  //     if (prevLabel !== null && slide.label === null) groups.push(prevLabel)
  //     else groups.push(slide.label || "")
  //     prevLabel = slide.label
  //   })
  // }

  // $: ShowSlides = $shows[id].layouts[$shows[id].settings.activeLayout].slides

  let hovering: null | number = null
  let selected: number[] = []

  let mouseDown: boolean = false
  function mousedown() {
    mouseDown = true
  }
  function mousemove(e: any) {
    if (mouseDown && e.target.closest(".slide") && !selected.includes(Number(e.target.closest(".slide")?.getAttribute("data-index")))) {
      selected = [...selected, Number(e.target.closest(".slide")?.getAttribute("data-index"))]
    }
  }
</script>

<svelte:window
  on:mousedown={(e) => {
    if (!e.ctrlKey && !selected.includes(Number(e.target?.closest(".slide")?.getAttribute("data-index")))) selected = []
  }}
  on:mouseup={() => {
    mouseDown = false
  }}
  on:dragover={() => {
    mouseDown = false
  }}
/>

<!-- TODO: tab enter not woring -->

<div class="scroll" on:mousedown={mousedown} on:mousemove={mousemove}>
  <div class="grid" bind:offsetWidth={viewWidth}>
    {#if $shows[id] !== undefined}
      <!-- {#each Object.values($shows[id].slides) as slide, i} -->
      {#if layoutSlides.length}
        {#each layoutSlides as slide, i}
          <Slide
            slide={currentShow.slides[slide.id]}
            index={i}
            color={slide.color}
            active={$outSlide?.index === i && $outSlide?.id === id}
            list={!$slidesOptions.grid}
            bind:hovering
            bind:selected
            {zoom}
            on:click={(e) => {
              if (!e.ctrlKey) {
                outSlide.set({ id, index: i })
              }
            }}
            on:mousedown={(e) => {
              if (!selected.includes(i)) {
                if (e.ctrlKey) selected = [...selected, i]
                else selected = [i]
              }
            }}
          />
        {/each}
      {:else}
        No slides
        <!-- Add slides button -->
      {/if}

      <div style="position: fixed;">
        <button on:click={() => slidesOptions.set({ ...$slidesOptions, columns: Math.max(2, columns - 1) })}>-</button>
        {columns}
        <button on:click={() => slidesOptions.set({ ...$slidesOptions, columns: Math.min(10, columns + 1) })}>+</button>
        ---
        <button on:click={() => slidesOptions.set({ ...$slidesOptions, grid: !$slidesOptions.grid })}>GRID</button>
      </div>
      <!-- TODO: snap to width! (Select columns instead of manual zoom size) -->
    {:else}
      Error! Could not find show!
    {/if}
  </div>
</div>

<style>
  .scroll {
    overflow-y: auto;
    flex: 1;
  }

  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 10px;
  }
</style>
