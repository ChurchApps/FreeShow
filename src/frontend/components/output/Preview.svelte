<script lang="ts">
  import type { Resolution } from "../../../types/Settings"
  import { activePage, activeShow, outAudio, outBackground, outLocked, outOverlays, outSlide, outTransition, presenterControllerKeys, screen } from "../../stores"
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
    // c: () => (callClear = true),
    f: () => (fullscreen = !fullscreen),
    l: () => outLocked.set(!$outLocked),
    // r: () => {
    //   outSlide.set($outSlide)
    //   outBackground.set($outBackground)
    // }
  }

  const shortcuts: any = {
    // presenter controller keys
    Escape: () => {
      // TODO: dont toggle drawer
      if ($presenterControllerKeys) callClear = true
      else if (fullscreen) fullscreen = false
    },
    F1: () => outBackground.set(null),
    F2: () => outSlide.set(null),
    F3: () => outOverlays.set([]),
    F4: () => outAudio.set([]),
    ".": () => {
      // if ($presenterControllerKeys)
      callClear = true
    },
    F5: () => {
      if ($presenterControllerKeys) nextSlide(null, true)
      else outTransition.set(null)
    },
    PageDown: (e: any) => {
      if ($presenterControllerKeys) nextSlide(e)
    },
    PageUp: () => {
      if ($presenterControllerKeys) previousSlide()
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
    Home: (e: any) => nextSlide(e, true),
    End: (e: any) => nextSlide(e, false, true),
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

  function getActiveClear(nextTimer: any, audio: any, overlays: any, slide: any, background: any) {
    if (nextTimer) return "nextTimer"
    if (audio.length) return "audio"
    if (overlays.length) return "overlays"
    if (slide?.id) return "slide"
    if (background) return "background"
    return null
  }

  // nextTimer
  let timer = { time: 0, paused: true }
  let timerMax: number = 0
  let timeObj: any = null
  let sliderTimer: any = null
  let autoPlay: boolean = true

  outTransition.subscribe((a) => {
    timer = { time: 0, paused: true }
    if (timeObj !== null) {
      timeObj.clear()
      timeObj = null
    }

    if (a && a.duration > 0) {
      timerMax = a.duration
      timeObj = new Timer(() => {
        // if (timer.paused) {
        //   timer = { time: 0, paused: true }
        //   return
        // }

        console.log($outSlide?.index)
        outTransition.set(null)

        nextSlide(null)
        // timer = { time: 0, paused: false }
      }, a.duration * 1000)
      sliderTime()
    }
  })

  const Timer: any = function (this: any, callback: any, delay: number) {
    let timeout: any,
      start: number,
      remaining = delay
    timer.time = timerMax - remaining / 1000

    this.clear = () => {
      clearTimeout(timeout)
      timeout = null
    }

    this.pause = () => {
      clearTimeout(timeout)
      clearTimeout(sliderTimer)
      timeout = null
      sliderTimer = null
      autoPlay = false
      remaining -= Date.now() - start
      timer = { time: timerMax - remaining / 1000, paused: true }
    }

    this.resume = () => {
      if (timeout) return
      start = Date.now()
      remaining = (timerMax - timer.time) * 1000
      autoPlay = true
      timeout = setTimeout(() => {
        clearTimeout(timeout)
        timeout = null
        callback()
      }, remaining)
      timer.paused = false
      sliderTime()
    }

    if (autoPlay) this.resume()
  }

  // function durationAction(action: string) {
  //   if (timer.paused) return
  //   switch (action) {
  //     case "nextSlide":
  //       nextSlide(null)
  //       break
  //   }
  // }

  // set timer
  function sliderTime() {
    console.log(timer)

    if (!sliderTimer && timeObj && !timer.paused && autoPlay) {
      sliderTimer = setTimeout(() => {
        if (timeObj && !timer.paused) {
          if (timer.time < timerMax) timer.time += 0.5
          sliderTimer = null
          sliderTime()
        }
      }, 500)
    }
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
    {#if $outTransition && activeClear === "nextTimer"}
      <Transition bind:timer {timerMax} {timeObj} />
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
