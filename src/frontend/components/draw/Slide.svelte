<script lang="ts">
  import type { Resolution } from "../../../types/Settings"
  import { activeShow, shows, screen, outSlide, draw, drawTool, drawSettings } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import Output from "../output/Output.svelte"
  import { getStyleResolution } from "../slide/getStyleResolution"

  $: Slide = $outSlide !== null && $activeShow !== null ? $shows[$activeShow.id].slides[GetLayout($activeShow.id)[$outSlide.index]?.id] : null

  let width: number = 0
  let height: number = 0
  let resolution: Resolution = Slide && $activeShow !== null ? $shows[$activeShow.id].settings.resolution! : $screen.resolution
  // TODO: zoom more in...

  let ratio: number = 0

  let parent: any
  function move(e: any) {
    if ((e.buttons || !$drawSettings[$drawTool].hold) && e.target.closest(".parent") === parent && e.target.closest(".slide") !== null) {
      let slide = e.target.closest(".slide")
      let x = (e.clientX - slide.offsetLeft - (slide.closest(".parent").offsetLeft || 0)) / ratio
      let y = (e.clientY - slide.offsetTop - (slide.closest(".parent").offsetTop || 0)) / ratio
      if ($drawTool === "pointer" || $drawTool === "focus") {
        let size = $drawSettings[$drawTool].size
        x -= size / 2
        y -= size / 2
      }

      draw.set({ x, y })
    } else draw.set(null)
  }

  const wheel = (e: any) => {
    if (draw !== null && $drawSettings[$drawTool].size && e.target.closest(".parent") === parent && e.target.closest(".slide") !== null) {
      drawSettings.update((ds) => {
        ds[$drawTool].size -= e.deltaY / (e.ctrlKey ? 10 : e.altKey ? 100 : 25)
        if (ds[$drawTool].size < 0) ds[$drawTool].size = 0
        else if (ds[$drawTool].size > 2000) ds[$drawTool].size = 2000
        return ds
      })
    }
  }
</script>

<svelte:window
  on:mouseup={() => {
    if ($drawSettings[$drawTool].hold) draw.set(null)
  }}
  on:mousemove={move}
/>

<div class="parent" bind:this={parent} bind:offsetWidth={width} bind:offsetHeight={height}>
  <div style="width: 100%; height: 100%;" on:mousedown={move} on:wheel={wheel}>
    <Output bind:ratio center style={getStyleResolution(resolution, width, height)} transition={{ type: "fade", duration: 0 }} />
  </div>
</div>

<style>
  .parent {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px;

    overflow: auto;
  }
</style>
