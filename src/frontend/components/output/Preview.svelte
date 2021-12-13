<script lang="ts">
  import { OUTPUT } from "../../../types/Channels"

  import type { Resolution } from "../../../types/Settings"

  import type { SlideData } from "../../../types/Show"

  // import { OutputObject } from "../../classes/OutputObject";

  import { activeEdit, activePage, activeProject, activeShow, outAudio, outBackground, outOverlays, outSlide, projects, screen, shows } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import AudioMeter from "./AudioMeter.svelte"

  import Output from "./Output.svelte"
  import VideoSlider from "./VideoSlider.svelte"

  $: out = $outBackground === null && $outSlide === null && !$outOverlays.length && !$outAudio.length ? false : true

  function nextSlide(e: any) {
    // TODO: go down automaticly
    if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

    let slide = $outSlide
    let layout: SlideData[] = []
    // if (slide) layout = $shows[slide.id].layouts[$shows[slide.id].settings.activeLayout].slides
    if (slide) layout = GetLayout(slide.id)
    let endOfShow = slide?.index === layout.length - 1
    // TODO: active show slide index on delete......
    // go to beginning if live mode & ctrl | no output | last slide active
    if ($activePage === "show" && $activeShow && (!out || e.ctrlKey || (endOfShow && $activeShow.id !== slide?.id))) {
      outSlide.set({ id: $activeShow!.id, index: 0 })
    } else {
      // Check for loop to beginning slide...
      // Go to next show?
      // if (e.ctrlKey && ) { // TODO: if ctrl key, go to next show

      // TODO: slide disabled!!!!!
      if (slide) {
        //  && !slide.private
        // WIP: why private??????
        if (slide.index < layout.length - 1) {
          let index = slide!.index + 1
          outSlide.update((o) => {
            if (o) o.index = index
            return o
          })
          activeEdit.set({ slide: index, item: null })
        }
        // } else {
        //   output.update((o) => {
        //     o.slide = { id, index: 0 }
        //     return o
        //   })
      }
    }
  }

  $: console.log($activeEdit)

  function previousSlide() {
    let slide = $outSlide
    let index = typeof slide?.index === "number" ? slide.index - 1 : GetLayout().length - 1
    //  && !slide.private
    // let layout: Layout = $shows[slide.id].layouts[$shows[slide.id].settings.activeLayout].slides

    if (index > -1) {
      if ($outSlide) {
        outSlide.update((o) => {
          o!.index = index
          return o
        })
      } else if ($activeShow) outSlide.set({ id: $activeShow.id, index })
      activeEdit.set({ slide: index, item: null })
    }
    // } else {
    //   output.update((o) => {
    //     // o.slide?.index = layout.length - 1
    //     o.slide = { id, index: layout.length - 1 }
    //     return o
    //   })
  }

  const clearAll = () => {
    outBackground.set(null)
    outSlide.set(null)
    outOverlays.set([])
    outAudio.set([])
    clearVideo()
  }

  function previousShow() {
    if ($activeProject) {
      let index = typeof $activeShow?.index === "number" ? $activeShow?.index : $projects[$activeProject].shows.length
      if (index > 0) index--
      if (index !== $activeShow?.index) activeShow.set({ ...$projects[$activeProject].shows[index], index })
    }
  }
  function nextShow() {
    if ($activeProject) {
      let index = typeof $activeShow?.index === "number" ? $activeShow?.index : -1
      if (index + 1 < $projects[$activeProject].shows.length) index++
      if (index > -1 && index !== $activeShow?.index) activeShow.set({ ...$projects[$activeProject].shows[index], index })
    }
  }

  function keydown(e: any) {
    if (e.ctrlKey || e.altKey) {
      if (e.key === "c") clearAll()
      else if (e.key === "f") fullscreen = !fullscreen
    }

    if (!e.target.closest("input") && !e.target.closest(".edit")) {
      if (e.key === "ArrowRight" || (e.key === " " && !e.shiftKey)) {
        // Arrow Right | Space Bar
        e.preventDefault()
        nextSlide(e)
      } else if (e.key === "ArrowLeft" || (e.key === " " && e.shiftKey)) {
        // Arrow Left | Shift + Space Bar
        e.preventDefault()
        previousSlide()
      }
    }
  }

  $: name = $outSlide ? ($shows[$outSlide.id].private ? `${$shows[$outSlide.id].name} [[[[private]]]]` : $shows[$outSlide.id].name) : "-"
  $: index = $outSlide ? $outSlide.index + 1 : "-"

  let fullscreen: boolean = false
  let resolution: Resolution = $screen.resolution

  $: size =
    Math.min(resolution.width / window.innerWidth, window.innerWidth / resolution.width) > Math.min(resolution.height / window.innerHeight, window.innerHeight / resolution.height)
      ? "height: 90vh"
      : "width: 80vw"

  let video: any = null
  let videoData: any = {
    time: 0,
    duration: 0,
    paused: true,
  }
  function clearVideo() {
    // TODO: clear after fade out.....
    setTimeout(() => {
      video = null
      videoData = {
        time: 0,
        duration: 0,
        paused: true,
      }
      window.api.send(OUTPUT, { channel: "VIDEO_DATA", data: videoData })
    }, 600)
  }
  $: console.log(videoData)

  const sendToOutput = () => window.api.send(OUTPUT, { channel: "VIDEO_DATA", data: videoData })

  let length: number = 0
  $: {
    if ($outSlide?.id) {
      length = 0
      $shows[$outSlide.id].layouts[$shows[$outSlide.id].settings.activeLayout].slides.forEach((s: any) => {
        length++
        if ($shows[$outSlide!.id].slides[s.id].children) length += $shows[$outSlide!.id].slides[s.id].children!.length
      })
    }
  }
