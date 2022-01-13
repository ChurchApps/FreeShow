<script lang="ts">
  import type { Show, Slide, SlideData } from "../../../types/Show"
  import { dictionary, groupCount, groups, slidesOptions } from "../../stores"
  import MediaLoader from "../drawer/media/MediaLoader.svelte"
  import { GetLayoutRef } from "../helpers/get"
  import DropArea from "../system/DropArea.svelte"
  import SelectElem from "../system/SelectElem.svelte"
  import Textbox from "./Textbox.svelte"
  import Zoomed from "./Zoomed.svelte"

  export let slide: Slide
  export let layoutSlide: SlideData
  export let show: Show
  export let color: string | null = slide.color
  export let index: number
  export let columns: number = 1
  export let active: boolean = false
  export let list: boolean = false

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

  console.log(layoutSlide, show)

  $: background = layoutSlide.background ? show.backgrounds[layoutSlide.background] : null
  // $: full_name = background ? background.path.substring(background.path.lastIndexOf("\\") + 1) : ""
  // $: name = full_name.slice(0, full_name.lastIndexOf("."))

  $: group = slide.group
  $: {
    if (slide.globalGroup && $groups[slide.globalGroup]) {
      if ($groups[slide.globalGroup].default) group = $dictionary.groups[$groups[slide.globalGroup].name]
      else group = $groups[slide.globalGroup].name
      color = $groups[slide.globalGroup].color
    }
  }

  $: name = getGroupName(layoutSlide.id)
  function getGroupName(slideID: string) {
    let name = group
    if (name) {
      // different slides with same name
      let added: any = {}
      Object.entries(show.slides).forEach(([id, a]: any) => {
        if (added[a.group]) {
          added[a.group]++
          if (id === slideID) name += " #" + added[a.group]
        } else added[a.group] = 1
      })

      // same group count
      if ($groupCount) {
        added = {}
        GetLayoutRef().forEach((a: any, i: number) => {
          if (a.type === "parent") {
            if (added[a.id]) {
              added[a.id]++
              if (i === index) name += " " + added[a.id]
            } else added[a.id] = 1
          }
        })
      }
    }
    return name
  }
</script>

<!-- TODO: disabled -->
<!-- https://svelte.dev/repl/3bf15c868aa94743b5f1487369378cf3?version=3.21.0 -->
<!-- animate:flip -->
<!-- class:right={overIndex === index && (!selected.length || index > selected[0])}
class:left={overIndex === index && (!selected.length || index <= selected[0])} -->
<div class="main" style="width: {$slidesOptions.grid ? 100 / columns : 100}%">
  <div
    class="slide context #slide"
    class:active
    class:disabled={layoutSlide.disabled}
    style="background-color: {color};{$slidesOptions.grid ? '' : `width: calc(${100 / columns}% - 6px)`}"
    tabindex={0}
    on:click
  >
    <DropArea id="slide" hoverTimeout={0}>
      <SelectElem id="slide" data={{ index }} draggable trigger={list ? "column" : "row"}>
        <!-- <Draggable direction={list ? "column" : "row"}> -->
        <!-- TODO: tab select on enter -->
        <!-- resolution={{ width: resolution.width * zoom, height: resolution.height * zoom }} -->
        <Zoomed background={slide.items.length ? "black" : "transparent"} let:ratio>
          {#if background}
            <div class="background" style="zoom: {1 / ratio}">
              <MediaLoader name="[[[Could not load]]]" path={background.path} />
            </div>
          {/if}
          <!-- TODO: check if showid exists in shows -->
          {#each slide.items as item}
            <Textbox {item} />
          {/each}
        </Zoomed>
        <!-- TODO: BG: white, color: black -->
        <!-- style="width: {resolution.width * zoom}px;" -->
        <div class="label" title={name || ""}>
          <!-- font-size: 0.8em; -->
          <span style="position: absolute;display: contents;">{index + 1}</span>
          <span class="text">{name || ""}</span>
        </div>
        <!-- </Draggable> -->
      </SelectElem>
    </DropArea>
  </div>
  {#if !$slidesOptions.grid}
    <hr />
    <div class="quickEdit edit" tabindex={0} contenteditable={true}>
      <span>{longestText}</span>
    </div>
  {/if}
</div>

<style>
  .main {
    display: flex;
    position: relative;
    padding: 5px;
    /* height: fit-content; */
  }

  .slide {
    /* padding: 3px; */
    background-color: var(--primary);
    z-index: 0;
    outline-offset: 0;
    width: 100%;

    position: relative;
    display: flex;

    /* height: fit-content; */
    /* border: 2px solid var(--primary-lighter); */
  }
  .slide.active {
    /* outline: 2px solid var(--secondary);
    outline-offset: 4px; */
    outline: 3px solid var(--secondary);
    outline-offset: 4px;
  }
  .slide.disabled {
    opacity: 0.2;
  }

  .background {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
  }
  .background :global(img) {
    width: 100%;
    height: 100%;
    object-fit: contain;
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
