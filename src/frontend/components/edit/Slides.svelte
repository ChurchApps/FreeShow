<script lang="ts">
  import type { Resolution } from "../../../types/Settings"

  import { shows, activeShow, output, screen } from "../../stores"
  import Textbox from "../slide/Textbox.svelte"

  let viewWidth: number = window.innerWidth / 3
  let resolution: Resolution = $shows[$activeShow!.id].settings.resolution || $screen.resolution

  $: zoom = (viewWidth - 20 - 1 * 10) / resolution.width

  $: id = $activeShow!.id

  // get edit slide
  $: Slide = $output.slide
  $: currentShow = $shows[$activeShow!.id]
  $: ShowSlides = currentShow.layouts[currentShow.settings.activeLayout].slides
</script>

<div class="scroll">
  <div class="grid" bind:offsetWidth={viewWidth}>
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
    flex-direction: column;
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
