<script lang="ts">
  import type { Resolution } from "../../../types/Settings"
  import { outOverlays, outSlide, overlays, screen, showsCache } from "../../stores"
  import Textbox from "../slide/Textbox.svelte"
  import Zoomed from "../slide/Zoomed.svelte"
  import DropArea from "../system/DropArea.svelte"
  import SelectElem from "../system/SelectElem.svelte"
  import Card from "./Card.svelte"

  // let viewWidth: number = window.innerWidth
  // let columns: number = $slidesOptions.columns
  // let columns: number = 4
  let resolution: Resolution = $outSlide ? $showsCache[$outSlide.id].settings.resolution || $screen.resolution : $screen.resolution

  // $: zoom = (viewWidth - 20 - (columns - 1) * 10) / columns / resolution.width
  // $: ratio = slideWidth / resolution.width
  // let slideWidth: number = 0
  // $: console.log(slideWidth)

  // $: zoom = slideWidth / resolution.width

  $: console.log($overlays)
</script>

<div style="position: relative;height: 100%;">
  <DropArea id="overlays">
    <div class="grid">
      {#each Object.entries($overlays) as [id, overlay]}
        <Card
          class="context #overlay_card"
          active={$outOverlays.includes(id)}
          label={overlay.name || "—"}
          color={overlay.color}
          {resolution}
          on:click={() => {
            outOverlays.update((o) => {
              if ($outOverlays.includes(id)) o.splice($outOverlays.indexOf(id), 1)
              else o.push(id)
              return o
            })
          }}
        >
          <SelectElem id="overlay" data={id} fill draggable>
            <Zoomed {resolution} background={overlay.items.length ? "black" : "transparent"}>
              {#each overlay.items as item}
                <Textbox {item} />
              {/each}
            </Zoomed>
            <!-- <span bind:offsetWidth={slideWidth} style="width: 100%; display: flex;">
        <div style="zoom: {ratio}; {overlay.style}" class="slide">
          {#each overlay.items as item}
            <Textbox {item} />
          {/each}
        </div>
      </span> -->
          </SelectElem>
        </Card>
      {/each}
    </div>
  </DropArea>
</div>

<style>
  .grid {
    display: flex;
    flex-wrap: wrap;
    flex: 1;
    padding: 5px;
    place-content: flex-start;
  }

  /* .slide {
    position: relative;
    background-color: black;
    font-size: 5em;

    width: 100%;
    height: 100%;
    aspect-ratio: 16/9;
  } */
</style>
