<script lang="ts">
  import { onMount } from "svelte"
  import type { Item, Line } from "../../../types/Show"
  import { activeEdit, activeShow, overlays, showsCache, templates } from "../../stores"
  import { GetLayoutRef } from "../helpers/get"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import { _show } from "../helpers/shows"
  import T from "../helpers/T.svelte"
  import Timer from "../slide/views/Timer.svelte"
  import Movebox from "../system/Movebox.svelte"

  // export let items: Item[] | null = null
  export let item: Item
  export let ref: { type?: "show" | "overlay" | "template"; showId?: string; id: string }
  export let index: number
  export let ratio: number = 1
  export let plain: boolean = false

  let itemElem: any

  export let mouse: any = {}
  function mousedown(e: any) {
    activeEdit.update((ae) => {
      if (e.ctrlKey || e.metaKey) {
        if (ae.items.includes(index)) {
          if (e.target.closest(".line")) ae.items.splice(ae.items.indexOf(index), 1)
        } else ae.items.push(index)
      } else ae.items = [index]
      return ae
    })

    if (
      (e.target.closest(".line") && !e.ctrlKey && !e.metaKey) ||
      e.target.closest(".square") ||
      ((e.ctrlKey || e.metaKey) && !e.target.closest(".line")) ||
      e.altKey ||
      e.buttons === 4
    ) {
      let item = e.target.closest(".item")
      mouse = {
        x: e.clientX,
        y: e.clientY,
        width: item.offsetWidth,
        height: item.offsetHeight,
        offset: {
          x: (e.clientX - e.target.closest(".slide").offsetLeft) / ratio - item.offsetLeft,
          y: (e.clientY - e.target.closest(".slide").offsetTop) / ratio - item.offsetTop,
          width: e.clientX / ratio - item.offsetWidth,
          height: e.clientY / ratio - item.offsetHeight,
        },
        item,
        e: e,
      }
    }
  }

  $: active = $activeShow?.id
  $: layout = active && $showsCache[active] ? $showsCache[active].settings.activeLayout : ""
  // export let slide: string = ""
  $: slide = layout && $activeEdit.slide !== null && $activeEdit.slide !== undefined ? [$showsCache, GetLayoutRef(active, layout)[$activeEdit.slide].id][1] : null

  function keydown(e: any) {
    // TODO: exlude.....
    if (e.key === "Backspace" && $activeEdit.items.includes(index) && !document.activeElement?.closest(".item") && !document.activeElement?.closest("input")) {
      // if (!items && active) items = $showsCache[active].slides[slide].items
      // let newItems = [...(items || [])]
      // newItems.splice(index, 1)

      // TODO: not working properly

      history({ id: "deleteItem", location: { page: "edit", show: $activeShow!, items: $activeEdit.items, layout: layout, slide: slide } })

      _show($activeShow!.id).set({ key: "timestamps.modified", value: new Date().getTime() })
    }
  }

  function deselect(e: any) {
    if (e.target.closest(".editTools") || e.target.closest(".drawer") || e.target.closest(".contextMenu")) return

    if (!e.ctrlKey && !e.metaKey && e.target.closest(".item") !== itemElem) {
      if ($activeEdit.items.includes(index)) {
        if (!e.target.closest(".item")) {
          activeEdit.update((ae) => {
            ae.items = []
            return ae
          })
        }
      }
    }

    //  && e.target.tagName !== "INPUT"
    if (window.getSelection()) {
      window.getSelection()?.removeAllRanges()
      // } else if (document.selection) {
      //   document.selection.empty()
    }
  }

  let textElem: any
  let html: string = ""
  let previousHTML: string = ""
  let currentStyle: string = ""

  onMount(update)
  let currentSlide: number = -1
  $: if ($activeEdit.slide !== null && $activeEdit.slide !== undefined && $activeEdit.slide !== currentSlide) {
    currentSlide = $activeEdit.slide
    console.log($activeEdit.slide)
    setTimeout(update, 10)
    // update()
  }
  $: {
    let s = ""
    item?.lines?.forEach((line) => {
      s += line.align
      line.text?.forEach((a) => {
        s += a.style
      })
    })

    console.log(currentStyle, s)
    if (currentStyle !== s) update()
  }

  function update() {
    if (plain || $activeEdit.slide !== null) {
      console.log(item)
      // html = `<div class="align" style="${item.align}">`
      html = ""
      currentStyle = ""
      item?.lines?.forEach((line) => {
        // TODO: break ...:
        currentStyle += line.align
        let style = line.align ? 'style="' + line.align + '"' : ""
        html += `<div class="break" ${plain ? "" : style}>`
        line.text?.forEach((a) => {
          currentStyle += a.style
          let style = a.style ? 'style="' + a.style + '"' : ""
          html += `<span ${plain ? "" : style}>` + a.value + "</span>"
        })
        html += "</div>"
      })
      // html += "</div>"
      previousHTML = html
    }
  }

  // let sel = getSelectionRange()

  $: {
    if (textElem && html !== previousHTML) {
      previousHTML = html
      // let pos = getCaretCharacterOffsetWithin(textElem)
      setTimeout(() => {
        let newLines: Line[] = getNewLines()
        console.log("NEW", newLines)
        if ($activeEdit.type === "overlay") {
          overlays.update((a) => {
            a[$activeEdit.id!].items[index].lines = newLines
            return a
          })
        } else if ($activeEdit.type === "template") {
          templates.update((a) => {
            a[$activeEdit.id!].items[index].lines = newLines
            return a
          })
        } else if (ref.id) {
          showsCache.update((a) => {
            // let lines = a[active].slides[slide].items[index].lines
            // console.log(a, active, ref.id, index, a[active!].slides[ref.id].items[index].lines, newLines)

            a[active!].slides[ref.id].items[index].lines = newLines
            return a
          })

          _show(active).set({ key: "timestamps.modified", value: new Date().getTime() })
        }
      }, 10)
    }
  }

  function getNewLines() {
    let newLines: Line[] = []
    let pos: number = -1
    currentStyle = ""
    new Array(...textElem.children).forEach((line: any, i: number) => {
      let align: string = plain ? item.lines![i]?.align || "" : line.getAttribute("style") || ""
      pos++
      currentStyle += align
      newLines.push({ align, text: [] })
      new Array(...line.children).forEach((child: any, j: number) => {
        let style = plain ? item.lines![i]?.text[j]?.style || "" : child.getAttribute("style") || ""
        newLines[pos].text.push({ style, value: child.innerText })
        currentStyle += style
      })
    })
    return newLines
  }
