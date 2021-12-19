<script lang="ts">
  import { shows, activeShow, activeEdit } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import Slide from "../slide/Slide.svelte"
  import Autoscroll from "../system/Autoscroll.svelte"
  import Center from "../system/Center.svelte"

  // $: editIndex = $output.slide?.index || 0
  $: currentShow = $shows[$activeShow!.id]

  // TODO: change on show change...
  if ($activeEdit.slide === null || $activeEdit.slide >= GetLayout().length) {
    let slide = null
    if ($activeShow && GetLayout().length) {
      if (typeof $activeShow.index === "number") {
        slide = $activeShow.index
        if (slide >= GetLayout().length) slide = 0
      } else slide = 0
    }
    activeEdit.set({ slide, items: [] })
  }
  // activeShow.subscribe(() => {
  //   activeEdit.set({ slide: $activeShow?.index || 0, item: null })
  // })
  $: console.log($activeEdit)

  // let layoutSlides: SlideData[] = []
  // $: layoutSlides = GetLayout($activeShow!.id)
  $: layoutSlides = [$shows[$activeShow!.id].layouts[$shows[$activeShow!.id].settings.activeLayout].slides, GetLayout($activeShow!.id)][1]

  function keydown(e: any) {
    if (!(e.target instanceof HTMLTextAreaElement) && !e.target.closest(".edit")) {
      if (e.key === "ArrowDown") {
        // Arrow Down
        e.preventDefault()
        if ($activeEdit.slide === null) {
          activeEdit.set({ slide: 0, items: [] })
        } else if ($activeEdit.slide < layoutSlides.length - 1) {
          activeEdit.set({ slide: $activeEdit.slide + 1, items: [] })
        }
      } else if (e.key === "ArrowUp") {
        // Arrow Up
        e.preventDefault()
        if ($activeEdit.slide === null) {
          activeEdit.set({ slide: layoutSlides.length - 1, items: [] })
        } else if ($activeEdit.slide > 0) {
          activeEdit.set({ slide: $activeEdit.slide - 1, items: [] })
        }
      }
    }
  }

  let scrollElem: any
  let offset: number = -1
  $: {
    if ($activeEdit.slide !== null) {
      let index = $activeEdit.slide - 1
      setTimeout(() => {
        if (index >= 0) offset = scrollElem.querySelector(".grid").children[index].offsetTop - 5
      }, 10)
    }
  }
</script>

<svelte:window on:keydown={keydown} />

<Autoscroll {offset} bind:scrollElem style={"background-color: var(--primary-darker);"}>
  {#if layoutSlides.length}
    <div class="grid">
      {#each layoutSlides as slide, i}
        <Slide
          slide={currentShow.slides[slide.id]}
          index={i}
          color={slide.color}
          active={$activeEdit.slide === i}
          list={true}
          on:click={(e) => {
            if (!e.ctrlKey) activeEdit.set({ slide: i, items: [] })
          }}
        />
      {/each}
    </div>
  {:else}
    <Center faded>[[[No slides]]]</Center>
  {/if}
</Autoscroll>

<style>
  .grid {
    display: flex;
    flex-wrap: wrap;
    padding: 5px;
  }
</style>
