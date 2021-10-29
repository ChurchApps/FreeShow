<script lang="ts">
  import type { TopViews } from "../../../types/Views"
  import type { SlideData } from "../../../types/Show"

  // import { OutputObject } from "../../classes/OutputObject";

  import { activeShow, output, shows } from "../../stores"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"

  import Output from "./Output.svelte"

  export let mode: TopViews
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

  function goForward(e: any) {
    // TODO: go down automaticly
    if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

    let slide = $output.slide
    let layout: SlideData[] = []
    if (slide) layout = $shows[slide.id].layouts[$shows[slide.id].settings.activeLayout].slides
    let endOfShow = slide?.index === layout.length - 1
    // TODO: active show slide index on delete......
    // go to beginning if live mode & ctrl | no output | last slide active
    if (mode === "live" && $activeShow && (!out || e.ctrlKey || (endOfShow && $activeShow.id !== slide?.id))) {
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

  function goBack() {
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

  function keydown(e: any) {
    if (e.ctrlKey || e.altKey) {
      if (e.key === "c") output.set({ background: null, slide: null, overlay: null, audio: null })
    }
    if (!(e.target instanceof window.HTMLInputElement)) {
      if (e.key === "ArrowRight" || (e.key === " " && !e.shiftKey)) {
        // Arrow Right | Space Bar
        e.preventDefault()
        goForward(e)
      } else if (e.key === "ArrowLeft" || (e.key === " " && e.shiftKey)) {
        // Arrow Left | Shift + Space Bar
        e.preventDefault()
        goBack()
      }
    }
  }

  $: name = $output.slide ? ($output.slide.private ? "private" : "SHOW: " + $shows[$output.slide.id].name) : "nothing"
</script>

<svelte:window on:keydown={keydown} />

<div>
  <!-- hidden={mode === "live" ? false : true} -->
  <Output style="max-width: var(--navigation-width);" />
  <!-- {#if mode === 'live'}
  {/if} -->

  <!-- TODO: enable stage output -->

  <div class="clear">
    <span>
      <!-- <button on:click={() => output.set(new OutputObject())}>Clear All</button> -->
      <Button class="clearAll" disabled={!out} on:click={() => output.set({ background: null, slide: null, overlay: null, audio: null })}>
        <T id={"clear.all"} />
      </Button>
    </span>
    <span class="group">
      <Button disabled={!$output.background} on:click={() => clearOutput("background")}>BG</Button>
      <Button disabled={!$output.slide} on:click={() => clearOutput("slide")}>TXT</Button>
      <Button disabled={!$output.overlay} on:click={() => clearOutput("overlay")}>OL</Button>
      <Button disabled={!$output.audio} on:click={() => clearOutput("audio")}>AUDIO</Button>
    </span>
  </div>

  <span>
    {name}
  </span>
  <span class="group">
    <Button on:click={goBack} disabled={!$output.slide}>{"<-"}</Button>
    <Button>Play/Pause</Button>
    <Button on:click={goForward}>{"->"}</Button>
  </span>
</div>

<style>
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
</style>
