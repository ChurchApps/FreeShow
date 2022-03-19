<script lang="ts">
  import { fade } from "svelte/transition"
  import { OUTPUT } from "../../../types/Channels"
  import type { Resolution } from "../../../types/Settings"
  import type { Transition } from "../../../types/Show"
  import { displayMetadata, outAudio, outBackground, outOverlays, outputWindow, outSlide, overlays, screen, shows } from "../../stores"
  import { receiveData } from "../../utils/request"
  import Draw from "../draw/Draw.svelte"
  import { _show } from "../helpers/shows"
  import Textbox from "../slide/Textbox.svelte"
  import Zoomed from "../slide/Zoomed.svelte"
  import MediaOutput from "./MediaOutput.svelte"

  export let video: any = null
  export let videoData: any = { duration: 0, paused: true, muted: true, loop: false }
  export let videoTime: number = 0
  export let title: string = ""
  export let mirror: boolean = false

  // TODO: showing slide upon clear fade out will show black output (Transition bug!)
  // TODO: dont show transition upon no change!s
  export let transition: Transition = { type: "fade", duration: 500 } // text (not background)
  export let style = ""
  export let center: boolean = false
  export let ratio: number = 0

  let resolution: Resolution = $outSlide && $shows[$outSlide.id].settings?.resolution ? $shows[$outSlide.id].settings.resolution! : $screen.resolution

  const receiveOUTPUT = {
    VIDEO_DATA: (a: any) => {
      videoData = a
      if (a.paused && a.time) videoTime = a.time
      videoData.muted = true
    },
    VIDEO_TIME: (a: number) => {
      // if (!videoData.paused) {
      //   videoData.paused = true
      //   window.api.send(OUTPUT, { channel: "MAIN_CHANGED" })
      //   videoData.paused = false
      // }
      videoTime = a
    },
  }

  if ($outputWindow || mirror) receiveData(OUTPUT, receiveOUTPUT)

  $: console.log($outSlide)

  $: currentLayout = $outSlide ? _show($outSlide.id).layouts([$outSlide.layout]).ref()[0] : []
  $: currentSlide = $outSlide ? _show($outSlide.id).slides([currentLayout![$outSlide.index].id]).get()[0] : null
</script>

<Zoomed {center} {style} {resolution} bind:ratio>
  {#if $outBackground !== null}
    <div style="zoom: {1 / ratio}">
      <MediaOutput {...$outBackground} {transition} bind:video bind:videoData bind:videoTime bind:title {mirror} />
    </div>
  {/if}
  {#if $outSlide}
    {#key $outSlide}
      <span transition:fade={transition} style="pointer-events: none;">
        {#if currentSlide}
          {#each currentSlide?.items as item}
            <Textbox {item} ref={{ showId: $outSlide.id, id: currentSlide.id }} />
          {/each}
        {/if}
      </span>
    {/key}
    {#if $displayMetadata === "always" || ($displayMetadata === "last" && $outSlide.index === currentLayout.length - 1)}
      <span
        transition:fade={transition}
        style="font-size: 50px;text-shadow: 2px 2px 4px rgb(0 0 0 / 80%);position: absolute;left: {resolution.width / 2}px;bottom: 20px;transform: translateX(-50%);"
      >
        {Object.values($shows[$outSlide.id].meta).join("; ")}
      </span>
    {/if}
  {/if}
  {#if $outOverlays.length}
    {#each $outOverlays as id}
      {#if $overlays[id]}
        <div transition:fade={transition}>
          <div>
            {#each $overlays[id].items as item}
              <Textbox {item} ref={{ type: "overlay", id }} />
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  {/if}
  <Draw />
</Zoomed>
{#if $outAudio.length}
  <!--  -->
{/if}
