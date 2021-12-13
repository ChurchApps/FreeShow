<script lang="ts">
  import type { Item } from "../../../types/Show"
  import { activeShow, activeEdit, shows } from "../../stores"
  import { GetLayout, GetShow } from "../helpers/get"
  import { history } from "../helpers/history"

  export let item: Item
  export let index: number
  export let zoom: number

  // export let slideElem: any
  let itemElem: any

  let selected: boolean = false

  // $: style = item.style

  $: layoutSlides = GetLayout($activeShow!.id)
  // $: itemStore = $shows[$activeShow!.id].slides[layoutSlides[$activeEdit].id].items[index]

  let squares = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]
  let lines = ["n", "e", "s", "w"]
  let snap = 8
  export let helperLines: any

  interface Mouse {
    x: number
    y: number
    offset: {
      x: number
      y: number
      width: number
      height: number
    }
    // offsetWidth: number
    // offsetHeight: number
    e: any
  }
  let mouse: null | Mouse = null
  function mousedown(e: any) {
    selected = true
    activeEdit.update((ae) => {
      ae.item = index
      return ae
    })
    if (e.target.closest(".line") || e.target.closest(".square") || e.ctrlKey || e.altKey) {
      mouse = {
        x: e.clientX,
        y: e.clientY,
        offset: {
          x: (e.clientX - e.target.closest(".slide").offsetLeft) / zoom - e.target.closest(".item").offsetLeft,
          y: (e.clientY - e.target.closest(".slide").offsetTop) / zoom - e.target.closest(".item").offsetTop,
          width: e.clientX / zoom - e.target.closest(".item").offsetWidth,
          height: e.clientY / zoom - e.target.closest(".item").offsetHeight,
        },
        // offsetX: (e.clientX - e.target.closest(".slide").offsetLeft) / zoom - e.target.closest(".item").offsetLeft,
        // offsetY: (e.clientY - e.target.closest(".slide").offsetTop) / zoom - e.target.closest(".item").offsetTop,
        // offsetWidth: (e.clientX - e.target.closest(".slide").offsetLeft + 125) / zoom - e.target.closest(".item").offsetWidth + e.target.offsetWidth,
        // offsetHeight: (e.clientY - e.target.closest(".slide").offsetTop) / zoom - e.target.closest(".item").offsetHeight + e.target.offsetHeight,
        // offsetWidth: e.target.offsetParent.offsetWidth - e.clientX,
        // offsetHeight: e.target.offsetParent.offsetHeight - e.clientY,
        e: e,
      }
    }
  }

  const getStyles = (str: string) => {
    let styles: any = {}
    str.split(";").forEach((s) => {
      if (s.length) styles[s.slice(0, s.indexOf(":")).trim()] = s.slice(s.indexOf(":") + 1, s.length).trim()
    })
    return styles
  }
  function mousemove(e: any) {
    if (mouse) {
      let styles: any = getStyles(item.style)
      // let styles: any = {}
      // item.style.split(";").forEach((s) => {
      //   if (s.length) styles[s.slice(0, s.indexOf(":")).trim()] = s.slice(s.indexOf(":") + 1, s.length).trim()
      // })

      if (mouse.e.target.closest(".line") || mouse.e.ctrlKey || mouse.e.altKey) {
        e.preventDefault()
        styles.left = (e.clientX - itemElem.closest(".slide").offsetLeft) / zoom - mouse.offset.x
        styles.top = (e.clientY - itemElem.closest(".slide").offsetTop) / zoom - mouse.offset.y
        // styles.left = (itemElem.closest(".slide").offsetLeft) - mouse.offset.x / zoom
        // styles.top = (e.clientY - itemElem.closest(".slide").offsetTop) / zoom - mouse.offset.y

        if (!e.altKey) {
          let slideWidth = Math.round(itemElem.closest(".slide").offsetWidth / zoom)
          let slideHeight = Math.round(itemElem.closest(".slide").offsetHeight / zoom)

          // slide snap
          let xLines = [0, slideWidth / 2, slideWidth]
          let yLines = [0, slideHeight / 2, slideHeight]
          // item snap
          let xItems = [0, itemElem.offsetWidth / 2, itemElem.offsetWidth]
          let yItems = [0, itemElem.offsetHeight / 2, itemElem.offsetHeight]
          // snap margin
          let margin = snap / zoom

          // TODO: gravit, snap to gaps++

          // get other items pos
          $shows[$activeShow!.id].slides[layoutSlides[$activeEdit.slide!].id].items.forEach((itm, i) => {
            if (i !== index) {
              let style = getStyles(itm.style)
              Object.entries(style).map((s: any) => (style[s[0]] = Number(s[1].replace(/\D.+/g, ""))))
              xLines.push(style.left, style.left + style.width / 2, style.left + style.width)
              yLines.push(style.top, style.top + style.height / 2, style.top + style.height)
            }
          })

          xLines.forEach((xl) => {
            let match = false
            xItems.forEach((xi) => {
              if (styles.left > xl - xi - margin && styles.left < xl - xi + margin) {
                styles.left = xl - xi
                match = true
              }
            })
            if (match && !helperLines.includes("x" + xl)) helperLines = [...helperLines, "x" + xl]
            else if (!match && helperLines.includes("x" + xl)) helperLines = helperLines.filter((m: any) => m !== "x" + xl)
          })
          yLines.forEach((yl) => {
            let match = false
            yItems.forEach((yi) => {
              if (styles.top > yl - yi - margin && styles.top < yl - yi + margin) {
                styles.top = yl - yi
                match = true
              }
            })
            if (match && !helperLines.includes("y" + yl)) helperLines = [...helperLines, "y" + yl]
            else if (!match && helperLines.includes("y" + yl)) helperLines = helperLines.filter((m: any) => m !== "y" + yl)
          })
        } else helperLines = []
        styles.left += "px"
        styles.top += "px"
      } else if (mouse.e.target.closest(".square")) {
        // TODO: shiftkey
        // TODO: snap to resize...
        let store = null
        let square = mouse.e.target.closest(".square")
        if (square.classList[1].includes("n")) {
          styles.top = (e.clientY - itemElem.closest(".slide").offsetTop) / zoom - mouse.offset.y + "px"
          styles.height = e.clientY / zoom - mouse.offset.height + "px"
          if (e.shiftKey) store = e.clientY / zoom - mouse.offset.height + "px"
          // styles.height = e.clientY / zoom - mouse.offset.height + "px"
          // styles.height = e.clientY / zoom - mouse.offset.height - (e.clientY - itemElem.closest(".slide").offsetTop) / zoom - mouse.offset.y + "px"
          // styles.height = mouse.offset.y - itemElem.offsetHeight - (e.clientY - e.target.closest(".slide").offsetTop) / zoom + "px"
          // styles.height = mouse.offsetHeight - (e.clientY - e.target.closest(".slide").offsetTop) / zoom + "px"
          // styles.height = mouse.offsetHeight + itemElem.closest(".item").offsetHeight - (e.clientY - e.target.closest(".slide").offsetTop) / zoom + "px"
          // styles.height = mouse.offsetHeight + itemElem.closest(".item").offsetTop - (e.clientY - itemElem.closest(".slide").offsetTop) / zoom + "px"
        }
        if (square.classList[1].includes("e")) {
          // styles.width = (e.clientX - e.target.closest(".slide").offsetLeft) / zoom - mouse.offset.x + "px"
          if (!e.shiftKey || store === null) {
            styles.width = e.clientX / zoom - mouse.offset.width + "px"
            store = e.clientX / zoom - mouse.offset.width + "px"
          } else styles.width = store
        }
        if (square.classList[1].includes("s")) {
          // styles.height = e.clientY / zoom - mouse.offset.y + itemElem.offsetHeight + "px"

          if (!e.shiftKey || store === null) {
            styles.height = e.clientY / zoom - mouse.offset.height + "px"
            store = e.clientY / zoom - mouse.offset.height + "px"
          } else styles.height = store
        }
        if (square.classList[1].includes("w")) {
          styles.left = (e.clientX - itemElem.closest(".slide").offsetLeft) / zoom - mouse.offset.x + "px"
          // styles.width = e.clientX / zoom - mouse.offsetWidth + "px"
          // styles.width = mouse.offset.x - itemElem.offsetWidth - (e.clientX - e.target.closest(".slide").offsetLeft) / zoom + "px"

          if (!e.shiftKey || store === null) {
            styles.width = e.clientX / zoom - mouse.offset.width + "px"
            store = e.clientX / zoom - mouse.offset.width + "px"
          }
        }
      }

      let textStyles: string = ""
      Object.entries(styles).forEach((obj) => {
        textStyles += obj[0] + ":" + obj[1] + ";"
      })
      shows.update((s) => {
        s[$activeShow!.id].slides[layoutSlides[$activeEdit.slide!].id].items[index].style = textStyles
        return s
      })
    }
  }
  function mouseup() {
    mouse = null
    helperLines = []
  }

  function keydown(e: any) {
    // TODO:
    // if (e.altKey) helperLines = []
    // if ctrlkey = select multiple

    if (e.key === "Backspace" && selected === true && !document.activeElement?.closest(".item")) {
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
      if (selected) {
        // TODO: clicking another item will add text to that!
        updateText()
        if (!e.target.closest(".item")) {
          activeEdit.update((ae) => {
            ae.item = null
            return ae
          })
        }
      }
      selected = false
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

    let sel: null | Selection = window.getSelection()
    if (sel?.anchorNode?.parentElement) {
      let parent: Element = sel.anchorNode.parentElement.closest(".edit")!
      let index = 0
      ;[...parent.children].forEach((childElem: any, i: number) => {
        if (childElem === sel!.anchorNode!.parentElement) index = i
      })

      let active = $activeShow!.id
      let layout: string = $shows[active].settings.activeLayout
      let slide: string = $shows[active].layouts[layout].slides[$activeEdit.slide!].id
      // let pos = sel!.anchorOffset!

      // TODO: breaks dont work
      // get lengths
      let textIndex = 0
      let itemTextLength = 0
      let oldItemsLength = 0
      $shows[active].slides[slide].items[$activeEdit.item!].text?.forEach((itemText, i) => {
        if (i < index) textIndex += itemText.value.length
        if (i === index) itemTextLength = itemText.value.length
        oldItemsLength += itemText.value.length
      })
      let newTextLength = text.length - oldItemsLength
      let newItemText = text.slice(textIndex, textIndex + itemTextLength + newTextLength)

      shows.update((s) => {
        let item = GetShow({ id: active }).slides[slide].items[$activeEdit.item!]
        if (item.text) item.text[index].value = newItemText
        return s
      })
    }
  }

  // TODO: sometimes huge font
</script>

<svelte:window on:mousemove={mousemove} on:mouseup={mouseup} on:keydown={keydown} on:mousedown={deselect} />

<div bind:this={itemElem} class="item" class:selected style="{item.style}; outline: {3 / zoom}px solid rgb(255 255 255 / 0.2);" on:mousedown={mousedown}>
  <section>
    {#each lines as line}
      <div class="line {line}l" style="{line === 'n' || line === 's' ? 'height' : 'width'}: 10px;" />
    {/each}
    {#each squares as square}
      <div class="square {square}" style="width: {8 / zoom}px; cursor: {square}-resize;" />
    {/each}
  </section>
  <!-- on:input={updateText} -->
  <!-- TODO: zoom.... -->
  <div bind:this={textElem} class="edit" style="height: 100%; zoom: {1 / zoom};" contenteditable={true}>
    {#if item.text}
      {#each item.text as text}
        <span style={text.style}>{text.value}</span>
      {/each}
    {/if}
  </div>
</div>

<style>
  .item {
    /* border: 1px dashed var(--secondary-opacity); */

    position: absolute;
    /* display: inline-flex; */
    outline: 5px solid rgb(255 255 255 / 0.2);
    overflow: hidden;
  }
  .item.selected {
    outline: 5px solid var(--secondary);
    overflow: visible;
  }
  /* .item.selected::after {
    content: "";
    position: absolute;
    top: -20px;
    left: -20px;
    width: inherit;
    height: inherit;
    border: 10px dashed var(--secondary);
    pointer-events: none;
  } */

  .edit {
    outline: none;
    /* white-space: initial;
    color: white; */
  }

  .square {
    position: absolute;
    transform: translate(-50%, -50%);
    /* width: 15px;
    height: 15px; */
    aspect-ratio: 1/1;
    background-color: transparent;
    /* border: 5px solid transparent; */
    /* outline: 1px solid white; */
    /* border-radius: 50%; */
  }
  .item.selected .square {
    background-color: rgb(255 255 255 / 0.8);
  }
  .nw,
  .n,
  .ne {
    top: 0;
  }
  .e,
  .w {
    top: 50%;
  }
  .se,
  .s,
  .sw {
    top: 100%;
  }
  .nw,
  .sw,
  .w {
    left: 0;
  }
  .n,
  .s {
    left: 50%;
  }
  .ne,
  .e,
  .se {
    left: 100%;
  }

  .line {
    position: absolute;
    background-color: transparent;
    cursor: move;
  }
  /* .line.invisible {
    background-color: transparent;
    cursor: move;
  } */
  /* .line::after {
    content: "";
    background-color: red;
    position: absolute;
    left: 0;
    width: 100%;
    height: 100%;
    cursor: move;
  } */

  .nl {
    top: 0;
    left: 0;
    width: 100%;
    /* height: lineWidth; */
    transform: translateY(-50%);
  }
  .el {
    top: 0;
    left: 100%;
    /* width: lineWidth; */
    height: 100%;
    transform: translateX(-50%);
  }
  .sl {
    top: 100%;
    left: 0;
    /* height: lineWidth; */
    width: 100%;
    transform: translateY(-50%);
  }
  .wl {
    top: 0;
    left: 0;
    /* width: lineWidth; */
    height: 100%;
    transform: translateX(-50%);
  }
</style>
