<script lang="ts">
  import type { Resolution } from "../../../types/Settings"
  import type { Slide } from "../../../types/Show"
  import { activeShow, screen, shows, slidesOptions } from "../../stores"
  import Draggable from "../system/Draggable.svelte"
  import SelectElem from "../system/SelectElem.svelte"
  import Textbox from "./Textbox.svelte"

  export let slide: Slide
  export let color: string | null = slide.color
  export let index: number
  export let zoom: number = 1
  export let active: boolean = false
  export let list: boolean = false

  let resolution: Resolution = $shows[$activeShow!.id].settings.resolution || $screen.resolution

  let longestText: string = ""
  $: {
    longestText = ""
    slide.items.forEach((item) => {
      if (item.text) {
        let t = ""
        item.text.forEach((text) => {
          t += text.value
        })
        if (t.length > longestText.length) longestText = t
      }
    })
  }
</script>

<!-- TODO: disabled -->
<!-- https://svelte.dev/repl/3bf15c868aa94743b5f1487369378cf3?version=3.21.0 -->
<!-- animate:flip -->
<!-- class:right={overIndex === index && (!selected.length || index > selected[0])}
class:left={overIndex === index && (!selected.length || index <= selected[0])} -->
<div class="main" class:list>
  <div class="slide context #slide" class:active style="background-color: {color};" tabindex={0} data-index={index} on:click>
    <SelectElem id="slide" data={index}>
      <Draggable id="slide" {index} direction={list ? "column" : "row"}>
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
    </SelectElem>
  </div>
  {#if !$slidesOptions.grid}
    <hr />
    <div class="quickEdit edit" tabindex={0} contenteditable={true}>
      <p>{longestText}</p>
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

  .slideContent {
    position: relative;
    background-color: black;
    /* background-color: var(--primary-darker); */
    /* border: 1px solid var(--primary-lighter); */

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
