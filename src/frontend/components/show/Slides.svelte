<script lang="ts">
  // import {flip} from 'svelte/animate';
  // import type { Resolution } from "../../../types/Settings"

  import { shows, activeShow, slidesOptions, outSlide, activeEdit, outLocked, outBackground, outTransition, outOverlays } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import Slide from "../slide/Slide.svelte"
  import DropArea from "../system/DropArea.svelte"
  import Center from "../system/Center.svelte"
  import Autoscroll from "../system/Autoscroll.svelte"
  // import { GetLayout } from "../helpers/get"

  // let viewWidth: number = window.innerWidth / 3
  // let resolution: Resolution = $shows[$activeShow!.id].settings.resolution || $screen.resolution
  // let zoom = 0.15
  // console.log(elem)

  // = width / main padding - slide padding - extra - columns*gaps/padding / columns / resolution
  // $: zoom = (viewWidth - 20 - 0 - 0 - ($slidesOptions.columns - 1) * (10 + 0)) / $slidesOptions.columns / resolution.width
  $: id = $activeShow!.id
  $: currentShow = $shows[$activeShow!.id]
  $: activeLayout = $shows[$activeShow!.id].settings.activeLayout
  // $: layoutSlides = GetLayout($activeShow!.id, activeLayout)
  $: layoutSlides = [$shows[$activeShow!.id].layouts[activeLayout].slides, GetLayout($activeShow!.id)][1]

  let scrollElem: any
  let offset: number = -1
  // let behaviour: string = ""
  // setTimeout(() => (behaviour = "scroll-behavior: smooth;"), 50)
  $: {
    if (scrollElem && $outSlide !== null && $activeShow!.id === $outSlide?.id && activeLayout === $outSlide?.layout) {
      let index = Math.max(0, $outSlide.index - ($slidesOptions.columns > 2 ? $slidesOptions.columns : 0))
      offset = scrollElem.querySelector(".grid").children[index].offsetTop - 5

      // TODO: always show active slide....
      // console.log(offset, scrollElem.scrollTop, scrollElem.scrollTop + scrollElem.offsetHeight)
      // if (offset < scrollElem.scrollTop || offset > scrollElem.scrollTop + scrollElem.offsetHeight) offset = scrollElem.querySelector(".grid").children[s.index].offsetTop - 5
    }
  }

  function wheel(e: any) {
    if (e.ctrlKey) slidesOptions.set({ ...$slidesOptions, columns: Math.max(1, Math.min(10, $slidesOptions.columns + e.deltaY / 100)) })
  }

  function slideClick(e: any, slide: any, index: number) {
    // TODO: duplicate function of "preview:126 - updateOut"
    if (!$outLocked && !e.ctrlKey) {
      outSlide.set({ id, layout: activeLayout, index })

      activeEdit.set({ slide: index, items: [] })

      // background
      if (slide.background) {
        let bg = currentShow.backgrounds[slide.background]
        outBackground.set({ type: bg.type || "media", path: bg.path, muted: bg.muted !== false, loop: bg.loop !== false })
      }

      // overlays
      if (slide.overlays?.length) {
        outOverlays.set([...new Set([...$outOverlays, ...slide.overlays])])
      }

      // transition
      let t = slide.transition
      if (t && t.duration > 0) {
        t.action = "nextSlide"
        outTransition.set(t)
      } else outTransition.set(null)
    }
  }

  // disable slides that is after end (only visual)
  let endIndex: null | number = null
  $: {
    if (layoutSlides.length) {
      let index = layoutSlides.findIndex((a) => a.end === true)
      if (index >= 0) endIndex = index
      else endIndex = null
    } else endIndex = null
  }
</script>

<!-- TODO: tab enter not woring -->

<Autoscroll on:wheel={wheel} {offset} bind:scrollElem style="display: flex;">
  <!-- on:drop={(e) => {
      if (selected.length && e.dataTransfer && ($dragged === "slide" || $dragged === "slideGroup")) drop(e.dataTransfer.getData("text"))
    }}
    on:dragover|preventDefault -->
  <DropArea id="slides" selectChildren>
    {#if $shows[id] === undefined}
      <Center faded>Error! Could not find show!</Center>
    {:else}
      <div class="grid">
        <!-- {#each Object.values($shows[id].slides) as slide, i} -->
        {#if layoutSlides.length}
          {#each layoutSlides as slide, i}
            <Slide
              slide={currentShow.slides[slide.id]}
              show={currentShow}
              layoutSlide={slide}
              index={i}
              color={slide.color}
              active={$outSlide?.index === i && $outSlide?.id === id && $outSlide?.layout === activeLayout}
              {endIndex}
              list={!$slidesOptions.grid}
              columns={$slidesOptions.columns}
              on:click={(e) => slideClick(e, slide, i)}
            />
          {/each}
        {:else}
          <Center faded size={2}>
            [[[No slides]]]
            <!-- Add slides button -->
          </Center>
        {/if}

        <!-- TODO: snap to width! (Select columns instead of manual zoom size) -->
      </div>
    {/if}
  </DropArea>
</Autoscroll>

<style>
  /* .scroll {
    padding-bottom: 10px;
  } */

  .grid {
    display: flex;
    flex-wrap: wrap;
    /* gap: 10px; */
    padding: 5px;
    /* height: 100%; */
    /* align-content: flex-start; */
  }
</style>
