<script lang="ts">
  // import {flip} from 'svelte/animate';
  // import type { Resolution } from "../../../types/Settings"

  import { activeShow, outLocked, outSlide, showsCache, slidesOptions } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import { history } from "../helpers/history"
  import { updateOut } from "../helpers/showActions"
  import { _show } from "../helpers/shows"
  import T from "../helpers/T.svelte"
  import Slide from "../slide/Slide.svelte"
  import Autoscroll from "../system/Autoscroll.svelte"
  import Center from "../system/Center.svelte"
  import DropArea from "../system/DropArea.svelte"
  // import { GetLayout } from "../helpers/get"

  // let viewWidth: number = window.innerWidth / 3
  // let resolution: Resolution = $showsCache[$activeShow!.id].settings.resolution || $screen.resolution
  // let zoom = 0.15
  // console.log(elem)

  // = width / main padding - slide padding - extra - columns*gaps/padding / columns / resolution
  // $: zoom = (viewWidth - 20 - 0 - 0 - ($slidesOptions.columns - 1) * (10 + 0)) / $slidesOptions.columns / resolution.width
  $: id = $activeShow!.id
  $: currentShow = $showsCache[$activeShow!.id]
  $: activeLayout = $showsCache[$activeShow!.id]?.settings?.activeLayout
  // $: layoutSlides = GetLayout($activeShow!.id, activeLayout)
  $: layoutSlides = [$showsCache[$activeShow!.id]?.layouts?.[activeLayout].slides, GetLayout($activeShow!.id)][1]

  let scrollElem: any
  let offset: number = -1
  // let behaviour: string = ""
  // setTimeout(() => (behaviour = "scroll-behavior: smooth;"), 50)
  $: {
    if (scrollElem && $outSlide !== null && $activeShow!.id === $outSlide?.id && activeLayout === $outSlide?.layout) {
      let columns = $slidesOptions.mode === "grid" ? ($slidesOptions.columns > 2 ? $slidesOptions.columns : 0) : 1
      let index = Math.max(0, $outSlide.index - columns)
      offset = scrollElem.querySelector(".grid")?.children[index]?.offsetTop || 5 - 5

      // TODO: always show active slide....
      // console.log(offset, scrollElem.scrollTop, scrollElem.scrollTop + scrollElem.offsetHeight)
      // if (offset < scrollElem.scrollTop || offset > scrollElem.scrollTop + scrollElem.offsetHeight) offset = scrollElem.querySelector(".grid").children[s.index].offsetTop - 5
    }
  }

  function wheel(e: any) {
    if (e.ctrlKey || e.metaKey) slidesOptions.set({ ...$slidesOptions, columns: Math.max(2, Math.min(10, $slidesOptions.columns + e.deltaY / 100)) })
  }

  function slideClick(e: any, index: number) {
    // TODO: duplicate function of "preview:126 - updateOut"
    if (!$outLocked && !e.ctrlKey && !e.metaKey) {
      outSlide.set({ id, layout: activeLayout, index })
      updateOut(index, _show("active").layouts("active").ref()[0], !e.altKey)
      // _show(id).set({ key: "timestamps.used", value: new Date().getTime() })

      // activeEdit.set({ slide: index, items: [] })

      // // background
      // if (slide.background) {
      //   let bg = currentShow.media[slide.background]
      //   outBackground.set({ type: bg.type || "media", path: bg.path, muted: bg.muted !== false, loop: bg.loop !== false })
      // }

      // // overlays
      // if (slide.overlays?.length) {
      //   outOverlays.set([...new Set([...$outOverlays, ...slide.overlays])])
      // }

      // // transition
      // let t = slide.transition
      // if (t && t.duration > 0) {
      //   t.action = "nextSlide"
      //   outTransition.set(t)
      // } else outTransition.set(null)
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

  $: if (id && currentShow?.settings.template) {
    // update show by its template
    history({ id: "template", save: false, newData: { template: currentShow.settings.template }, location: { page: "show", show: $activeShow! } })
  }
</script>

<!-- TODO: tab enter not woring -->

<Autoscroll on:wheel={wheel} {offset} bind:scrollElem style="display: flex;">
  <!-- on:drop={(e) => {
      if (selected.length && e.dataTransfer && ($dragged === "slide" || $dragged === "slideGroup")) drop(e.dataTransfer.getData("text"))
    }}
    on:dragover|preventDefault -->
  <DropArea id="all_slides" selectChildren>
    <DropArea id="slides" hoverTimeout={0} selectChildren>
      {#if $showsCache[id] === undefined}
        <Center faded>
          <T id="error.no_show" />
        </Center>
      {:else}
        <div class="grid context #shows">
          <!-- {#each Object.values($showsCache[id].slides) as slide, i} -->
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
                list={$slidesOptions.mode !== "grid"}
                columns={$slidesOptions.columns}
                icons
                on:click={(e) => slideClick(e, i)}
              />
            {/each}
          {:else}
            <Center faded absolute size={2}>
              <T id="empty.slides" />
              <!-- Add slides button -->
            </Center>
          {/if}

          <!-- TODO: snap to width! (Select columns instead of manual zoom size) -->
        </div>
      {/if}
    </DropArea>
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
