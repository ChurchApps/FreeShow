<script>
  import { activeShow, shows, screen } from "../../stores"
  import Textbox from "../slide/Textbox.svelte"

  export let seIndex
  console.log($shows[$activeShow?.id])
  $: slide = $shows[$activeShow?.id]?.slides[seIndex]

  let resolution = slide ? $shows[$activeShow.id].show.resolution : $screen.resolution
  let zoom = 0.3
</script>

<div class="slide" style="width: {resolution.width * zoom}px; height: {resolution.height * zoom}px;">
  {#if slide}
    <span style="zoom: {zoom};">
      {#each $shows[$activeShow.id].slides[seIndex].items as item}
        <Textbox {item} />
      {/each}
    </span>
  {/if}
</div>

<style>
  .slide {
    position: relative;
    background-color: black;
    width: 1920px;
    height: 1080px;
    font-size: 5em;
  }
</style>
