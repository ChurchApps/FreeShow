<script lang="ts">
  import { OUTPUT } from "../../../types/Channels"
  import type { Resolution } from "../../../types/Settings"
  import type { OutSlide, SlideData } from "../../../types/Show"
  import {
    activeEdit,
    activePage,
    activeProject,
    activeShow,
    outAudio,
    outBackground,
    outLocked,
    outOverlays,
    outSlide,
    outTransition,
    projects,
    screen,
    shows,
    videoExtensions,
  } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import Slider from "../inputs/Slider.svelte"
  import { getStyleResolution } from "../slide/getStyleResolution"
  import AudioMeter from "./AudioMeter.svelte"
  import Output from "./Output.svelte"
  import VideoSlider from "./VideoSlider.svelte"

  $: out = $outBackground === null && $outSlide === null && !$outOverlays.length && !$outAudio.length ? false : true

  function nextSlide(e: any) {
    if (!$outLocked) {
      if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

      let slide: null | OutSlide = $outSlide
      let layout: SlideData[] = GetLayout(slide ? slide.id : null, slide ? slide.layout : null)
      let endOfShow: boolean = slide ? slide.index === layout.length - 1 && !layout[slide.index].end : false
      let index: null | number = null

      // TODO: active show slide index on delete......

      // go to beginning if live mode & ctrl | no output | last slide active
      if (
        $activePage === "show" &&
        $activeShow &&
        (!slide || e?.ctrlKey || (endOfShow && $activeShow.id !== slide?.id && $shows[$activeShow.id].settings.activeLayout !== slide.layout))
      ) {
        layout = GetLayout()
        let activeLayout: string = $shows[$activeShow!.id].settings.activeLayout
        if (layout.filter((a) => !a.disabled).length) {
          index = 0
          while (layout[index].disabled) index++
          outSlide.set({ id: $activeShow!.id, layout: activeLayout, index })
        }
      } else if (slide) {
        // TODO: Check for loop to beginning slide...

        index = getNextEnabled(slide.index)
        // update output slide
        if (index !== null) {
          //  && layout.slice(slide.index + 1, layout.length).filter((a) => !a.disabled).length) {
          //   index = slide!.index + 1
          //   while (layout[index].disabled) index++
          outSlide.update((a: any) => {
            a.index = index
            return a
          })
        }
      }

      if (index !== null) updateOut(index, layout)
    }
  }

  $: console.log($activeEdit)

  function previousSlide() {
    if (!$outLocked) {
      if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

      let slide: null | OutSlide = $outSlide
      let layout: SlideData[] = GetLayout(slide ? slide.id : null, slide ? slide.layout : null)
      let activeLayout: string = $shows[slide ? slide.id : $activeShow!.id].settings.activeLayout
      let index: number = slide?.index !== undefined ? slide.index - 1 : layout.length - 1

      if (index > -1 && layout.slice(0, index + 1).filter((a) => !a.disabled).length) {
        while (layout[index].disabled) index--
        if ($outSlide) {
          outSlide.update((o) => {
            o!.index = index
            return o
          })
        } else if ($activeShow) outSlide.set({ id: $activeShow.id, layout: activeLayout, index })

        updateOut(index, layout)
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

  function getNextEnabled(index: null | number): null | number {
    let slide: null | OutSlide = $outSlide
    let layout: SlideData[] = GetLayout(slide ? slide.id : null, slide ? slide.layout : null)
    // get if loop to start
    if (index !== null) {
      if (layout[index].end) index = 0
      else index++
      if (index < layout.length && layout.slice(index, layout.length).filter((a) => !a.disabled).length) {
        while (layout[index].disabled || index > layout.length) index++
      } else index = null
    }
    return index
  }

  function updateOut(index: number, layout: any) {
    activeEdit.set({ slide: index, items: [] })

    // background
    // !Cannot read property 'background' of undefined
    if (layout[index].background && $outSlide) {
      let bg = $shows[$outSlide.id].backgrounds[layout[index].background!]
      outBackground.set({ path: bg.path, muted: bg.muted !== false })
    }

    // transition
    let t: any = layout[index].transition
    console.log(index, t)
    if (t && t.duration > 0) {
      t.action = "nextSlide"
      outTransition.set(t)
    } else outTransition.set(null)
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
      // else if (e.key === "r") {
      //   outSlide.set($outSlide)
      //   outBackground.set($outBackground)
      // }
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
    loop: false,
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
        loop: false,
      }
      window.api.send(OUTPUT, { channel: "VIDEO_DATA", data: videoData })
    }, 600)
  }

  let mediaName: string = ""
  $: outName = $outBackground?.path ? $outBackground.path.substring($outBackground.path.lastIndexOf("\\") + 1) : ""
  $: mediaName = outName.slice(0, outName.lastIndexOf("."))

  const sendToOutput = () => window.api.send(OUTPUT, { channel: "VIDEO_DATA", data: { ...videoData, time: videoTime } })

  let length: number = 0
  $: {
    if ($outSlide?.id) {
      console.log($outSlide)

      length = 0
      $shows[$outSlide.id].layouts[$outSlide.layout].slides.forEach((s: any) => {
        length++
        if ($shows[$outSlide!.id].slides[s.id].children) length += $shows[$outSlide!.id].slides[s.id].children!.length
      })
    }
  }

  // transitions

  let timer = { time: 0, paused: true }
  let timerMax: number = 0
  let timeObj: any = null
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
      timeout = null
      remaining -= Date.now() - start
      timer = { time: timerMax - remaining / 1000, paused: true }
    }

    this.resume = () => {
      if (timeout) return
      start = Date.now()
      remaining = (timerMax - timer.time) * 1000
      console.log(remaining)
      timeout = setTimeout(() => {
        clearTimeout(timeout)
        timeout = null
        callback()
      }, remaining)
      timer.paused = false
    }

    this.resume()
  }

  let sliderTimer: any = null
  outTransition.subscribe((a) => {
    if (sliderTimer !== null) sliderTimer = null
    if (timeObj !== null) {
      timeObj.clear()
      timeObj = null
    }

    if (a && a.duration > 0) {
      timerMax = a.duration
      timeObj = new Timer(() => {
        timer = { time: 0, paused: true }
        durationAction(a.action)
      }, a.duration * 1000)
    }
  })

  let autoPause: boolean = false
  function transitionChange(e: any) {
    if (!timer.paused) {
      autoPause = true
      timeObj.pause()
    }
    timer.time = Number(e.target.value)
  }
  function mouseup() {
    if (autoPause) {
      timeObj.resume()
      autoPause = false
    }
  }

  // set timer
  $: if (timeObj && !timer.paused && !sliderTimer) sliderTime()
  function sliderTime() {
    sliderTimer = setTimeout(() => {
      if (timeObj && !timer.paused) {
        if (timer.time < timerMax) timer.time += 0.5
        sliderTime()
      } else sliderTimer = null
    }, 500)
  }

  function round(value: number, step = 1) {
    var inv = 1 / step
    return Math.floor(value * inv) / inv
  }

  function durationAction(action: string) {
    switch (action) {
      case "nextSlide":
        nextSlide(null)
        break
    }
  }

  // active menu
  // TODO: remember previous and go back on clear!
  // let previousActive: any = null
  let activeClear: any = null
  $: {
    // if (previousActive) {
    //   activeClear = previousActive
    //   previousActive = null
    // } else
    // TODO: dont't change if it already exists (e.g. changing slides...)
    if ($outTransition) activeClear = "transition"
    else if ($outAudio.length) activeClear = "audio"
    else if ($outOverlays.length) activeClear = "overlays"
    else if ($outBackground) activeClear = "background"
    else if ($outSlide?.id) activeClear = "slide"
    else activeClear = null
  }
