<script lang="ts">
  import type { Resolution } from "../../../types/Settings"
  import { activePage, activeShow, outAudio, outBackground, outLocked, outOverlays, outSlide, outTransition, screen } from "../../stores"
  import { nextSlide, previousSlide } from "../helpers/showActions"
  import T from "../helpers/T.svelte"
  import { getStyleResolution } from "../slide/getStyleResolution"
  import AudioMeter from "./AudioMeter.svelte"
  import ClearButtons from "./ClearButtons.svelte"
  import Output from "./Output.svelte"
  import ShowActions from "./ShowActions.svelte"
  import Media from "./tools/Media.svelte"
  import Show from "./tools/Show.svelte"
  import Transition from "./tools/Transition.svelte"

  let callClear: boolean = false
  const ctrlShortcuts: any = {
    c: () => (callClear = true),
    f: () => (fullscreen = !fullscreen),
    l: () => outLocked.set(!$outLocked),
    // r: () => {
    //   outSlide.set($outSlide)
    //   outBackground.set($outBackground)
    // }
  }

  const shortcuts: any = {
    Escape: () => {
      // TODO: dont toggle drawer
      if (fullscreen) fullscreen = false
    },
    ArrowRight: (e: any) => {
      if ($outLocked || e.ctrlKey || e.metaKey) return
      nextSlide(e)
    },
    ArrowLeft: (e: any) => {
      if ($outLocked || e.ctrlKey || e.metaKey) return
      previousSlide()
    },
    " ": (e: any) => {
      if (e.shiftKey) previousSlide()
      else nextSlide(e)
    },
  }

  function keydown(e: any) {
    if ((e.ctrlKey || e.metaKey || e.altKey) && !e.metaKey && ctrlShortcuts[e.key]) ctrlShortcuts[e.key]()
    if (e.target.closest("input") || e.target.closest(".edit") || !$activeShow || ($activeShow?.type !== "show" && $activeShow?.type !== undefined)) return

    if (shortcuts[e.key]) {
      e.preventDefault()
      shortcuts[e.key](e)
    }
  }

  let fullscreen: boolean = false
  let resolution: Resolution = $screen.resolution

  // TODO: video gets ((removed)) if video is starting while another is fading out
  let video: any = null
  let videoData: any = {
    duration: 0,
    paused: true,
    muted: false,
    loop: false,
  }
  let videoTime: number = 0

  let title: string = ""

  // active menu
  // TODO: remember previous and go back on clear!
  let activeClear: any = null
  let autoChange: boolean = true
  $: {
    if (autoChange) {
      let active = getActiveClear($outTransition, $outAudio, $outOverlays, $outSlide, $outBackground)
      if (active !== activeClear) activeClear = active
    }
  }

  function getActiveClear(transition: any, audio: any, overlays: any, slide: any, background: any) {
    if (transition) return "transition"
    if (audio.length) return "audio"
    if (overlays.length) return "overlays"
    if (slide?.id) return "slide"
    if (background) return "background"
    return null
  }
</script>

<svelte:window on:keydown={keydown} />

<div class="main">
  <!-- hidden={$activePage === "live" ? false : true} -->
  <div class="top">
    <div on:click={() => (fullscreen = !fullscreen)} class:fullscreen style={fullscreen ? "width: 100%;height: 100%;" : "width: 100%"}>
      {#if fullscreen}
        <span class="resolution">
          <!-- TODO: get actual resultion ... -->
          <p><b><T id="screen.width" />:</b> {resolution.width} <T id="screen.pixels" /></p>
          <p><b><T id="screen.height" />:</b> {resolution.height} <T id="screen.pixels" /></p>
        </span>
      {/if}
      <Output
        center={fullscreen}
        style={fullscreen ? getStyleResolution(resolution, window.innerWidth, window.innerWidth, "fit") : ""}
        bind:video
        bind:videoData
        bind:videoTime
        bind:title
      />
      <!-- <RecordedOutput /> -->
    </div>
    <AudioMeter {video} />
    <!-- {#if $activePage === 'live'}
    {/if} -->
  </div>

  <!-- TODO: enable stage output -->

  <!-- TODO: title keyboard shortcuts -->

  <ShowActions />

  {#if $activePage === "show"}
    <ClearButtons bind:autoChange bind:activeClear bind:video bind:videoData bind:videoTime bind:callClear />

    {#if activeClear === "background"}
      <Media {video} bind:videoData bind:videoTime bind:title />
    {:else if activeClear === "slide"}
      <Show />
    {/if}
    <!-- overlays -->
    <!-- audio -->

    <!-- transition -->
    {#if $outTransition && activeClear === "transition"}
      <Transition />
    {/if}
  {/if}
</div>

<style>
  .main {
    /* max-height: 50%; */
    flex: 1;
    min-width: 50%;
  }

  .top {
    display: flex;
  }
  /* button {
    background-color: inherit;
    color: inherit;
    border: none;
  } */

  .fullscreen {
    position: fixed;
    background-color: var(--primary);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    /* border: 4px solid var(--secondary); */
    z-index: 90;
  }
  .resolution {
    position: absolute;
    bottom: 0;
    right: 0;

    color: var(--secondary-text);
    /* background-color: var(--primary);
    background-color: black; */
    text-align: right;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 10px 12px;
    opacity: 0.8;
    transition: opacity ease-in-out 0.2s;

    z-index: 30;
  }
  .resolution:hover {
    opacity: 0;
  }
  .resolution p {
    display: flex;
    gap: 5px;
    justify-content: space-between;
  }
</style>
