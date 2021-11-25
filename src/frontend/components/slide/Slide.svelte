<script lang="ts">
  import type { Resolution } from "../../../types/Settings"
  import type { Slide } from "../../../types/Show"
  import { activeShow, dragged, screen, shows, slidesOptions } from "../../stores"
  import { drop } from "../helpers/dropSlide"
  import Draggable from "../system/Draggable.svelte"
  import Textbox from "./Textbox.svelte"

  export let slide: Slide
  export let color: string | null = slide.color
  export let index: number
  export let zoom: number = 1
  export let active: boolean = false
  export let list: boolean = false

  export let overIndex: null | number = null
  export let selected: number[]

  let resolution: Resolution = $shows[$activeShow!.id].settings.resolution || $screen.resolution

  const dragenter = (e: any) => {
    if (e.offsetX < e.target.offsetWidth / 2) side = "right"
    else side = "left"

    if ($dragged === "slide" || $dragged === "slideGroup") overIndex = index
    // TODO: get media (files)
    // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop
  }

  const ondrop = (e: any) => {
    if ($dragged === "slide" || $dragged === "slideGroup") {
      // e.dataTransfer.dropEffect = "move"
      let data: string = e.dataTransfer.getData("text")
      // let i = index
      // if (side === "right") i++

      drop(data, selected, index, side)
      overIndex = null
      selected = []
    }
  }

  let side: "left" | "right" = "left"
  // TODO: change based on current side onmousemove
</script>

<!-- TODO: disabled -->
<!-- https://svelte.dev/repl/3bf15c868aa94743b5f1487369378cf3?version=3.21.0 -->
<!-- animate:flip -->
<!-- class:right={overIndex === index && (!selected.length || index > selected[0])}
class:left={overIndex === index && (!selected.length || index <= selected[0])} -->
<div class="main" class:list>
  <div class="slide context_slide" class:active class:selected={selected.includes(index)} style="background-color: {color};" tabindex={0} data-index={index} on:click on:mousedown>
    <Draggable id="slide" on:drop={ondrop} on:dragenter={dragenter} hover={overIndex === index} {side} direction={list ? "column" : "row"}>
      <!-- TODO: tab select on enter -->
      <div class="slideContent" style="width: {resolution.width * zoom}px; height: {resolution.height * zoom}px; {!slide.items.length ? 'background-color: transparent;' : ''}">
        <span style="zoom: {zoom};">
          <!-- TODO: check if showid exists in shows -->
          {#each slide.items as item}
            <Textbox {item} />
          {/each}
        </span>
      </div>
      <!-- TODO: BG: white, color: black -->
      <div class="label" style="width: {resolution.width * zoom}px;" title={slide.label || ""}>
        <!-- font-size: 0.8em; -->
        <span style="position: absolute;display: contents;">{index + 1}</span>
        <span class="text">{slide.label || ""}</span>
      </div>
    </Draggable>
  </div>
  {#if !$slidesOptions.grid}
    <hr />
    <div class="quickEdit edit" tabindex={0} contenteditable={true}>
      {#each slide.items as item}
        {#if item.text}
          {#each item.text as text}
            <p>{text.value}</p>
          {/each}
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .main {
    display: flex;
    position: relative;
  }
  .main.list {
    width: 100%;
  }

  .slide {
    /* padding: 3px; */
    background-color: var(--primary);
    z-index: 0;
    outline-offset: 0;
    /* height: fit-content; */
    /* border: 2px solid var(--primary-lighter); */
    /* font-size: 5em; */
  }
  .slide.active {
    /* outline: 2px solid var(--secondary);
    outline-offset: 4px; */
    outline: 3px solid var(--secondary);
    outline-offset: 4px;
  }

  .slide.selected {
    /* outline: 2px solid red;
    outline-offset: 2px; */
    filter: contrast(0.8);
  }

  .slideContent {
    position: relative;
    background-color: black;
    z-index: -1;
    /* width: 1920px;
    height: 1080px; */
    font-size: 5em;
  }

  .label {
    display: flex;
    padding: 5px;
    padding-bottom: 3px;
    font-size: 0.8em;
    font-weight: bold;
    align-items: center;
    /* opacity: 0.8; */
  }

  .label .text {
    width: 100%;
    margin: 0 20px;
    text-align: center;
    overflow-x: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  hr {
    height: 100%;
    width: 3px;
    border: none;
    margin: 0 10px;
    background-color: var(--primary-lighter);
  }

  .quickEdit {
    display: flex;
    background-color: rgb(0 0 0 / 0.8);
    color: white;
    padding: 3px;
    flex: 1;
  }
</style>
