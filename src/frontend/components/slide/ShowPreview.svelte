<script lang="ts">
  import type { Resolution } from "../../../types/Settings"

  import { shows, activeShow, output, screen } from "../../stores"
  // import { GetLayout } from "../helpers/get"
  import Textbox from "../slide/Textbox.svelte"

  export let editor: boolean = false

  let viewWidth: number = window.innerWidth / 3
  let columns: number = editor ? 1 : 4
  let resolution: Resolution = $shows[$activeShow!.id].settings.resolution || $screen.resolution
  // let zoom = 0.15
  // console.log(elem)

  $: zoom = (viewWidth - 20 - 1 - (columns - 1) * 10) / columns / resolution.width

  $: id = $activeShow!.id
  // let type =

  $: Slide = $output.slide
  $: currentShow = $shows[$activeShow!.id]
  // $: ShowSlides = GetLayout(id)?.slides || []
  $: ShowSlides = currentShow.layouts[currentShow.settings.activeLayout].slides
  $: console.log(ShowSlides)
  $: console.log(currentShow.settings.activeLayout)

  // $: ShowSlides = $shows[id].layouts[$shows[id].settings.activeLayout].slides
</script>

<div class="scroll">
  <div class="grid" bind:offsetWidth={viewWidth} style={editor ? "flex-direction: column;" : ""}>
    {#if $shows[id] !== undefined}
      <!-- {#each Object.values($shows[id].slides) as slide, i} -->
      {#if ShowSlides.length}
        {#each ShowSlides as slide, i}
          <!-- {console.log()} -->
          <!-- TODO: tab select on enter -->
          <div
            class="slide {Slide?.index === i && Slide?.id === id ? 'active' : ''}"
            style="width: {resolution.width * zoom}px; height: {resolution.height * zoom}px;"
            tabindex={0}
            on:click={() =>
              output.update((o) => {
                o.slide = { id, index: i }
                return o
              })}
          >
            <span style="zoom: {zoom};">
              <!-- TODO: check if showid exists in shows -->
              {#each $shows[id].slides[slide.id].items as item}
                <Textbox {item} />
              {/each}
            </span>
          </div>
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
    --gap: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap);
    padding: var(--gap);
  }

  .slide {
    position: relative;
    background-color: black;
    width: 1920px;
    height: 1080px;
    font-size: 5em;
  }
  .slide.active {
    outline: 2px solid var(--secondary);
    outline-offset: 4px;
  }
</style>
