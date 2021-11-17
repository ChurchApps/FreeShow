<script lang="ts">
  import type { Resolution } from "../../../types/Settings"

  import { activeShow, outOverlays, overlays, screen, shows } from "../../stores"
  import Textbox from "../slide/Textbox.svelte"

  import Card from "./Card.svelte"
  import Label from "./Label.svelte"

  // let viewWidth: number = window.innerWidth
  // let columns: number = $slidesOptions.columns
  // let columns: number = 4
  let resolution: Resolution = $activeShow ? $shows[$activeShow.id].settings.resolution || $screen.resolution : $screen.resolution

  // $: zoom = (viewWidth - 20 - (columns - 1) * 10) / columns / resolution.width
  $: zoom = slideWidth / resolution.width
  let slideWidth: number = 0
  $: console.log(slideWidth)

  // $: zoom = slideWidth / resolution.width

  $: console.log($overlays)
</script>

{#each Object.entries($overlays) as overlay}
  <Card
    active={$outOverlays.includes(overlay[0])}
    on:click={() => {
      outOverlays.update((o) => {
        if ($outOverlays.includes(overlay[0])) o.splice($outOverlays.indexOf(overlay[0]), 1)
        else o.push(overlay[0])
        return o
      })
    }}
  >
    <span bind:offsetWidth={slideWidth} style="width: 100%; display: flex;">
      <!-- <span style="width: {resolution.width * zoom}px; height: {resolution.height * zoom}px;"> -->
      <div style="zoom: {zoom}; {overlay[1].style}" class="slide">
        {#each overlay[1].items as item}
          <Textbox {item} />
        {/each}
      </div>
      <!-- </span> -->
    </span>

    <Label label={overlay[1].label} color={overlay[1].color} />
  </Card>
{/each}

<style>
  .slide {
    position: relative;
    background-color: black;
    font-size: 5em;

    width: 100%;
    height: 100%;
    aspect-ratio: 16/9;
  }
</style>