</script>

<svelte:window on:keydown={keydown} />

<div class="main">
  <!-- hidden={$activePage === "live" ? false : true} -->
  <div class="top">
    <div on:click={() => (fullscreen = !fullscreen)} class:fullscreen style={fullscreen ? "" : "width: 100%"}>
      {#if fullscreen}
        <span class="resolution">
          <!-- TODO: get actual resultion ... -->
          <p><b>Width:</b> {resolution.width}px</p>
          <p><b>Height:</b> {resolution.height}px</p>
        </span>
      {/if}
      <Output style={fullscreen ? size : ""} bind:video bind:videoData />
    </div>
    <AudioMeter {video} />
    <!-- {#if $activePage === 'live'}
    {/if} -->
  </div>

  <!-- TODO: enable stage output -->

  <div class="clear">
    <span>
      <!-- <button on:click={() => output.set(new OutputObject())}>Clear All</button> -->
      <Button class="clearAll" disabled={!out} on:click={clearAll} center>
        <T id={"clear.all"} />
      </Button>
    </span>
    <span class="group">
      <Button
        disabled={!$outBackground}
        on:click={() => {
          outBackground.set(null)
          clearVideo()
        }}
        center>BG</Button
      >
      <Button disabled={!$outSlide} on:click={() => outSlide.set(null)} center>TXT</Button>
      <Button disabled={!$outOverlays.length} on:click={() => outOverlays.set([])} center>OL</Button>
      <Button disabled={!$outAudio.length} on:click={() => outAudio.set([])} center>AUDIO</Button>
    </span>
  </div>

  <!-- video -->
  {#if video}
    {$outBackground?.name}
    <span class="group">
      <Button
        style="flex: 0"
        center
        title={videoData.paused ? "Play" : "Paused"}
        on:click={() => {
          videoData.paused = !videoData.paused
          sendToOutput()
        }}
      >
        <Icon id={videoData.paused ? "play" : "pause"} size={1.2} />
      </Button>
      <VideoSlider bind:videoData />
    </span>
  {/if}

  <!-- audio -->

  <!-- transition -->

  <span>Name: {name}</span>
  <span>Index: {index}</span>
  <span class="group">
    <Button
      on:click={previousShow}
      title="[[[PreviousShow [ArrowUp]]]]"
      disabled={!Object.keys($projects).length ||
        !$activeProject ||
        !$projects[$activeProject].shows.length ||
        (typeof $activeShow?.index === "number" ? $activeShow.index < 1 : false)}
      center
    >
      <Icon id="previousFull" size={1.2} />
    </Button>
    <!-- TODO: check type... -->
    <Button on:click={previousSlide} title="[[[PreviousSlide [ArrowLeft]]]]" disabled={!$activeShow || !GetLayout().length || ($outSlide && $outSlide.index < 1)} center>
      <Icon id="previous" size={1.2} />
    </Button>
    <Button title="[[[Lock]]]" center>
      <Icon id="unlocked" size={1.2} />
    </Button>
    <Button title="[[[Refresh/Update Output Show]]]" center>
      <Icon id="refresh" size={1.2} />
    </Button>
    <Button on:click={nextSlide} title="[[[NextSlide [ArrowRight]]]]" disabled={!$activeShow || !GetLayout().length || ($outSlide && $outSlide.index + 1 >= length)} center>
      <Icon id="next" size={1.2} />
    </Button>
    <Button
      on:click={nextShow}
      title="[[[NextShow [ArrowDown]]]]"
      disabled={!Object.keys($projects).length ||
        !$activeProject ||
        !$projects[$activeProject].shows.length ||
        ($activeShow?.index && $activeShow.index + 1 >= $projects[$activeProject].shows.length)}
      center
    >
      <Icon id="nextFull" size={1.2} />
    </Button>
  </span>
</div>

<style>
  .main {
    /* max-height: 50%; */
    flex: 1;
  }

  .top {
    display: flex;
  }
  /* button {
    background-color: inherit;
    color: inherit;
    border: none;
  } */

  .clear {
    display: flex;
    flex-direction: column;
  }

  :global(.clearAll) {
    width: 100%;
  }

  .clear :global(button) {
    background-color: rgb(255 0 0 / 0.3);
  }
  .clear :global(button):hover:not(:disabled):not(.active),
  .clear :global(button):active:not(:disabled):not(.active),
  .clear :global(button):focus:not(:disabled) {
    background-color: rgb(255 0 0 / 0.4);
  }

  .group {
    display: flex;
  }
  .group :global(button) {
    flex-grow: 1;
    /* height: 40px; */
  }

  .fullscreen {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border: 4px solid var(--secondary);
    z-index: 80;
  }
  .resolution {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 5px;
    z-index: 30;
    color: var(--secondary-text);
    padding: 10px 12px;
    border-bottom-right-radius: 5px;
    background-color: var(--secondary-opacity);
  }
  .resolution p {
    display: flex;
    gap: 5px;
    justify-content: space-between;
  }
</style>
