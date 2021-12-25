<script lang="ts">
  import { OUTPUT } from "../../../types/Channels"

  import type { Resolution } from "../../../types/Settings"

  import type { SlideData } from "../../../types/Show"

  // import { OutputObject } from "../../classes/OutputObject";

  import { activeEdit, activePage, activeProject, activeShow, outAudio, outBackground, outLocked, outOverlays, outSlide, projects, screen, shows } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import { getStyleResolution } from "../slide/getStyleResolution"
  import AudioMeter from "./AudioMeter.svelte"

  import Output from "./Output.svelte"
  import VideoSlider from "./VideoSlider.svelte"

  $: out = $outBackground === null && $outSlide === null && !$outOverlays.length && !$outAudio.length ? false : true

  function nextSlide(e: any) {
    if (!$outLocked) {
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
            activeEdit.set({ slide: index, items: [] })
          }
          // } else {
          //   output.update((o) => {
          //     o.slide = { id, index: 0 }
          //     return o
          //   })
        }
      }
    }
  }

  $: console.log($activeEdit)

  function previousSlide() {
    if (!$outLocked) {
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
        activeEdit.set({ slide: index, items: [] })
      }
      // } else {
      //   output.update((o) => {
      //     // o.slide?.index = layout.length - 1
      //     o.slide = { id, index: layout.length - 1 }
      //     return o
      //   })
    }
  }

  const clearAll = () => {
    if (!$outLocked) {
      outBackground.set(null)
      outSlide.set(null)
      outOverlays.set([])
      outAudio.set([])
      clearVideo()
    }
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
      else if (e.key === "l") outLocked.set(!$outLocked)
      else if (e.key === "r") outSlide.set($outSlide)
    }

    if (!e.target.closest("input") && !e.target.closest(".edit")) {
      if (!$outLocked && (e.key === "ArrowRight" || (e.key === " " && !e.shiftKey))) {
        // Arrow Right | Space Bar
        e.preventDefault()
        nextSlide(e)
      } else if (!$outLocked && (e.key === "ArrowLeft" || (e.key === " " && e.shiftKey))) {
        // Arrow Left | Shift + Space Bar
        e.preventDefault()
        previousSlide()
      } else if (e.key === "Escape" && fullscreen) {
        // TODO: dont toggle drawer
        fullscreen = false
      }
    }
  }

  $: name = $outSlide ? ($shows[$outSlide.id].private ? `${$shows[$outSlide.id].name} [[[[private]]]]` : $shows[$outSlide.id].name) : "-"

  let fullscreen: boolean = false
  let resolution: Resolution = $screen.resolution

  // $: size =
  //   Math.min(resolution.width / window.innerWidth, window.innerWidth / resolution.width) > Math.min(resolution.height / window.innerHeight, window.innerHeight / resolution.height)
  //     ? "height: 90vh"
  //     : "width: 80vw"

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
    <div on:click={() => (fullscreen = !fullscreen)} class:fullscreen style={fullscreen ? "width: 100%;height: 100%;" : "width: 100%"}>
      {#if fullscreen}
        <span class="resolution">
          <!-- TODO: get actual resultion ... -->
          <p><b>[[[Width]]]:</b> {resolution.width} [[[pixels]]]</p>
          <p><b>[[[Height]]]:</b> {resolution.height} [[[pixels]]]</p>
        </span>
      {/if}
      <Output center={fullscreen} style={fullscreen ? getStyleResolution(resolution, window.innerWidth, window.innerWidth, "fit") : ""} bind:video bind:videoData />
    </div>
    <AudioMeter {video} />
    <!-- {#if $activePage === 'live'}
    {/if} -->
  </div>

  <!-- TODO: enable stage output -->

  {#if $activePage !== "edit"}
    <div class="clear">
      <span>
        <!-- <button on:click={() => output.set(new OutputObject())}>Clear All</button> -->
        <Button class="clearAll" disabled={$outLocked || !out} on:click={clearAll} red center>
          <T id={"clear.all"} />
        </Button>
      </span>
      <span class="group">
        <Button
          disabled={$outLocked || !$outBackground}
          on:click={() => {
            if (!$outLocked) {
              outBackground.set(null)
              clearVideo()
            }
          }}
          red
          center
        >
          BG
        </Button>
        <Button
          disabled={$outLocked || !$outSlide}
          on:click={() => {
            if (!$outLocked) {
              outSlide.set(null)
            }
          }}
          red
          center
        >
          TXT
        </Button>
        <Button
          disabled={$outLocked || !$outOverlays.length}
          on:click={() => {
            if (!$outLocked) {
              outOverlays.set([])
            }
          }}
          red
          center
        >
          OL
        </Button>
        <Button
          disabled={$outLocked || !$outAudio.length}
          on:click={() => {
            if (!$outLocked) {
              outAudio.set([])
            }
          }}
          red
          center
        >
          AUDIO
        </Button>
      </span>
    </div>

    <!-- video -->
    {#if video}
      <span style="display: flex;padding: 10px;opacity: 0.8;">{$outBackground?.name}</span>
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

    <!-- show -->
    {#if $outSlide}
      <span style="display: flex;padding: 10px;justify-content: space-between;opacity: 0.8;">
        <span>
          {#if name.length}
            {name}
          {:else}
            <T id="main.unnamed" />
          {/if}
        </span>
        <span style="opacity: 0.6;">{$outSlide.index + 1}</span>
      </span>
    {/if}
  {/if}

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
    <Button
      on:click={previousSlide}
      title="[[[PreviousSlide [ArrowLeft]]]]"
      disabled={$outLocked || !$activeShow || !GetLayout().length || ($outSlide && $outSlide.index < 1)}
      center
    >
      <Icon id="previous" size={1.2} />
    </Button>
    <Button on:click={() => outLocked.set(!$outLocked)} red={$outLocked} title={$outLocked ? "[[[Unlock Output]]]" : "[[[Lock Output]]]"} center>
      <Icon id={$outLocked ? "locked" : "unlocked"} size={1.2} />
    </Button>
    {#if ($activePage === "edit" && $outSlide?.index !== $activeEdit.slide) || !$outSlide || $outSlide.id !== $activeShow?.id}
      <Button
        on:click={() => {
          if ($activePage === "edit" && $activeShow && $activeEdit.slide !== null) outSlide.set({ id: $activeShow.id, index: $activeEdit.slide })
          else if ($activeShow && GetLayout().length) outSlide.set({ id: $activeShow.id, index: 0 })
        }}
        title="[[[Show Current Show/Slide]]]"
        disabled={$outLocked || !$activeShow || !GetLayout().length}
        center
      >
        <Icon id="play" size={1.2} />
      </Button>
    {:else}
      <Button on:click={() => outSlide.set($outSlide)} title="[[[Update Output Slide]]]" disabled={!$outSlide || $outLocked} center>
        <Icon id="refresh" size={1.2} />
      </Button>
    {/if}
    <Button
      on:click={nextSlide}
      title="[[[NextSlide [ArrowRight]]]]"
      disabled={$outLocked || !$activeShow || !GetLayout().length || ($outSlide && $outSlide.index + 1 >= length)}
      center
    >
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

  .group {
    display: flex;
    flex-wrap: wrap;
  }
  .group :global(button) {
    flex-grow: 1;
    /* height: 40px; */
  }

  .fullscreen {
    position: fixed;
    background-color: var(--primary);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border: 4px solid var(--secondary);
    z-index: 80;
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
