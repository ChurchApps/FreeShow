<script lang="ts">
  import type { Resolution } from "../../../types/Settings"

  import { activeShow, shows, screen, activeEdit } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import { getStyleResolution } from "../slide/getStyleResolution"
  import Zoomed from "../slide/Zoomed.svelte"
  import Center from "../system/Center.svelte"
  import Textedit from "./Textedit.svelte"

  $: currentShow = $activeShow!.id
  // $: layoutSlides = GetLayout(currentShow)
  // TODO: overlay editor
  $: Slide = $activeEdit.slide !== null ? $shows[currentShow].slides[GetLayout(currentShow)[$activeEdit.slide]?.id] : null

  let helperLines: string[] = []

  let width: number = 0
  let height: number = 0
  let resolution: Resolution = Slide ? $shows[currentShow].settings.resolution! : $screen.resolution
  // TODO: zoom more in...

  let ratio: number = 1
</script>

<div class="parent" bind:offsetWidth={width} bind:offsetHeight={height}>
  {#if Slide}
    <Zoomed style={getStyleResolution(resolution, width, height)} bind:ratio hideOverflow={false} center>
      {#key helperLines}
        {#each helperLines as helperLine}
          <div class="helperLine {helperLine[0]}" style="{helperLine[0] === 'x' ? 'left' : 'top'}: {helperLine.slice(1, helperLine.length)}px;" />
        {/each}
      {/key}
      {#each Slide.items as item, index}
        <Textedit {item} {index} {ratio} bind:helperLines />
      {/each}
    </Zoomed>
  {:else}
    <Center size={2} faded>[[[No slide]]]</Center>
  {/if}
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

  .helperLine {
    position: absolute;
    top: 0;
    left: 0;
    background-color: var(--secondary);
  }
  .helperLine.x {
    width: 2px;
    height: 100%;
  }
  .helperLine.y {
    width: 100%;
    height: 2px;
  }
</style>
