<script lang="ts">
  // import {flip} from 'svelte/animate';
  // import type { Resolution } from "../../../types/Settings"

  import { activeShow, outLocked, outputs, showsCache, slidesOptions } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import { history } from "../helpers/history"
  import { getActiveOutputs, setOutput } from "../helpers/output"
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
    if (scrollElem && activeOutputs[0]?.out?.slide?.id !== null && $activeShow!.id === activeOutputs[0]?.out?.slide?.id && activeLayout === activeOutputs[0]?.out?.slide?.layout) {
      let columns = $slidesOptions.mode === "grid" ? ($slidesOptions.columns > 2 ? $slidesOptions.columns : 0) : 1
      let index = Math.max(0, activeOutputs[0]?.out?.slide?.index - columns)
      offset = scrollElem.querySelector(".grid")?.children[index]?.offsetTop || 5 - 5

      // TODO: always show active slide....
      // console.log(offset, scrollElem.scrollTop, scrollElem.scrollTop + scrollElem.offsetHeight)
      // if (offset < scrollElem.scrollTop || offset > scrollElem.scrollTop + scrollElem.offsetHeight) offset = scrollElem.querySelector(".grid").children[s.index].offsetTop - 5
    }
  }

  function wheel(e: any) {
    if (e.ctrlKey || e.metaKey) slidesOptions.set({ ...$slidesOptions, columns: Math.max(2, Math.min(10, $slidesOptions.columns + (e.deltaY < 0 ? -100 : 100) / 100)) })
  }

  function slideClick(e: any, index: number) {
    // TODO: duplicate function of "preview:126 - updateOut"
    if ($outLocked || e.ctrlKey || e.metaKey) return

    updateOut("active", index, _show("active").layouts("active").ref()[0], !e.altKey)

    // if (activeOutputs[0]?.out?.slide?.id === id && activeOutputs[0]?.out?.slide?.index === index && activeOutputs[0]?.out?.slide?.layout === activeLayout) return
    // outSlide.set({ id, layout: activeLayout, index })
    setOutput("slide", { id, layout: activeLayout, index })
  }

  // disable slides that is after end (only visual)
  let endIndex: null | number = null
  $: {
    if (layoutSlides.length) {
      let index = layoutSlides.findIndex((a) => a.end === true && a.disabled !== true)
      if (index >= 0) endIndex = index
      else endIndex = null
    } else endIndex = null
  }

  $: if (id && currentShow?.settings.template) {
    // update show by its template
    history({ id: "template", save: false, newData: { template: currentShow.settings.template }, location: { page: "show", show: $activeShow! } })
  }

  let altKeyPressed: boolean = false
  function keydown(e: any) {
    if (e.altKey) {
      e.preventDefault()
      altKeyPressed = true
    }
  }
  function keyup() {
    altKeyPressed = false
  }

  $: activeOutputs = getActiveOutputs($outputs, false)

  let activeSlides: any[] = []
  $: {
    activeSlides = []
    activeOutputs.forEach((a) => {
      let s: any = $outputs[a]?.out?.slide || {}
      // console.log(s, slideIndex, id, activeLayout)
      if (!activeSlides[s.index] && s.id === id && s.layout === activeLayout) {
        activeSlides[s.index] = $outputs[a].color
      }
    })
  }
</script>

<!-- TODO: tab enter not woring -->

<svelte:window on:keydown={keydown} on:keyup={keyup} on:mousedown={keyup} />

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
        <div class="grid context #shows__close">
          <!-- {#each Object.values($showsCache[id].slides) as slide, i} -->
          {#if layoutSlides.length}
            {#each layoutSlides as slide, i}
              {#if currentShow.slides[slide.id]}
                <Slide
                  slide={currentShow.slides[slide.id]}
                  show={currentShow}
                  layoutSlide={slide}
                  index={i}
                  color={slide.color}
                  outColor={activeSlides[i]}
                  active={activeSlides[i] !== undefined}
                  {endIndex}
                  list={$slidesOptions.mode !== "grid"}
                  columns={$slidesOptions.columns}
                  icons
                  {altKeyPressed}
                  on:click={(e) => slideClick(e, i)}
                />
              {/if}
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
