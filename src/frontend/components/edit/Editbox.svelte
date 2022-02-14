<script lang="ts">
  import { onMount } from "svelte"

  // import { onMount } from "svelte"
  import type { Item } from "../../../types/Show"
  import { activeEdit, activeShow, showsCache } from "../../stores"
  import { GetLayoutRef } from "../helpers/get"
  import { history } from "../helpers/history"
  import { _shows } from "../helpers/shows"
  import T from "../helpers/T.svelte"
  import Movebox from "../system/Movebox.svelte"
  import { getCaretCharacterOffsetWithin, setCurrentCursorPosition } from "./tools/TextStyle"

  export let item: Item
  export let index: number
  export let ratio: number

  let itemElem: any

  export let mouse: any
  function mousedown(e: any) {
    activeEdit.update((ae) => {
      if (e.ctrlKey) {
        if (ae.items.includes(index)) {
          if (e.target.closest(".line")) ae.items.splice(ae.items.indexOf(index), 1)
        } else ae.items.push(index)
      } else ae.items = [index]
      return ae
    })
    if ((e.target.closest(".line") && !e.ctrlKey) || e.target.closest(".square") || (e.ctrlKey && !e.target.closest(".line")) || e.altKey) {
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
        // offsetX: (e.clientX - e.target.closest(".slide").offsetLeft) / ratio - item.offsetLeft,
        // offsetY: (e.clientY - e.target.closest(".slide").offsetTop) / ratio - item.offsetTop,
        // offsetWidth: (e.clientX - e.target.closest(".slide").offsetLeft + 125) / ratio - item.offsetWidth + e.target.offsetWidth,
        // offsetHeight: (e.clientY - e.target.closest(".slide").offsetTop) / ratio - item.offsetHeight + e.target.offsetHeight,
        // offsetWidth: e.target.offsetParent.offsetWidth - e.clientX,
        // offsetHeight: e.target.offsetParent.offsetHeight - e.clientY,
        item,
        e: e,
      }
    }
  }

  $: active = $activeShow!.id
  $: layout = $showsCache[active].settings.activeLayout
  $: slide = [$showsCache, GetLayoutRef(active, layout)[$activeEdit.slide!].id][1]

  function keydown(e: any) {
    // TODO:
    // if (e.altKey) lines = []
    // if ctrlkey = select multiple

    // TODO: exlude.....
    if (e.key === "Backspace" && $activeEdit.items.includes(index) && !document.activeElement?.closest(".item") && !document.activeElement?.closest("input")) {
      let items: Item[] = $showsCache[active].slides[slide].items
      let newItems = [...items]

      newItems.splice(index, 1)

      // TODO: not working properly

      history({ id: "deleteItem", oldData: items, newData: newItems, location: { page: "edit", show: $activeShow!, layout: layout, slide: slide } })
    }
  }

  function deselect(e: any) {
    if (!e.ctrlKey && e.target.closest(".item") !== itemElem && !e.target.closest(".editTools")) {
      if ($activeEdit.items.includes(index)) {
        // TODO: clicking another item will add text to that!
        // updateText()
        if (!e.target.closest(".item")) {
          activeEdit.update((ae) => {
            ae.items = []
            return ae
          })
        }
      }
    }

    //  && e.target.tagName !== "INPUT"
    if (window.getSelection() && !e.target.closest(".editTools")) {
      window.getSelection()?.removeAllRanges()
      // } else if (document.selection) {
      //   document.selection.empty()
    }
  }

  // update text on item blur or text cursor move
  let textElem: any
  // function updateText() {
  //   let text: string = textElem.innerText
  //   console.log(text)

  //   // let sel: null | Selection = window.getSelection()
  //   // if (sel?.anchorNode?.parentElement) {
  //   //   let parent: Element = sel.anchorNode.parentElement.closest(".edit")!
  //   //   let index = 0
  //   //   ;[...parent.children].forEach((childElem: any, i: number) => {
  //   //     if (childElem === sel!.anchorNode!.parentElement) index = i
  //   //   })

  //   //   let active = $activeShow!.id
  //   //   let layout: string = $shows[active].settings.activeLayout
  //   //   let slide: string = $shows[active].layouts[layout].slides[$activeEdit.slide!].id
  //   //   // let pos = sel!.anchorOffset!

  //   //   // TODO: breaks dont work
  //   //   // get lengths
  //   //   let textIndex = 0
  //   //   let itemTextLength = 0
  //   //   let oldItemsLength = 0
  //   //   $shows[active].slides[slide].items[$activeEdit.items!].text?.forEach((itemText, i) => {
  //   //     if (i < index) textIndex += itemText.value.length
  //   //     if (i === index) itemTextLength = itemText.value.length
  //   //     oldItemsLength += itemText.value.length
  //   //   })
  //   //   let newTextLength = text.length - oldItemsLength
  //   //   let newItemText = text.slice(textIndex, textIndex + itemTextLength + newTextLength)

  //   //   // WIP
  //   //   shows.update((s) => {
  //   //     let item = GetShow({ id: active }).slides[slide].items[$activeEdit.item!]
  //   //     if (item.text) item.text[index].value = newItemText
  //   //     return s
  //   //   })
  //   // }
  // }

  let html: string = ""
  let previousHTML: string = ""
  let currentStyle: string = ""

  onMount(update)
  $: console.log(item.text?.[0].style)
  $: if (item.text?.[0].style !== currentStyle) update()

  function update() {
    if ($activeEdit.slide !== null) {
      html = ""
      currentStyle = item.text?.[0].style || ""
      item.text?.forEach((a) => {
        let style = a.style ? 'style="' + a.style + '"' : ""
        html += `<span ${style}>` + a.value + "</span>"
      })
      previousHTML = html
    }
  }

  $: console.log(item)

  $: console.log(html, previousHTML)

  // || $showsCache[active].slides
  $: {
    if (textElem && html !== previousHTML) {
      previousHTML = html
      setTimeout(() => {
        console.log(html)
        // let text = _shows([active]).slides([slide]).items([index]).get("text")
        // let textItems = getItems(textElem.children)
        // let values: any = {}
        // if (textItems.length) values = text?.forEach((a, i) => (a.value = textItems[i]))
        // _shows([active]).slides([slide]).items([index]).set({key: "text", values})
        showsCache.update((a) => {
          let text = a[active].slides[slide].items[index].text
          let textItems = getItems(textElem.children)
          if (textItems.length) text?.forEach((a, i) => (a.value = textItems[i]))
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

  function textkey(e: any) {
    // TODO: <br> will breaks the system...
    if (e.key === "Enter") {
      e.preventDefault()
      // get cursor pos & insert <br>
      let pos = getCaretCharacterOffsetWithin(e.target)
      // find pos
      let count: number = 0
      let tag: boolean = false
      let newPos: null | number = null
      html.split("").forEach((char: string, i: number) => {
        if (char === "<") tag = true
        else if (char === ">") tag = false
        else if (!tag) count++
        if (count === pos) newPos = i + 1
      })
      if (newPos !== null) {
        html = html.slice(0, newPos) + "<br>" + html.slice(newPos, html.length)
        console.log(textElem, newPos)

        setCurrentCursorPosition(textElem, newPos)
      }
      console.log(html)
    }
  }
</script>

<svelte:window on:keydown={keydown} on:mousedown={deselect} />

<div
  bind:this={itemElem}
  class="item context #edit_box"
  class:selected={$activeEdit.items.includes(index)}
  style="{item.style}; outline: {3 / ratio}px solid rgb(255 255 255 / 0.2);"
  on:mousedown={mousedown}
>
  <Movebox {ratio} active={$activeEdit.items.includes(index)} />
  <!-- on:input={updateText} -->
  {#if item.text}
    <div class="align" style={item.align}>
      {#if item.text.length < 2 && !item.text?.[0].value.length}
        <span class="placeholder">
          <T id="Type..." />
        </span>
      {/if}
      <div bind:this={textElem} style={item.align} class="edit" contenteditable bind:innerHTML={html} on:keydown={textkey}>
        <!-- {#each item.text as text}
          <span style={text.style}>{@html text.value}</span>
        {/each} -->
      </div>
    </div>
  {/if}
</div>

<style>
  .item {
    outline: 5px solid rgb(255 255 255 / 0.2);
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

  .align,
  .edit {
    height: 100%;
    display: flex;
    text-align: center;
    align-items: center;
  }

  .edit {
    outline: none;
    width: 100%;
    overflow-wrap: break-word;
    /* height: 100%; */
    /* white-space: initial;
    color: white; */
  }
</style>
