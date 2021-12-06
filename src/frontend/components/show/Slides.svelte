<script lang="ts">
  // import {flip} from 'svelte/animate';
  import type { Resolution } from "../../../types/Settings"

  import { shows, activeShow, screen, slidesOptions, outSlide } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import Slide from "../slide/Slide.svelte"
  import DropArea from "../system/DropArea.svelte"
  import SelectElem from "../system/SelectElem.svelte"
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
  $: layoutSlides = [$shows[$activeShow!.id].layouts[$shows[$activeShow!.id].settings.activeLayout].slides, GetLayout($activeShow!.id)][1]
</script>

<!-- TODO: tab enter not woring -->

<div class="scroll">
  <!-- on:drop={(e) => {
    if (selected.length && e.dataTransfer && ($dragged === "slide" || $dragged === "slideGroup")) drop(e.dataTransfer.getData("text"))
  }}
  on:dragover|preventDefault -->
  <DropArea id="slides">
    {#if $shows[id] === undefined}
      <div class="center">Error! Could not find show!</div>
    {:else}
      <div class="grid" bind:offsetWidth={viewWidth}>
        <!-- {#each Object.values($shows[id].slides) as slide, i} -->
        {#if layoutSlides.length}
          {#each layoutSlides as slide, i}
            <SelectElem id="slide" data={i}>
              <Slide
                slide={currentShow.slides[slide.id]}
                index={i}
                color={slide.color}
                active={$outSlide?.index === i && $outSlide?.id === id}
                list={!$slidesOptions.grid}
                {zoom}
                on:click={(e) => {
                  if (!e.ctrlKey) {
                    outSlide.set({ id, index: i })
                  }
                }}
              />
            </SelectElem>
          {/each}
        {:else}
          <div class="center">
            No slides
            <!-- Add slides button -->
          </div>
        {/if}

        <div style="position: fixed;">
          <button on:click={() => slidesOptions.set({ ...$slidesOptions, columns: Math.max(2, columns - 1) })}>-</button>
          {columns}
          <button on:click={() => slidesOptions.set({ ...$slidesOptions, columns: Math.min(10, columns + 1) })}>+</button>
          ---
          <button on:click={() => slidesOptions.set({ ...$slidesOptions, grid: !$slidesOptions.grid })}>GRID</button>
        </div>
        <!-- TODO: snap to width! (Select columns instead of manual zoom size) -->
      </div>
    {/if}
  </DropArea>
</div>

<style>
  .scroll {
    overflow-y: auto;
    flex: 1;
    /* padding-bottom: 10px; */
  }

  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 10px;
    height: 100%;
    align-content: flex-start;
  }

  .center {
    display: flex;
    height: 100%;
    flex: 1;
    align-items: center;
    justify-content: center;
  }
</style>
