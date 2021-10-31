<script lang="ts">
  import type { Resolution } from "../../../types/Settings"

  import { activeShow, shows, screen, editIndex, output } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import Textedit from "./Textedit.svelte"

  let slideWidth: number = 300
  $: currentShow = $activeShow!.id
  $: layoutSlides = GetLayout(currentShow)
  $: Slide = $shows[currentShow].slides[layoutSlides[$editIndex].id]

  let helperLines: string[] = []

  let resolution: Resolution = Slide ? $shows[$output.slide!.id].settings.resolution! : $screen.resolution
  $: zoom = slideWidth / resolution.width

  let elemWidth: number = 500
  let elemHeight: number = 300
  $: size = Math.min(resolution.width / elemWidth, elemWidth / resolution.width) > Math.min(resolution.height / elemHeight, elemHeight / resolution.height) ? "height" : "width"
  console.log(Math.min(resolution.width / elemWidth, elemWidth / resolution.width), Math.min(resolution.height / elemHeight, elemHeight / resolution.height))
  // TODO: width: 100% ......, fixed height!
</script>

<div class="parent" bind:offsetWidth={elemWidth} bind:offsetHeight={elemHeight}>
  <div bind:offsetWidth={slideWidth} class="slide" style="{size}: 100%">
    {#if Slide}
      <span style="zoom: {zoom};">
        {#key helperLines}
          {#each helperLines as helperLine}
            <div class="helperLine {helperLine[0]}" style="{helperLine[0] === 'x' ? 'left' : 'top'}: {helperLine.slice(1, helperLine.length)}px;" />
          {/each}
        {/key}
        {#each Slide.items as item, index}
          <Textedit {item} {index} {zoom} bind:helperLines />
        {/each}
      </span>
    {/if}
  </div>
</div>

<style>
  .parent {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    padding: 10px;
  }

  .slide {
    aspect-ratio: 16/9;
    position: relative;
    background-color: black;
    /* width: 1920px;
    height: 1080px; */
    font-size: 5em;
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
