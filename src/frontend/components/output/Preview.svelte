<script lang="ts">
  import { OUTPUT } from "../../../types/Channels"
  import type { Resolution } from "../../../types/Settings"
  import type { OutSlide, SlideData } from "../../../types/Show"
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
      if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

      let slide: null | OutSlide = $outSlide
      let layout: SlideData[] = GetLayout(slide ? slide.id : null)
      let endOfShow: boolean = slide ? slide.index === layout.length - 1 : false
      let index: null | number = null

      // TODO: active show slide index on delete......

      // go to beginning if live mode & ctrl | no output | last slide active
      if ($activePage === "show" && $activeShow && (!slide || e.ctrlKey || (endOfShow && $activeShow.id !== slide?.id))) {
        let layout = GetLayout()
        if (layout.filter((a) => !a.disabled).length) {
          index = 0
          while (layout[index].disabled) index++
          outSlide.set({ id: $activeShow!.id, index })
        }
      } else if (slide) {
        // TODO: Check for loop to beginning slide...

        if (slide.index < layout.length - 1 && layout.slice(slide.index + 1, layout.length).filter((a) => !a.disabled).length) {
          index = slide!.index + 1
          while (layout[index].disabled) index++
          outSlide.update((a) => {
            a!.index = index!
            return a
          })
        }
      }
      if (index !== null) {
        activeEdit.set({ slide: index, items: [] })
        // !Cannot read property 'background' of undefined
        if (layout[index].background) {
          let bg = $shows[$activeShow!.id].backgrounds[layout[index].background!]
          outBackground.set({ path: bg.path, muted: bg.muted !== false })
        }
      }
    }
  }

  $: console.log($activeEdit)

  function previousSlide() {
    if (!$outLocked) {
      if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

      let slide: null | OutSlide = $outSlide
      let layout: SlideData[] = GetLayout(slide ? slide.id : null)
      let index: number = slide?.index !== undefined ? slide.index - 1 : layout.length - 1

      if (index > -1 && layout.slice(0, index + 1).filter((a) => !a.disabled).length) {
        while (layout[index].disabled) index--
        if ($outSlide) {
          outSlide.update((o) => {
            o!.index = index
            return o
          })
        } else if ($activeShow) outSlide.set({ id: $activeShow.id, index })

        activeEdit.set({ slide: index, items: [] })
        if (layout[index].background) {
          let bg = $shows[$activeShow!.id].backgrounds[layout[index].background!]
          outBackground.set({ path: bg.path, muted: bg.muted !== false })
        }
      }
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
    duration: 0,
    paused: true,
    muted: false,
  }
  let videoTime: number = 0
  function clearVideo() {
    // TODO: clear after fade out.....
    setTimeout(() => {
      video = null
      videoTime = 0
      videoData = {
        time: 0,
        duration: 0,
        paused: true,
        muted: false,
      }
      window.api.send(OUTPUT, { channel: "VIDEO_DATA", data: videoData })
    }, 600)
  }

  let videoName: string = ""
  $: outName = $outBackground?.path ? $outBackground.path.substring($outBackground.path.lastIndexOf("\\") + 1) : ""
  $: videoName = outName.slice(0, outName.lastIndexOf("."))

  const sendToOutput = () => window.api.send(OUTPUT, { channel: "VIDEO_DATA", data: { ...videoData, time: videoTime } })

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
      <Output center={fullscreen} style={fullscreen ? getStyleResolution(resolution, window.innerWidth, window.innerWidth, "fit") : ""} bind:video bind:videoData bind:videoTime />
    </div>
    <AudioMeter {video} />
    <!-- {#if $activePage === 'live'}
    {/if} -->
  </div>

  <!-- TODO: enable stage output -->

  {#if $activePage === "show"}
    <div class="clear">
      <span>
        <!-- <button on:click={() => output.set(new OutputObject())}>Clear All</button> -->
        <Button class="clearAll" disabled={$outLocked || !out} on:click={clearAll} title="[[[Clear all]]]" red dark center>
          <Icon id="clear" size={1.2} />
          <span style="padding-left: 10px;"><T id={"clear.all"} /></span>
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
          title="[[[Clear background]]]"
          red
          dark
          center
        >
          <Icon id="background" size={1.2} />
        </Button>
        <Button
          disabled={$outLocked || !$outSlide}
          on:click={() => {
            if (!$outLocked) {
              outSlide.set(null)
            }
          }}
          title="[[[Clear slide]]]"
          red
          dark
          center
        >
          <Icon id="slide" size={1.2} />
        </Button>
        <Button
          disabled={$outLocked || !$outOverlays.length}
          on:click={() => {
            if (!$outLocked) {
              outOverlays.set([])
            }
          }}
          title="[[[Clear overlays]]]"
          red
          dark
          center
        >
          <Icon id="overlays" size={1.2} />
        </Button>
        <Button
          disabled={$outLocked || !$outAudio.length}
          on:click={() => {
            if (!$outLocked) {
              outAudio.set([])
            }
          }}
          title="[[[Clear all audio]]]"
          red
          dark
          center
        >
          <Icon id="audio" size={1.2} />
        </Button>
      </span>
    </div>

    <!-- video -->
    {#if video}
      <span style="display: flex;justify-content: center;padding: 5px;padding-top: 10px;opacity: 0.8;">{videoName}</span>
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
        <VideoSlider bind:videoData bind:videoTime toOutput />
        <Button style="flex: 0" center title={videoData.muted ? "Unmute" : "Mute"} on:click={() => (videoData.muted = !videoData.muted)}>
          <Icon id={videoData.muted ? "muted" : "volume"} size={1.2} />
        </Button>
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
        <!-- TODO: update -->
        <span style="opacity: 0.6;">{$outSlide.index + 1}/{GetLayout($outSlide.id).length}</span>
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
          // TODO: activeEdit && play media
        }}
        title="[[[Show Current Show/Slide]]]"
        disabled={$outLocked || !$activeShow || !GetLayout().length}
        center
      >
        <Icon id="play" size={1.2} />
      </Button>
    {:else}
      <Button
        on:click={() => {
          outBackground.set($outBackground)
          outSlide.set($outSlide)
        }}
        title="[[[Update Output Slide]]]"
        disabled={!$outSlide || $outLocked}
        center
      >
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
