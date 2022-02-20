<script lang="ts">
  import { onMount } from "svelte"
  import type { Show, Slide, SlideData } from "../../../types/Show"
  import { activeShow, dictionary, fullColors, groupCount, groupNumbers, groups, overlays, showsCache, slidesOptions } from "../../stores"
  import MediaLoader from "../drawer/media/MediaLoader.svelte"
  import { getItemText } from "../edit/tools/textStyle"
  import { getContrast } from "../helpers/color"
  import { GetLayoutRef } from "../helpers/get"
  import SelectElem from "../system/SelectElem.svelte"
  import Icons from "./Icons.svelte"
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
  export let endIndex: null | number = null
  export let icons: boolean = false
  export let noQuickEdit: boolean = false

  // let longestText: string = ""
  // $: {
  //   longestText = ""
  //   slide.items.forEach((item) => {
  //     if (item.text) {
  //       let t = ""
  //       item.text.forEach((text) => {
  //         t += text.value
  //       })
  //       if (t.length > longestText.length) longestText = t
  //     }
  //   })
  // }

  $: background = layoutSlide.background ? show.media[layoutSlide.background] : null
  let duration: number = 0
  // $: full_name = background ? background.path.substring(background.path.lastIndexOf("\\") + 1) : ""
  // $: name = full_name.slice(0, full_name.lastIndexOf("."))

  $: group = slide.group
  $: {
    if (slide.globalGroup && $groups[slide.globalGroup]) {
      if ($groups[slide.globalGroup].default) group = $dictionary.groups?.[$groups[slide.globalGroup].name]
      else group = $groups[slide.globalGroup].name
      color = $groups[slide.globalGroup].color
    }
  }

  $: name = getGroupName(layoutSlide.id)
  // dynamic counter
  function getGroupName(slideID: string) {
    let name = group
    if (name && $groupNumbers) {
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

  // quick edit
  let html: string = ""
  let previousHTML: string = ""
  let longest: any = null

  onMount(() => {
    let texts: any[] = slide.items.map((item) => getItemText(item))
    let prev: any = null
    texts.forEach((a, i) => {
      if (!prev || a.length > prev) {
        prev = a.length
        longest = i
      }
    })
    if (longest !== null) update()
  })

  function update() {
    // html = `<div class="align" style="${item.align}">`
    html = ""
    slide.items[longest].lines?.forEach((line) => {
      line.text.forEach((a) => {
        html += a.value
      })
    })
    previousHTML = html
  }

  // || $showsCache[active].slides
  let textElem: any
  $: {
    if (textElem && html !== previousHTML) {
      previousHTML = html
      setTimeout(() => {
        // console.log(html)
        // let text = _shows([active]).slides([slide]).items([index]).get("text")
        // let textItems = getItems(textElem.children)
        // let values: any = {}
        // if (textItems.length) values = text?.forEach((a, i) => (a.value = textItems[i]))
        // _shows([active]).slides([slide]).items([index]).set({key: "text", values})
        showsCache.update((a) => {
          let lines = a[$activeShow!.id].slides[layoutSlide.id].items[longest].lines
          let textItems = getItems(textElem.children)
          if (textItems.length) {
            lines?.forEach((line) => {
              line.text.forEach((a, i) => (a.value = textItems[i]))
            })
          }
          return a
        })
      }, 10)
    }
  }

  function getItems(children: any): any[] {
    let textItems: any[] = []
    new Array(...children).forEach((child: any) => {
      if (child.innerHTML) textItems.push(child.innerHTML)
    })
    return textItems
  }
</script>

<!-- TODO: disabled -->
<!-- https://svelte.dev/repl/3bf15c868aa94743b5f1487369378cf3?version=3.21.0 -->
<!-- animate:flip -->
<!-- class:right={overIndex === index && (!selected.length || index > selected[0])}
class:left={overIndex === index && (!selected.length || index <= selected[0])} -->
<div class="main" class:active style="width: {$slidesOptions.grid || noQuickEdit ? 100 / columns : 100}%">
  {#if icons}
    <Icons {layoutSlide} {background} {duration} {columns} {index} />
  {/if}
  <div
    class="slide context #slide"
    class:disabled={layoutSlide.disabled}
    class:afterEnd={endIndex !== null && index > endIndex}
    style="{$fullColors ? 'background-' : ''}color: {color};{$slidesOptions.grid || noQuickEdit ? '' : `width: calc(${100 / columns}% - 6px)`}"
    tabindex={0}
    on:click
  >
    <div class="hover overlay" />
    <!-- <DropArea id="slide" hoverTimeout={0} file> -->
    <div style="width: 100%;height: 100%;">
      <SelectElem id="slide" data={{ index }} draggable trigger={list ? "column" : "row"}>
        <!-- TODO: tab select on enter -->
        <!-- resolution={{ width: resolution.width * zoom, height: resolution.height * zoom }} -->
        <Zoomed background={slide.items.length ? "black" : "transparent"} let:ratio zoom>
          {#if background}
            {#key background}
              <div class="background" style="zoom: {1 / ratio}">
                <MediaLoader name={$dictionary.error?.load} path={background.path} type={background.type !== "player" ? background.type : null} bind:duration />
              </div>
            {/key}
          {/if}
          <!-- TODO: check if showid exists in shows -->
          {#each slide.items as item}
            <Textbox {item} />
          {/each}
          {#if layoutSlide.overlays?.length}
            {#each layoutSlide.overlays as id}
              {#if $overlays[id]}
                {#each $overlays[id].items as item}
                  <Textbox {item} />
                {/each}
              {/if}
            {/each}
          {/if}
        </Zoomed>
        <!-- TODO: BG: white, color: black -->
        <!-- style="width: {resolution.width * zoom}px;" -->
        <div class="label" title={name || ""} style="color: {$fullColors && color ? getContrast(color) : 'unset'};">
          <!-- font-size: 0.8em; -->
          <span style="position: absolute;display: contents;">{index + 1}</span>
          <span class="text">{name === null ? "" : name || "—"}</span>
        </div>
      </SelectElem>
    </div>
    <!-- </DropArea> -->
  </div>
  {#if !$slidesOptions.grid && !noQuickEdit}
    <hr />
    <div bind:this={textElem} class="quickEdit edit" tabindex={0} contenteditable bind:innerHTML={html}>
      {@html html}
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
  .main.active {
    /* outline: 3px solid var(--secondary); */
    outline: 2px solid var(--secondary);
    outline-offset: -1px;
    z-index: 2;
  }
  .slide.afterEnd {
    opacity: 0.7;
  }
  .slide.disabled {
    opacity: 0.2;
  }

  .slide:hover > .hover {
    /* background-color: var(--primary-lighter); */
    /* filter: brightness(1.1); */
    opacity: 1;
  }
  .hover {
    pointer-events: none;
    width: 100%;
    height: 100%;
    opacity: 0;
    background-color: rgb(255 255 255 / 0.05);
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
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
    padding: 10px;
    flex: 1;
  }
</style>
