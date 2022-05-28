<script lang="ts">
  import { fade } from "svelte/transition"
  import { OUTPUT } from "../../../types/Channels"
  import type { Transition, TransitionType } from "../../../types/Show"
  import { displayMetadata, outAudio, outBackground, outOverlays, currentWindow, outSlide, overlays, screen, showsCache, transitionData, backgroundColor } from "../../stores"
  import { receive } from "../../utils/request"
  import { transitions } from "../../utils/transitions"
  import Draw from "../draw/Draw.svelte"
  import { _show } from "../helpers/shows"
  import Textbox from "../slide/Textbox.svelte"
  import Zoomed from "../slide/Zoomed.svelte"
  import MediaOutput from "./MediaOutput.svelte"

  export let video: any = null
  export let videoData: any = { duration: 0, paused: true, muted: false, loop: false }
  export let videoTime: number = 0
  export let title: string = ""
  export let mirror: boolean = false

  // TODO: showing slide upon clear fade out will show black output (Transition bug!)
  // TODO: dont show transition upon no change!s
  export let transition: Transition = $transitionData.text
  export let mediaTransition: Transition = $transitionData.media
  export let style = ""
  export let center: boolean = false
  export let ratio: number = 0

  $: slideTransition = $showsCache && $outSlide && $outSlide.id !== "temp" ? _show($outSlide.id).layouts("active").ref()[0]?.[$outSlide.index!]?.data.transition : null
  $: transition = slideTransition ? slideTransition : $transitionData.text
  $: mediaTransition = $transitionData.media

  const receiveOUTPUT = {
    VIDEO_DATA: (a: any) => {
      videoData = a
      if (a.paused && a.time) videoTime = a.time
    },
    VIDEO_TIME: (a: number) => {
      // if (!videoData.paused) {
      //   videoData.paused = true
      //   window.api.send(OUTPUT, { channel: "MAIN_CHANGED" })
      //   videoData.paused = false
      // }
      videoTime = a
    },
    BACKGROUND: (a: any) => {
      if (a?.muted) videoData.muted = a.muted
      if (a?.loop) videoData.loop = a.loop
    },
  }

  if ($currentWindow === "output" || mirror) receive(OUTPUT, receiveOUTPUT)

  $: currentLayout = $outSlide ? _show($outSlide.id).layouts([$outSlide.layout]).ref()[0] : []
  $: currentSlide = $outSlide ? ($outSlide.id === "temp" ? { items: $outSlide.tempItems } : _show($outSlide.id).slides([currentLayout![$outSlide.index!].id]).get()[0]) : null

  $: resolution = currentSlide?.settings?.resolution || $screen.resolution

  function custom(node: any, { type = "fade", duration = 500 }: any) {
    return { ...transitions[type as TransitionType](node), duration: type === "none" ? 0 : duration }
  }
</script>

<Zoomed background={currentSlide?.settings?.color || $backgroundColor || "black"} {center} {style} {resolution} bind:ratio>
  {#if $outBackground !== null}
    <div style="zoom: {1 / ratio}">
      <MediaOutput {...$outBackground} transition={mediaTransition} bind:video bind:videoData bind:videoTime bind:title {mirror} />
    </div>
  {/if}
  {#if $outSlide}
    {#key $outSlide}
      <span transition:custom={transition} style="pointer-events: none;display: block;">
        {#if currentSlide}
          {#each currentSlide?.items as item}
            <Textbox {item} {ratio} ref={{ showId: $outSlide.id, id: currentSlide.id }} />
          {/each}
        {/if}
      </span>
    {/key}
    {#if $displayMetadata === "always" || ($displayMetadata.includes("first") && $outSlide.index === 0) || ($displayMetadata.includes("last") && $outSlide.index === currentLayout.length - 1)}
      <span
        transition:custom={transition}
        style="font-size: 30px;text-shadow: 2px 2px 4px rgb(0 0 0 / 80%);position: absolute;left: {resolution.width / 2}px;bottom: 20px;transform: translateX(-50%);opacity: 0.8;"
      >
        {Object.values($showsCache[$outSlide.id].meta || {})
          .filter((a) => a.length)
          .join("; ")}
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
