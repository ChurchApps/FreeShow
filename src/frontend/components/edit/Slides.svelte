<script lang="ts">
  import type { Resolution } from "../../../types/Settings"

  import { shows, activeShow, output, screen, editIndex } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import Slide from "../slide/Slide.svelte"

  let viewWidth: number = window.innerWidth / 3
  let columns: number = 1
  let resolution: Resolution = $shows[$activeShow!.id].settings.resolution || $screen.resolution

  $: zoom = (viewWidth - 20 - 10 - 1 - (columns - 1) * 10) / columns / resolution.width

  editIndex.set($output.slide?.index || 0)
  activeShow.subscribe((a) => {
    if (a?.id !== $output.slide?.id) editIndex.set(0)
  })

  // $: editIndex = $output.slide?.index || 0
  $: currentShow = $shows[$activeShow!.id]

  // let layoutSlides: SlideData[] = []
  $: layoutSlides = GetLayout($activeShow!.id)
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

  function keydown(e: any) {
    if (!(e.target instanceof HTMLTextAreaElement)) {
      if (e.key === "ArrowDown") {
        // Arrow Down
        e.preventDefault()
        if ($editIndex < layoutSlides.length - 1) {
          editIndex.set($editIndex + 1)
        }
      } else if (e.key === "ArrowUp") {
        // Arrow Up
        e.preventDefault()
        if ($editIndex > 0) {
          editIndex.set($editIndex - 1)
        }
      }
    }
  }
</script>

<svelte:window on:keydown={keydown} />

<div class="scroll">
  <div class="grid" bind:offsetWidth={viewWidth}>
    {#each layoutSlides as slide, i}
      <Slide
        slide={currentShow.slides[slide.id]}
        index={i}
        color={slide.color}
        active={$editIndex === i}
        {zoom}
        on:click={() => {
          editIndex.set(i)
        }}
      />
    {/each}
  </div>
</div>

<style>
  .scroll {
    overflow-y: auto;
  }

  .grid {
    display: flex;
    flex-wrap: wrap;
    padding: 10px;
  }
</style>
