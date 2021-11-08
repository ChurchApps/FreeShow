<script lang="ts">
  import type { Resolution } from "../../../types/Settings"

  import { shows, activeShow, output, screen, editIndex } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import Slide from "../slide/Slide.svelte"

  let viewWidth: number = window.innerWidth / 3
  let columns: number = 1
  let resolution: Resolution = $shows[$activeShow!.id].settings.resolution || $screen.resolution

  $: zoom = (viewWidth - 20 - 1 - (columns - 1) * 10) / columns / resolution.width

  editIndex.set($output.slide?.index || 0)
  activeShow.subscribe((a) => {
    if (a?.id !== $output.slide?.id) editIndex.set(0)
  })

  // $: editIndex = $output.slide?.index || 0
  $: currentShow = $shows[$activeShow!.id]

  // let layoutSlides: SlideData[] = []
  // $: layoutSlides = GetLayout($activeShow!.id)
  $: layoutSlides = [$shows[$activeShow!.id].layouts[$shows[$activeShow!.id].settings.activeLayout].slides, GetLayout($activeShow!.id)][1]
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
    if (!(e.target instanceof HTMLTextAreaElement) && !e.target.closest(".edit")) {
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
  on:keydown={keydown}
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

<div class="scroll" on:mousedown={mousedown} on:mousemove={mousemove}>
  <div class="grid" bind:offsetWidth={viewWidth}>
    {#each layoutSlides as slide, i}
      <Slide
        slide={currentShow.slides[slide.id]}
        index={i}
        color={slide.color}
        active={$editIndex === i}
        list={true}
        bind:hovering
        bind:selected
        {zoom}
        on:click={(e) => {
          if (!e.ctrlKey) editIndex.set(i)
        }}
        on:mousedown={(e) => {
          if (!selected.includes(i)) {
            if (e.ctrlKey) selected = [...selected, i]
            else selected = [i]
          }
        }}
      />
    {/each}
  </div>
</div>

<style>
  .scroll {
    overflow-y: auto;
    flex: 1;
    background-color: var(--primary-darker);
  }

  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 10px;
  }
</style>
