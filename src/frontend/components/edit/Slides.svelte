<script lang="ts">
  import { showsCache, activeShow, activeEdit } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import T from "../helpers/T.svelte"
  import Slide from "../slide/Slide.svelte"
  import Autoscroll from "../system/Autoscroll.svelte"
  import Center from "../system/Center.svelte"

  // $: editIndex = $output.slide?.index || 0
  $: currentShow = $showsCache[$activeShow!.id]

  // TODO: change on show change...
  // if ($activeEdit.slide === null || $activeEdit.slide === undefined || $activeEdit.slide >= GetLayout().length) {
  //   let slide = null
  //   if ($activeShow && GetLayout().length) {
  //     if (typeof $activeShow.index === "number") {
  //       slide = $activeShow.index
  //       if (slide >= GetLayout().length) slide = 0
  //     } else slide = 0
  //   }
  //   activeEdit.set({ slide, items: [] })
  // }

  // activeShow.subscribe(() => {
  //   activeEdit.set({ slide: $activeShow?.index || 0, item: null })
  // })
  $: console.log($activeEdit)

  // let layoutSlides: SlideData[] = []
  // $: layoutSlides = GetLayout($activeShow!.id)
  $: activeLayout = $showsCache[$activeShow!.id]?.settings.activeLayout
  // TODO: not getting parent color at first
  $: layoutSlides = [$showsCache[$activeShow!.id]?.layouts[activeLayout].slides, GetLayout($activeShow!.id)][1]

  function keydown(e: any) {
    if (!(e.target instanceof HTMLTextAreaElement) && !e.target.closest(".edit")) {
      if (e.key === "ArrowDown") {
        // Arrow Down
        e.preventDefault()
        if ($activeEdit.slide === null || $activeEdit.slide === undefined) {
          activeEdit.set({ slide: 0, items: [] })
        } else if ($activeEdit.slide < layoutSlides.length - 1) {
          activeEdit.set({ slide: $activeEdit.slide + 1, items: [] })
        }
      } else if (e.key === "ArrowUp") {
        // Arrow Up
        e.preventDefault()
        if ($activeEdit.slide === null || $activeEdit.slide === undefined) {
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
    if ($activeEdit.slide !== null && $activeEdit.slide !== undefined) {
      let index = $activeEdit.slide - 1
      setTimeout(() => {
        if (index >= 0) offset = scrollElem.querySelector(".grid").children[index].offsetTop - 5
      }, 10)
    }
  }

  let columns: number = 1
  // function mousemove() {
  //   if (scrollElem?.closest(".panel").offsetWidth > 300) columns = 2
  //   else columns = 1
  // }

  function wheel(e: any) {
    if (e.ctrlKey) columns = Math.max(1, Math.min(10, columns + e.deltaY / 100))
    // if (e.ctrlKey) slidesOptions.set({ ...$slidesOptions, columns: Math.max(1, Math.min(10, $slidesOptions.columns + e.deltaY / 100)) })
  }
</script>

<svelte:window on:keydown={keydown} />

<Autoscroll {offset} bind:scrollElem style="display: flex;background-color: var(--primary-darker);">
  {#if layoutSlides.length}
    <div class="grid" on:wheel={wheel}>
      {#each layoutSlides as slide, i}
        <Slide
          slide={currentShow.slides[slide.id]}
          show={currentShow}
          layoutSlide={slide}
          index={i}
          color={slide.color}
          active={$activeEdit.slide === i}
          noQuickEdit
          {columns}
          on:click={(e) => {
            if (!e.ctrlKey) activeEdit.set({ slide: i, items: [] })
          }}
        />
      {/each}
    </div>
  {:else}
    <Center faded>
      <T id="empty.slides" />
    </Center>
  {/if}
</Autoscroll>

<style>
  .grid {
    display: flex;
    flex-wrap: wrap;
    padding: 5px;
    width: 100%;
    align-content: flex-start;
  }
</style>
