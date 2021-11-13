<script lang="ts">
  import type { Item } from "../../../../types/Show"

  import { activeShow, activeEdit, shows } from "../../../stores"
  import { History, history } from "../../helpers/history"
  import Color from "../../inputs/Color.svelte"
  import { getParentPos, setItemSelection } from "./TextStyle"

  let active = $activeShow?.id!

  let editSlideItems = $activeEdit.slide !== null ? $shows[active].slides[$shows[active].layouts[$shows[active].settings.activeLayout].slides[$activeEdit.slide].id].items : []

  console.log(editSlideItems)
  console.log($activeEdit)
  $: editSlideItems

  $: item = $activeEdit.item !== null ? $activeEdit.item : null
  $: console.log(item)

  const defaults: { [key: string]: string } = {
    "font-size": "100",
  }

  function getStyle(id: string, _c: number = 0) {
    // select active item or first item
    // TODO: check if item 0 exists...
    let styles: any = editSlideItems[item || 0]
    if (styles.text) {
      console.log(selectedTextItem)
      // TODO: fix bug...
      styles = styles.text![selectedTextItem].style.split(";")
    } else styles = styles.style.split(";")
    console.log(styles)

    let style = null
    styles.forEach((s: string) => {
      console.log(s, id)

      if (s.includes(id)) style = s.split(":")[1]
      if (s.includes(id)) console.log(s.split(":")[1])
    })
    console.log(style)

    return style || defaults[id]
  }

  function setStyle(style: any[], _e: any = null) {
    let sel: null | Selection = window.getSelection()

    let layout: string = $shows[active].settings.activeLayout
    let slide: string = $shows[active].layouts[layout].slides[$activeEdit.slide!].id
    // let itemObj: Item = $shows[active].slides[slide].items[item]

    let oldData = JSON.parse(JSON.stringify($shows[active].slides[slide].items))
    let items: Item[] = $shows[active].slides[slide].items
    // if (item) items = [items[item]]
    if (item !== null) items = [items[item]]

    // TODO: get selection
    // let sel = window.getSelection()
    // let newItem = setItemSelection({ ...itemObj }, style)
    let newItems: Item[] = setItemSelection([...items], style)
    // TODO: get all selected items!!!!
    if (item !== null) {
      let changed = newItems[0]
      newItems = $shows[active].slides[slide].items
      newItems[item] = changed
    }

    // if (!e || e.target.tagName !== "INPUT") window.getSelection()?.removeAllRanges()

    let obj: History = {
      id: "textStyle",
      oldData: oldData, // TODO: minimize this
      newData: newItems,
      location: {
        page: "edit",
        show: { id: active },
        layout: layout,
        slide: slide,
      },
    }
    // push to history
    history(obj)

    // set new selection
    console.log(sel)
    // const selection = window.getSelection()
    // const range = document.createRange()
    // let parent: Element = sel!.anchorNode!.parentElement!.closest(".edit")!
    // setTimeout(() => {
    //   console.log(parent.children)
    // }, 1000)

    // range.setStart(parent.children[newItems[1].from.index], newItems[1].from.pos)
    // range.setEnd(parent.children[newItems[1].to.index], newItems[1].to.pos)
    // // range.selectNodeContents(parent)
    // selection?.removeAllRanges()
    // selection?.addRange(range)

    // shows.update((s) => {
    //   let items = s[active].slides[slide].items[item!]
    //   // TODO: apply remove old
    //   if (items.text) items.text[0].style += style
    //   return s
    // })
  }

  // TODO: get default value / template value

  // const editValues = [
  //   {id: "font-size", name: "text_size", icon: "size", default: 10, }
  // ]

  let selectedTextItem = 0
  function keydown(e: any) {
    let parent = window.getSelection()?.focusNode?.parentElement?.closest(".edit")
    if (parent !== null && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      let elem = window.getSelection()?.focusNode
      let pos = window.getSelection()?.focusOffset || 0
      // TODO: get end instead of start (0)
      // TODO: not updating on first leave...

      selectedTextItem = getParentPos(elem, pos, e.key === "ArrowLeft" ? "left" : "right")[1]

      // TODO: change values on caret/cursor move
    }
  }
  $: console.log(selectedTextItem)

  const colorChange = (e: any) => {
    console.log(e.value)
    setStyle(["color", colorVal], e)
  }

  $: colorVal = getStyle("color", selectedTextItem)
</script>

<svelte:window on:keydown={keydown} />

<section>
  <!-- TODO: update values based of cursor position.... -->
  {#key item}
    {#key selectedTextItem}
      <div>
        <p>Text Size:</p>
        <span>
          <button on:click={() => setStyle(["font-size", Number(getStyle("font-size")) - 10 + "px"])}>-</button>
          <!-- {editSlideItems[item]} -->
          {Number(getStyle("font-size").replace(/\D+/g, "")) / 10}
          <button on:click={() => setStyle(["font-size", Number(getStyle("font-size")) + 10 + "px"])}>+</button>
        </span>
      </div>
      <div>
        <p>Color:</p>
        <span>
          <!-- <input type="color" bind:value={colorVal} on:input={colorChange} /> -->
          <Color bind:value={colorVal} on:input={colorChange} />
        </span>
      </div>
    {/key}
  {/key}
</section>
