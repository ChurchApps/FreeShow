<script lang="ts">
  import type { Resolution } from "../../../types/Settings"

  import { shows, activeShow, output, screen } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import Slide from "../slide/Slide.svelte"
  // import { GetLayout } from "../helpers/get"

  let viewWidth: number = window.innerWidth / 3
  let columns: number = 4
  let resolution: Resolution = $shows[$activeShow!.id].settings.resolution || $screen.resolution
  // let zoom = 0.15
  // console.log(elem)

  // = width / main padding - slide padding - extra - gaps?? / columns / resolution
  $: zoom = (viewWidth - 20 - 10 - 1 - (columns - 1) * 10) / columns / resolution.width

  $: id = $activeShow!.id

  $: currentShow = $shows[$activeShow!.id]

  $: layoutSlides = GetLayout($activeShow!.id)
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
</script>

<div class="scroll">
  <div class="grid" bind:offsetWidth={viewWidth}>
    {#if $shows[id] !== undefined}
      <!-- {#each Object.values($shows[id].slides) as slide, i} -->
      {#if layoutSlides.length}
        {#each layoutSlides as slide, i}
          <Slide
            slide={currentShow.slides[slide.id]}
            index={i}
            color={slide.color}
            active={$output.slide?.index === i && $output.slide?.id === id}
            {zoom}
            on:click={() =>
              output.update((o) => {
                o.slide = { id, index: i }
                return o
              })}
          />
        {/each}
      {:else}
        No slides
        <!-- Add slides button -->
      {/if}

      <div style="position: absolute;">
        <button on:click={() => (columns = Math.max(2, columns - 1))}>-</button>
        {columns}
        <button on:click={() => (columns = Math.min(10, columns + 1))}>+</button>
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
  }

  .grid {
    display: flex;
    flex-wrap: wrap;
    /* gap: 10px; */
    padding: 10px;
  }
</style>
