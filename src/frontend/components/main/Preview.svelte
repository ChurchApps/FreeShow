<script lang="ts">
  import type { Resolution } from "../../../types/Settings"

  import type { SlideData } from "../../../types/Show"

  // import { OutputObject } from "../../classes/OutputObject";

  import { activePage, activeShow, output, screen, shows } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import AudioMeter from "./AudioMeter.svelte"

  import Output from "./Output.svelte"

  let out = false
  output.subscribe((o) => {
    let set = new Set(Object.values(o))
    if ([...set].length > 1) out = true
    else out = false
    console.log(out)
  })

  function clearOutput(key: string) {
    output.update((o: any) => {
      o[key] = null
      return o
    })
  }

  function nextSlide(e: any) {
    // TODO: go down automaticly
    if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

    let slide = $output.slide
    let layout: SlideData[] = []
    // if (slide) layout = $shows[slide.id].layouts[$shows[slide.id].settings.activeLayout].slides
    if (slide) layout = GetLayout($output.slide!.id)
    let endOfShow = slide?.index === layout.length - 1
    // TODO: active show slide index on delete......
    // go to beginning if live mode & ctrl | no output | last slide active
    if ($activePage === "show" && $activeShow && (!out || e.ctrlKey || (endOfShow && $activeShow.id !== slide?.id))) {
      output.update((o) => {
        o.slide = { id: $activeShow!.id, index: 0, private: $activeShow!.private || false }
        return o
      })
    } else {
      // Check for loop to beginning slide...
      // Go to next show?
      // if (e.ctrlKey && ) { // TODO: if ctrl key, go to next show

      if (slide && !slide.private) {
        if (slide.index < layout.length - 1) {
          output.update((o) => {
            if (o.slide && slide) o.slide.index = slide.index + 1
            return o
          })
        }
        // } else {
        //   output.update((o) => {
        //     o.slide = { id, index: 0 }
        //     return o
        //   })
      }
    }
  }

  function previousSlide() {
    let slide = $output.slide
    if (slide && !slide.private) {
      // let layout: Layout = $shows[slide.id].layouts[$shows[slide.id].settings.activeLayout].slides
      if (slide.index > 0) {
        output.update((o) => {
          // ! no need for null check
          if (o.slide && slide) o.slide.index = slide.index - 1
          return o
        })
      }
      // } else {
      //   output.update((o) => {
      //     // o.slide?.index = layout.length - 1
      //     o.slide = { id, index: layout.length - 1 }
      //     return o
      //   })
    }
  }

  function nextShow() {}
  function previousShow() {}

  function keydown(e: any) {
    if (e.ctrlKey || e.altKey) {
      if (e.key === "c") output.set({ background: null, slide: null, overlay: null, audio: null })
      else if (e.key === "f") fullscreen = !fullscreen
    }
    if (!(e.target instanceof window.HTMLInputElement) && !e.target.closest(".edit")) {
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

  $: name = $output.slide ? ($output.slide.private ? "- [private]" : $shows[$output.slide.id].name) : "-"
  $: index = $output.slide ? $output.slide.index + 1 : "-"

  let fullscreen: boolean = false
  let resolution: Resolution = $screen.resolution

  $: size =
    Math.min(resolution.width / window.innerWidth, window.innerWidth / resolution.width) > Math.min(resolution.height / window.innerHeight, window.innerHeight / resolution.height)
      ? "height: 90vh"
      : "width: 80vw"
</script>

<svelte:window on:keydown={keydown} />

<div class="main">
  <!-- hidden={$activePage === "live" ? false : true} -->
  <div class="top">
    <div on:click={() => (fullscreen = !fullscreen)} class:fullscreen style="width: 100%">
      {#if fullscreen}
        <span class="resolution">
          <!-- TODO: get actual resultion ... -->
          <p><b>Width:</b> {resolution.width}px</p>
          <p><b>Height:</b> {resolution.height}px</p>
        </span>
      {/if}
      <Output style={fullscreen ? size : ""} />
    </div>
    <AudioMeter />
    <!-- {#if $activePage === 'live'}
    {/if} -->
  </div>

  <!-- TODO: enable stage output -->

  <div class="clear">
    <span>
      <!-- <button on:click={() => output.set(new OutputObject())}>Clear All</button> -->
      <Button class="clearAll" disabled={!out} on:click={() => output.set({ background: null, slide: null, overlay: null, audio: null })} center>
        <T id={"clear.all"} />
      </Button>
    </span>
    <span class="group">
      <Button disabled={!$output.background} on:click={() => clearOutput("background")} center>BG</Button>
      <Button disabled={!$output.slide} on:click={() => clearOutput("slide")} center>TXT</Button>
      <Button disabled={!$output.overlay} on:click={() => clearOutput("overlay")} center>OL</Button>
      <Button disabled={!$output.audio} on:click={() => clearOutput("audio")} center>AUDIO</Button>
    </span>
  </div>

  <span>Name: {name}</span>
  <span>Index: {index}</span>
  <span class="group">
    <Button on:click={previousShow} disabled={!$output.slide} center>
      <Icon id={"previousFull"} size={1.2} />
    </Button>
    <Button on:click={previousSlide} disabled={!$output.slide} center>
      <Icon id={"previous"} size={1.2} />
    </Button>
    <Button center title="Lock">
      <Icon id={"unlocked"} size={1.2} />
    </Button>
    <Button on:click={nextSlide} center>
      <Icon id={"next"} size={1.2} />
    </Button>
    <Button on:click={nextShow} center>
      <Icon id={"nextFull"} size={1.2} />
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
  .clear :global(button):hover:not(:disabled):not(.active) {
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
