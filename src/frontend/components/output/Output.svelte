<script lang="ts">
  import { outputWindow, outBackground, outSlide, outOverlays, outAudio, overlays, shows, screen } from "../../stores"
  import Textbox from "../slide/Textbox.svelte"
  import { fade } from "svelte/transition"
  import { getSlide } from "../helpers/get"
  import MediaOutput from "./MediaOutput.svelte"
  import type { Transition } from "../../../types/Show"
  import { OUTPUT } from "../../../types/Channels"
  import Zoomed from "../slide/Zoomed.svelte"
  import type { Resolution } from "../../../types/Settings"

  export let video: any = null
  export let videoData: any = { time: 0, duration: 0, paused: true }

  let resolution: Resolution = $outSlide && $shows[$outSlide.id].settings.resolution ? $shows[$outSlide.id].settings.resolution! : $screen.resolution

  if ($outputWindow) {
    window.api.receive(OUTPUT, (msg: any) => {
      if (msg.channel === "VIDEO_DATA") videoData = msg.data
    })
  }

  let transition: Transition = { type: "fade", duration: 500 } // text (not background)
  // TODO: showing slide upon clear fade out will show black output (Transition bug!)
  // TODO: dont show transition upon no change!s

  export let style = ""
  export let center: boolean = false
</script>

<Zoomed {center} {style} {resolution} zoom={$outBackground === null}>
  {#if $outBackground !== null}
    <!-- {#key $outBackground} -->
    <MediaOutput {...$outBackground} {transition} bind:video bind:videoData />
    <!-- {/key} -->
  {/if}
  {#if $outSlide}
    {#key $outSlide}
      <span transition:fade={transition}>
        <!-- {#each Object.values($shows[$activeShow.id].slides[Slide.id]) as item} -->
        <!-- {#each Object.values(GetShows().active().slides) as item} -->
        <!-- {#each Object.values(getSlide($activeShow.id, Slide.id)) as item} -->
        <!-- {#each GetShows().active.slides[GetActiveLayout().slides[Slide.index].id].items as item} -->
        {#if getSlide($outSlide.id, $outSlide.index)}
          {#each getSlide($outSlide.id, $outSlide.index)?.items as item}
            <Textbox {item} />
          {/each}
        {/if}
      </span>
    {/key}
  {/if}
  {#if $outOverlays.length}
    {#each $outOverlays as id}
      <div style={$overlays[id].style} transition:fade={transition}>
        <div>
          {#each $overlays[id].items as item}
            <Textbox {item} />
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</Zoomed>
{#if $outAudio.length}
  <!--  -->
{/if}
