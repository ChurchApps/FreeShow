<script lang="ts">
  import { createEventDispatcher } from "svelte"
  import type { Resolution } from "../../../../types/Settings"

  import { GetLayout } from "../../helpers/get"
  import Center from "../Center.svelte"

  import Slide from "./ShowSlide.svelte"

  export let outShow: null | any
  export let activeShow: null | any
  export let outSlide: null | number
  let resolution: Resolution = activeShow?.settings.resolution ? activeShow.settings.resolution : { width: 1920, height: 1080 }
  let columns: number = 2

  // $: id = $activeShow!.id
  // $: currentShow = $shows[$activeShow!.id]
  // $: layoutSlides = [$shows[$activeShow!.id].layouts[$shows[$activeShow!.id].settings.activeLayout].slides, GetLayout($activeShow!.id)][1]
  $: layoutSlides = GetLayout(activeShow)

  // auto scroll
  export let scrollElem: any
  $: {
    if (scrollElem && outSlide && outShow?.id === activeShow.id) {
      let index = Math.max(0, outSlide - columns)
      let offset = scrollElem.querySelector(".grid").children[index].offsetTop - scrollElem.offsetTop - 5
      scrollElem.scrollTo(0, offset)
    }
  }

  let dispatch = createEventDispatcher()
  function click(i: number) {
    dispatch("click", i)
  }
</script>

<div class="grid">
  {#if layoutSlides.length}
    {#each layoutSlides as slide, i}
      <Slide
        {resolution}
        slide={activeShow.slides[slide.id]}
        index={i}
        color={slide.color}
        active={outSlide === i && outShow?.id === activeShow.id}
        {columns}
        on:click={() => {
          // if (!$outLocked && !e.ctrlKey) {
          //   outSlide.set({ id, index: i })
          // }
          click(i)
        }}
      />
    {/each}
  {:else}
    <Center faded>[[[No slides]]]</Center>
  {/if}
</div>

<style>
  /* .scroll {
    padding-bottom: 10px;
  } */

  .grid {
    display: flex;
    flex-wrap: wrap;
    /* gap: 10px; */
    padding: 5px;
    height: 100%;
    align-content: flex-start;
  }
</style>
