<script lang="ts">
  import type { Resolution } from "../../../types/Settings"

  import { shows, activeShow, output, screen } from "../../stores"
  import { GetLayout } from "../helpers/get"
  import Textbox from "../slide/Textbox.svelte"

  let viewWidth: number = window.innerWidth / 3
  let columns: number = 4
  let resolution: Resolution = $shows[$activeShow!.id].settings.resolution || $screen.resolution
  // let zoom = 0.15
  // console.log(elem)

  $: zoom = (viewWidth - (columns * 10 - 10)) / columns / resolution.width

  export let editor: boolean = false

  $: id = $activeShow!.id
  // let type =

  $: Slide = $output.slide
  $: ShowSlides = GetLayout(id)?.slides || []
  $: console.log(ShowSlides)

  // $: ShowSlides = $shows[id].layouts[$shows[id].settings.activeLayout].slides
</script>

<svelte:window
  on:keydown={(e) => {
    if (!editor && $shows[id] !== undefined && !(e.target instanceof window.HTMLInputElement)) {
      if (e.key === "ArrowRight" || (e.key === " " && !e.shiftKey)) {
        e.preventDefault()
        // TODO: go down automaticly
        if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()
        if (Slide?.id === id) {
          // let newSlide = Slide
          let slidesCount = Object.keys(ShowSlides).length
          // let currentIndex = GetShows().active.settings.activeLayout
          let currentIndex = Slide.index
          if (currentIndex + 1 < slidesCount) {
            output.update((o) => {
              if (o.slide) o.slide.index = currentIndex + 1 // ! no need for null check
              return o
            })
          }
          // $shows[id].slides[GetActiveLayout().slides[slideIndex].id]
          // TODO: check active project layout & get slides index....
          // if ($shows[Slide.id].slides[newSlide.index + 1]) newSlide.index = newSlide.index + 1
          // Check for loop to beginning slide...
          // Go to next show?
          // if (e.ctrlKey && ) { // TODO: if ctrl key, go to next show
          //   newSlide = {id: , index: 0}
          // }
          // output.set(newSlide)
        } else {
          output.update((o) => {
            o.slide = { id, index: 0 }
            return o
          })
        }
      } else if (e.key === "ArrowLeft" || (e.key === " " && e.shiftKey)) {
        if (Slide?.id === id) {
          if (Slide.index - 1 >= 0) {
            output.update((o) => {
              if (o.slide && Slide) {
                // ! no need for null check
                o.slide.index = Slide.index - 1
              }
              return o
            })
          }
        } else {
          output.update((o) => {
            // o.slide?.index = Object.keys(ShowSlides).length - 1
            o.slide = { id, index: Object.keys(ShowSlides).length - 1 }
            return o
          })
        }
      }
    }
  }}
/>

<div bind:offsetWidth={viewWidth} class="grid" style={editor ? "flex-direction: column;" : ""}>
  {#if $shows[id] !== undefined}
    <!-- {#each Object.values($shows[id].slides) as slide, i} -->
    {#each ShowSlides as slide, i}
      <!-- {console.log()} -->
      <div
        class="slide {Slide?.index === i && Slide?.id === id ? 'active' : ''}"
        style="width: {resolution.width * zoom}px; height: {resolution.height * zoom}px;"
        on:click={() =>
          output.update((o) => {
            o.slide = { id, index: i }
            return o
          })}
      >
        <span style="zoom: {zoom};">
          <!-- TODO: check if showid exists in shows -->
          {#each $shows[id].slides[slide.id].items as item}
            <Textbox {item} />
          {/each}
        </span>
      </div>
    {/each}

    <!-- <input
      style="position: absolute"
      type="range"
      min=".1"
      max=".5"
      step="0.01"
      value={zoom}
      on:input={(e) => {
        zoom = e.target?.value
      }}
    /> -->
    <div style="position: absolute;">
      <button on:click={() => (columns = Math.max(2, columns - 1))}>-</button>
      {columns}
      <button on:click={() => (columns = Math.min(10, columns + 1))}>+</button>
    </div>
    <!-- TODO: snap to width! (Select columns instead of manual zoom size) -->
  {:else}
    Error! Could not find show!
  {/if}
</div>

<style>
  .grid {
    --gap: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap);
    margin: var(--gap);
  }

  .slide {
    position: relative;
    background-color: black;
    width: 1920px;
    height: 1080px;
    font-size: 5em;
  }
  .slide.active {
    outline: 2px solid var(--secondary);
    outline-offset: 4px;
  }
</style>
