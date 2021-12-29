<script lang="ts">
  import type { Item } from "../../../types/Show"
  import { activeShow, activeEdit, shows } from "../../stores"
  import { history } from "../helpers/history"
  import T from "../helpers/T.svelte"
  import Movebox from "../system/Movebox.svelte"

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
      mouse = {
        x: e.clientX,
        y: e.clientY,
        offset: {
          x: (e.clientX - e.target.closest(".slide").offsetLeft) / ratio - e.target.closest(".item").offsetLeft,
          y: (e.clientY - e.target.closest(".slide").offsetTop) / ratio - e.target.closest(".item").offsetTop,
          width: e.clientX / ratio - e.target.closest(".item").offsetWidth,
          height: e.clientY / ratio - e.target.closest(".item").offsetHeight,
        },
        // offsetX: (e.clientX - e.target.closest(".slide").offsetLeft) / ratio - e.target.closest(".item").offsetLeft,
        // offsetY: (e.clientY - e.target.closest(".slide").offsetTop) / ratio - e.target.closest(".item").offsetTop,
        // offsetWidth: (e.clientX - e.target.closest(".slide").offsetLeft + 125) / ratio - e.target.closest(".item").offsetWidth + e.target.offsetWidth,
        // offsetHeight: (e.clientY - e.target.closest(".slide").offsetTop) / ratio - e.target.closest(".item").offsetHeight + e.target.offsetHeight,
        // offsetWidth: e.target.offsetParent.offsetWidth - e.clientX,
        // offsetHeight: e.target.offsetParent.offsetHeight - e.clientY,
        e: e,
      }
    }
  }

  function keydown(e: any) {
    // TODO:
    // if (e.altKey) lines = []
    // if ctrlkey = select multiple

    // TODO: exlude.....
    if (e.key === "Backspace" && $activeEdit.items.includes(index) && !document.activeElement?.closest(".item") && !document.activeElement?.closest("input")) {
      let active = $activeShow!.id
      let layout: string = $shows[active].settings.activeLayout
      let slide: string = $shows[active].layouts[layout].slides[$activeEdit.slide!].id
      let items: Item[] = $shows[active].slides[slide].items
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
        updateText()
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
  function updateText() {
    let text: string = textElem.innerText
    console.log(text)

    // let sel: null | Selection = window.getSelection()
    // if (sel?.anchorNode?.parentElement) {
    //   let parent: Element = sel.anchorNode.parentElement.closest(".edit")!
    //   let index = 0
    //   ;[...parent.children].forEach((childElem: any, i: number) => {
    //     if (childElem === sel!.anchorNode!.parentElement) index = i
    //   })

    //   let active = $activeShow!.id
    //   let layout: string = $shows[active].settings.activeLayout
    //   let slide: string = $shows[active].layouts[layout].slides[$activeEdit.slide!].id
    //   // let pos = sel!.anchorOffset!

    //   // TODO: breaks dont work
    //   // get lengths
    //   let textIndex = 0
    //   let itemTextLength = 0
    //   let oldItemsLength = 0
    //   $shows[active].slides[slide].items[$activeEdit.items!].text?.forEach((itemText, i) => {
    //     if (i < index) textIndex += itemText.value.length
    //     if (i === index) itemTextLength = itemText.value.length
    //     oldItemsLength += itemText.value.length
    //   })
    //   let newTextLength = text.length - oldItemsLength
    //   let newItemText = text.slice(textIndex, textIndex + itemTextLength + newTextLength)

    //   // WIP
    //   shows.update((s) => {
    //     let item = GetShow({ id: active }).slides[slide].items[$activeEdit.item!]
    //     if (item.text) item.text[index].value = newItemText
    //     return s
    //   })
    // }
  }

  function type(e: any) {
    console.log(e)
    // TODO: update text
  }
</script>

<svelte:window on:keydown={keydown} on:mousedown={deselect} />

<div
  bind:this={itemElem}
  class="item"
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
      <div bind:this={textElem} class="edit" contenteditable={true} on:keydown={type}>
        {#each item.text as text}
          <span style={text.style}>{text.value}</span>
        {/each}
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

  .align {
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
