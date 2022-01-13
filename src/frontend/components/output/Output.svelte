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
  import Draw from "../draw/Draw.svelte"

  export let video: any = null
  export let videoData: any = { duration: 0, paused: true, muted: true }
  export let videoTime: number = 0

  let resolution: Resolution = $outSlide && $shows[$outSlide.id].settings.resolution ? $shows[$outSlide.id].settings.resolution! : $screen.resolution

  if ($outputWindow) {
    window.api.receive(OUTPUT, (msg: any) => {
      if (msg.channel === "VIDEO_DATA") {
        videoData = msg.data
        if (videoData.paused && videoData.time) videoTime = videoData.time
        videoData.muted = true
      } else if (msg.channel === "VIDEO_TIME") {
        // if (!videoData.paused) {
        //   videoData.paused = true
        //   videoTime = msg.data
        //   window.api.send(OUTPUT, { channel: "MAIN_CHANGED" })
        //   videoData.paused = false
        // } else {
        videoTime = msg.data
        // }
      }
      // else if (msg.channel === "CHANGED") videoData.paused = false
    })
  } else {
    window.api.receive(OUTPUT, (msg: any) => {
      if (msg.channel === "MAIN_CHANGED") {
        // window.api.send(OUTPUT, { channel: "CHANGED" })
        // videoData.paused = false
      }
    })
  }

  export let transition: Transition = { type: "fade", duration: 500 } // text (not background)
  // TODO: showing slide upon clear fade out will show black output (Transition bug!)
  // TODO: dont show transition upon no change!s

  export let style = ""
  export let center: boolean = false

  export let ratio: number = 0
</script>

<Zoomed {center} {style} {resolution} bind:ratio>
  {#if $outBackground !== null}
    <!-- {#key $outBackground} -->
    <div style="zoom: {1 / ratio}">
      <MediaOutput {...$outBackground} {transition} bind:video bind:videoData bind:videoTime />
    </div>
    <!-- {/key} -->
  {/if}
  {#if $outSlide}
    {#key $outSlide}
      <span transition:fade={transition} style="pointer-events: none;">
        <!-- {#each Object.values($shows[$activeShow.id].slides[Slide.id]) as item} -->
        <!-- {#each Object.values(GetShows().active().slides) as item} -->
        <!-- {#each Object.values(getSlide($activeShow.id, Slide.id)) as item} -->
        <!-- {#each GetShows().active.slides[GetActiveLayout().slides[Slide.index].id].items as item} -->
        {#if getSlide($outSlide)}
          {#each getSlide($outSlide)?.items as item}
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
  <Draw />
</Zoomed>
{#if $outAudio.length}
  <!--  -->
{/if}