</script>

<svelte:window on:keydown={keydown} on:mouseup={mouseup} />

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
    <Button
      on:click={previousSlide}
      title="[[[PreviousSlide [ArrowLeft]]]]"
      disabled={$outLocked || !$activeShow || ($outSlide ? $outSlide.index < 1 : !GetLayout(null, $shows[$activeShow.id]?.settings.activeLayout || null).length)}
      center
    >
      <Icon id="previous" size={1.2} />
    </Button>
    <Button on:click={() => outLocked.set(!$outLocked)} red={$outLocked} title={$outLocked ? "[[[Unlock Output]]]" : "[[[Lock Output]]]"} center>
      <Icon id={$outLocked ? "locked" : "unlocked"} size={1.2} />
    </Button>
    {#if ($activePage === "edit" && $outSlide?.index !== $activeEdit.slide) || !$outSlide || $outSlide.id !== $activeShow?.id || $outSlide.layout !== $shows[$activeShow.id].settings.activeLayout}
      <Button
        on:click={() => {
          if ($activePage === "edit" && $activeShow && $activeEdit.slide !== null)
            outSlide.set({ id: $activeShow.id, layout: $shows[$activeShow.id].settings.activeLayout, index: $activeEdit.slide })
          else if ($activeShow && GetLayout().length) outSlide.set({ id: $activeShow.id, layout: $shows[$activeShow.id].settings.activeLayout, index: 0 })
          // TODO: activeEdit && play media
        }}
        title="[[[Show Current Show/Slide]]]"
        disabled={$outLocked || !$activeShow || !GetLayout(null, $shows[$activeShow.id]?.settings.activeLayout || null).length}
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
      disabled={$outLocked || !$activeShow || ($outSlide ? $outSlide.index + 1 >= length : !GetLayout(null, $shows[$activeShow.id]?.settings.activeLayout || null).length)}
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

  {#if $activePage === "show"}
    <!-- clear -->
    <div class="clear" style="border-top: 2px solid var(--primary-lighter);">
      <span>
        <Button class="clearAll" disabled={$outLocked || !out} on:click={clearAll} title="[[[Clear all]]]" red dark center>
          <Icon id="clear" size={1.2} />
          <span style="padding-left: 10px;"><T id={"clear.all"} /></span>
        </Button>
      </span>
      <span class="group">
        <Button
          disabled={($outLocked && activeClear === "background") || !$outBackground}
          on:click={() => {
            if (activeClear !== "background") {
              // previousActive = activeClear
              activeClear = "background"
            } else if (!$outLocked) {
              outBackground.set(null)
              clearVideo()
            }
          }}
          title={activeClear === "background" ? "[[[Clear background]]]" : "[[[Background]]]"}
          red={activeClear === "background"}
          dark
          center
        >
          <Icon id="background" size={1.2} />
        </Button>
        <Button
          disabled={($outLocked && activeClear === "slide") || !$outSlide}
          on:click={() => {
            if (activeClear !== "slide") {
              // previousActive = activeClear
              activeClear = "slide"
            } else if (!$outLocked) {
              outSlide.set(null)
            }
          }}
          title={activeClear === "slide" ? "[[[Clear slide]]]" : "[[[Slide]]]"}
          red={activeClear === "slide"}
          dark
          center
        >
          <Icon id="slide" size={1.2} />
        </Button>
        <Button
          disabled={($outLocked && activeClear === "overlays") || !$outOverlays.length}
          on:click={() => {
            if (activeClear !== "overlays") {
              // previousActive = activeClear
              activeClear = "overlays"
            } else if (!$outLocked) {
              outOverlays.set([])
            }
          }}
          title={activeClear === "overlays" ? "[[[Clear overlays]]]" : "[[[Overlays]]]"}
          red={activeClear === "overlays"}
          dark
          center
        >
          <Icon id="overlays" size={1.2} />
        </Button>
        <Button
          disabled={($outLocked && activeClear === "audio") || !$outAudio.length}
          on:click={() => {
            if (activeClear !== "audio") {
              // previousActive = activeClear
              activeClear = "audio"
            } else if (!$outLocked) {
              outAudio.set([])
            }
          }}
          title={activeClear === "audio" ? "[[[Clear all audio]]]" : "[[[Audio]]]"}
          red={activeClear === "audio"}
          dark
          center
        >
          <Icon id="audio" size={1.2} />
        </Button>
        <Button
          disabled={($outLocked && activeClear === "transition") || !$outTransition}
          on:click={() => {
            if (activeClear !== "transition") {
              // previousActive = activeClear
              activeClear = "transition"
            } else if (!$outLocked) {
              outTransition.set(null)
            }
          }}
          title={activeClear === "transition" ? "[[[Clear transition]]]" : "[[[Transition]]]"}
          red={activeClear === "transition"}
          dark
          center
        >
          <Icon id="transition" size={1.2} />
        </Button>
      </span>
    </div>

    <!-- video -->
    {#if activeClear === "background"}
      <span class="name">
        <p>{mediaName}</p>
      </span>
      {#if video && $videoExtensions.includes((outName?.match(/\.[0-9a-z]+$/i)?.[0] || "").substring(1))}
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
          <Button style="flex: 0" center title="[[[Loop]]]" on:click={() => (videoData.loop = !videoData.loop)}>
            <Icon id="loop" white={!videoData.loop} size={1.2} />
          </Button>
        </span>
      {:else}
        <!-- Image -->
      {/if}
    {/if}

    <!-- slide -->
    {#if $outSlide && activeClear === "slide"}
      <span class="name" style="justify-content: space-between;">
        <p>
          {#if name.length}
            {name}
          {:else}
            <T id="main.unnamed" />
          {/if}
        </p>
        <!-- TODO: update -->
        <span style="opacity: 0.6;">{$outSlide.index + 1}/{length}</span>
      </span>
    {/if}

    <!-- overlays -->

    <!-- audio -->

    <!-- transition -->
    {#if $outTransition && activeClear === "transition"}
      <span class="name">
        <p><T id="transition.{$outTransition.type}" /></p>
      </span>
      {#if timeObj}
        <span class="group">
          <Button
            style="flex: 0"
            center
            title={timer.paused ? "Play" : "Paused"}
            on:click={() => {
              if (timer.paused) timeObj.resume()
              else timeObj.pause()
            }}
          >
            <Icon id={timer.paused ? "play" : "pause"} size={1.2} />
          </Button>
          <span style="color: var(--secondary);padding: 0 10px;">{round(timer.time)}</span>
          <Slider style="flex: 1;" bind:value={timer.time} step={0.5} max={timerMax} on:input={transitionChange} />
          <!-- <input type="range" bind:value={timer.time} step={0.5} max={timerMax} name="" id="" on:input={transitionChange} /> -->
          <span style="padding: 0 10px;">{round($outTransition.duration)}</span>
        </span>
      {/if}
    {/if}
  {/if}
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
    align-items: center;
  }
  .group :global(button) {
    flex-grow: 1;
    /* height: 40px; */
  }

  .name {
    display: flex;
    justify-content: center;
    padding: 5px;
    padding-top: 10px;
    opacity: 0.8;
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
