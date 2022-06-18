<script lang="ts">
  import { onMount } from "svelte"
  import { uid } from "uid"
  import type { Item, Line } from "../../../types/Show"
  import { activeEdit, activeShow, overlays, showsCache, templates } from "../../stores"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import { addToPos } from "../helpers/mover"
  import { _show } from "../helpers/shows"
  import T from "../helpers/T.svelte"
  import Timer from "../slide/views/Timer.svelte"
  import Movebox from "../system/Movebox.svelte"
  import { getSelectionRange } from "./scripts/textStyle"

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

    let target = e.target.closest(".item")
    mouse = {
      x: e.clientX,
      y: e.clientY,
      width: target.offsetWidth,
      height: target.offsetHeight,
      top: target.offsetTop,
      left: target.offsetLeft,
      offset: {
        x: (e.clientX - e.target.closest(".slide").offsetLeft) / ratio - target.offsetLeft,
        y: (e.clientY - e.target.closest(".slide").offsetTop) / ratio - target.offsetTop,
        width: e.clientX / ratio - target.offsetWidth,
        height: e.clientY / ratio - target.offsetHeight,
      },
      item,
      e: e,
    }
  }

  $: active = $activeShow?.id
  $: layout = active && $showsCache[active] ? $showsCache[active].settings.activeLayout : ""
  // $: slide = layout && $activeEdit.slide !== null && $activeEdit.slide !== undefined ? [$showsCache, GetLayoutRef(active, layout)[$activeEdit.slide].id][1] : null

  function keydown(e: any) {
    if (e.key === "Enter" && e.altKey) {
      // split
      let sel = getSelectionRange()
      if (!sel) return

      // if (sel.start === sel.end) {
      let lines: Line[] = getNewLines()
      let firstLines: Line[] = []
      let secondLines: Line[] = []
      let currentIndex = 0,
        textPos = 0
      let start = -1
      lines.forEach((line, i) => {
        if (start > -1 && currentIndex >= start) secondLines.push({ align: line.align, text: [] })
        else firstLines.push({ align: line.align, text: [] })

        textPos = 0
        line.text.forEach((text) => {
          currentIndex += text.value.length
          if (sel[i]?.start !== undefined) start = sel[i].start

          if (start > -1 && currentIndex >= start) {
            if (!secondLines.length) secondLines.push({ align: line.align, text: [] })
            let pos = sel[i].start - textPos
            if (pos > 0) firstLines[firstLines.length - 1].text.push({ style: text.style, value: text.value.slice(0, pos) })
            secondLines[secondLines.length - 1].text.push({ style: text.style, value: text.value.slice(pos, text.value.length) })
          } else {
            firstLines[firstLines.length - 1].text.push({ style: text.style, value: text.value })
          }
          textPos += text.value.length
        })
      })

      let defaultLine = [{ align: lines[0].align || "", text: [{ style: lines[0].text[0]?.style || "", value: "" }] }]
      if (!firstLines.length || !firstLines[0].text.length) firstLines = defaultLine
      if (!secondLines.length) secondLines = defaultLine

      let slideRef: any = _show("active").layouts("active").ref()[0][$activeEdit.slide!]

      // create new slide
      let newSlide = { ..._show("active").slides([ref.id]).get()[0] }
      newSlide.items[$activeEdit.items[0] || 0].lines = secondLines
      delete newSlide.id
      delete newSlide.globalGroup
      newSlide.group = null
      newSlide.color = null

      // add new slide
      let id = uid()
      _show("active")
        .slides([id])
        .add([JSON.parse(JSON.stringify(newSlide))])

      // update slide
      updateLines(firstLines)

      // set child
      let parentId = slideRef.type === "child" ? slideRef.parent.id : slideRef.id
      let children = _show("active").slides([parentId]).get("children")[0] || []
      let slideIndex = slideRef.type === "child" ? slideRef.index + 1 : 0
      children = addToPos(children, [id], slideIndex)
      _show("active").slides([parentId]).set({ key: "children", value: children })

      activeEdit.set({ slide: $activeEdit.slide! + 1, items: [] })
    }

    if (e.key === "Escape") {
      ;(document.activeElement as HTMLElement).blur()
      window.getSelection()?.removeAllRanges()
      if ($activeEdit.items.length) {
        activeEdit.update((a) => {
          a.items = []
          return a
        })
      }
    }

    if (!$activeEdit.items.includes(index) || document.activeElement?.closest(".item") || document.activeElement?.closest("input")) return

    if (e.key === "Backspace" || e.key === "Delete") {
      history({ id: "deleteItem", location: { page: "edit", show: $activeShow!, items: $activeEdit.items, layout: layout, slide: ref.id } })
    }
  }

  function deselect(e: any) {
    if (e.target.closest(".editTools") || e.target.closest(".drawer") || e.target.closest(".contextMenu")) return
    if (e.ctrlKey || e.metaKey || e.target.closest(".item") === itemElem || !$activeEdit.items.includes(index) || e.target.closest(".item")) return

    if (window.getSelection()) window.getSelection()?.removeAllRanges()

    activeEdit.update((ae) => {
      ae.items = []
      return ae
    })
  }

  let textElem: any
  let html: string = ""
  let previousHTML: string = ""
  let currentStyle: string = ""

  onMount(getStyle)
  let currentSlide: number = -1
  $: if ($activeEdit.slide !== null && $activeEdit.slide !== undefined && $activeEdit.slide !== currentSlide) {
    currentSlide = $activeEdit.slide
    setTimeout(getStyle, 10)
  }

  $: {
    console.log("ITEM", JSON.parse(JSON.stringify(item)))

    let s = ""
    item?.lines?.forEach((line) => {
      s += line.align
      line.text?.forEach((a) => {
        s += a.style
      })
    })

    console.log(currentStyle, s)
    if (currentStyle !== s) getStyle()
  }

  function getStyle() {
    if (!plain && $activeEdit.slide === null) return

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
    previousHTML = html
  }

  // let sel = getSelectionRange()

  $: if (textElem && html !== previousHTML) {
    previousHTML = html
    // let pos = getCaretCharacterOffsetWithin(textElem)
    setTimeout(updateLines, 10)
  }

  function updateLines(newLines: Line[]) {
    if (!newLines) newLines = getNewLines()
    if ($activeEdit.type === "overlay") overlays.update(setNewLines)
    else if ($activeEdit.type === "template") templates.update(setNewLines)
    else if (ref.id) {
      _show("active")
        .slides([ref.id])
        .items([index])
        .set({ key: "lines", values: [newLines] })
    }

    function setNewLines(a: any) {
      a[$activeEdit.id!].items[index].lines = newLines
      return a
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

  // timer
  let today = new Date()
  setInterval(() => (today = new Date()), 1000)

  // paste
  function paste(e: any) {
    e.preventDefault()
    let clipboard = e.clipboardData.getData("text/plain")
    console.log(clipboard)

    let sel = getSelectionRange()
    let lines: Line[] = getNewLines()

    sel.forEach((lineSel, i) => {
      console.log(lineSel)
      if (lineSel.start !== undefined) {
        let pos = 0
        let pasted = false
        lines[i].text.forEach(({ value }, j) => {
          console.log(pos, lineSel.start, value)
          if (!pasted && pos + value.length >= lineSel.start) {
            let caretPos = lineSel.start - pos
            lines[i].text[j].value = value.slice(0, caretPos) + clipboard + value.slice(caretPos, value.length)
            pasted = true
          }
          pos += value.length
        })
      }
    })

    updateLines(lines)
    getStyle()
    // TODO: set caret position
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
  {#if item?.lines}
    <!-- TODO: remove align..... -->
    <div class="align" class:plain style={plain ? null : item.align || null}>
      {#if item.lines?.length < 2 && !item.lines?.[0]?.text[0]?.value.length}
        <span class="placeholder">
          <T id="empty.text" />
        </span>
      {/if}
      <div
        bind:this={textElem}
        class="edit"
        contenteditable
        on:paste={paste}
        bind:innerHTML={html}
        style={plain ? null : item.align ? item.align.replace("align-items", "justify-content") : null}
        class:height={item.lines?.length < 2 && !item.lines?.[0]?.text[0]?.value.length}
      />
    </div>
  {:else if item?.type === "timer"}
    <Timer {item} {ref} {today} />
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