</script>

<svelte:window on:keydown={keydown} on:mousedown={deselect} />

<div
  bind:this={itemElem}
  class={plain ? "" : "item context #edit_box"}
  class:selected={$activeEdit.items.includes(index)}
  style={plain ? "width: 100%;" : `${item?.style}; outline: ${3 / ratio}px solid rgb(255 255 255 / 0.2);`}
  on:mousedown={mousedown}
>
  {#if !plain}
    <Movebox {ratio} active={$activeEdit.items.includes(index)} />
  {/if}
  <!-- on:input={updateText} -->
  {#if item?.lines}
    <!-- TODO: remove align..... -->
    <div class="align" class:plain style={plain ? null : item.align || null}>
      {#if item.lines?.length < 2 && !item.lines?.[0]?.text[0]?.value.length}
        <span class="placeholder">
          <T id="empty.text" />
        </span>
      {/if}
      <!-- {#each item.lines as line}
        <div class="align" style={line.align}> -->
      <!-- on:keydown={textkey} -->
      <div
        bind:this={textElem}
        class="edit"
        contenteditable
        bind:innerHTML={html}
        style={plain ? null : item.align ? item.align.replace("align-items", "justify-content") : null}
        class:height={item.lines?.length < 2 && !item.lines?.[0]?.text[0].value.length}
      >
        <!-- {#each item.text as text}
            <span style={text.style}>{@html text.value}</span>
          {/each} -->
      </div>
      <!-- </div>
      {/each} -->
    </div>
  {:else if item?.type === "timer"}
    <Timer {item} {ref} />
  {:else if item?.type === "icon"}
    <Icon style="zoom: {1 / ratio};" id={item.id || ""} fill white custom />
  {/if}
</div>

<style>
  .item {
    outline: 5px solid rgb(255 255 255 / 0.2);
    transition: background-color 0.3s;
    /* cursor: text; */
  }
  .item.selected {
    outline: 5px solid var(--secondary);
    overflow: visible;
  }
  .item .placeholder {
    opacity: 0.5;
    pointer-events: none;
    position: absolute;
    width: 100%;
  }
  .item:hover {
    /* .item:hover > .edit { */
    background-color: rgb(255 255 255 / 0.05);
  }

  .align {
    height: 100%;
    display: flex;
    text-align: center;
    align-items: center;
  }
  .align.plain {
    text-align: left;
  }

  .edit {
    outline: none;
    width: 100%;
    height: 100%;
    overflow-wrap: break-word;
    font-size: 0;
    /* display: inline-block; */
    /* height: 100%; */
    /* white-space: initial; */

    display: flex;
    flex-direction: column;
    text-align: center;
    justify-content: center;
    /* align-items: center; */
  }
  .plain .edit {
    font-size: 1.5em;
    justify-content: flex-start;
    text-align: left;
  }

  .edit.height {
    font-size: unset;
  }
  .edit.height :global(.break) {
    height: 1em;
  }
  .edit.height :global(span) {
    height: 100%;
    display: block;
  }

  .edit :global(.break) {
    /* display: contents; */
    width: 100%;
    /* line-height: normal; */
  }

  .edit:not(.plain .edit) :global(span) {
    font-size: 100px;
    /* min-height: 100px;
    min-width: 100px;
    display: inline-table; */
  }
</style>
