<script lang="ts">
  import type { Item } from "../../../../types/Show"

  import { activeShow, activeEdit, shows } from "../../../stores"
  import { History, history } from "../../helpers/history"
  import { setItemSelection } from "./TextStyle"

  let active = $activeShow?.id!

  let editSlideItems = $activeEdit.slide !== null ? $shows[active].slides[$shows[active].layouts[$shows[active].settings.activeLayout].slides[$activeEdit.slide].id].items : []

  console.log(editSlideItems)
  console.log($activeEdit)
  $: editSlideItems

  $: item = $activeEdit.item !== null ? $activeEdit.item : null
  $: console.log(item)

  const defaults: { [key: string]: string } = {
    "font-size": "10",
  }

  function getStyle(id: string) {
    let styles = editSlideItems[item!].style.split(";")
    console.log(styles)

    let style = null
    styles.forEach((s) => {
      console.log(s, id)

      if (s.includes(id)) style = s.split(":")[1]
      if (s.includes(id)) console.log(s.split(":")[1])
    })
    console.log(style)

    return style || defaults[id]
  }

  function setStyle(style: any[]) {
    let layout: string = $shows[active].settings.activeLayout
    let slide: string = $shows[active].layouts[layout].slides[$activeEdit.slide!].id
    let itemObj: Item = $shows[active].slides[slide].items[item!]

    // TODO: get selection
    // let sel = window.getSelection()
    let newItem = setItemSelection({ ...itemObj }, style)
    console.log(newItem)
    window.getSelection()?.removeAllRanges()

    let obj: History = {
      id: "textStyle",
      oldData: itemObj, // TODO: minimize this
      newData: newItem,
      location: {
        page: "edit",
        show: { id: active },
        layout: layout,
        slide: slide,
        item: item!,
      },
    }
    // push to history
    history(obj)

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

  function keydown(e: any) {
    let parent = window.getSelection()?.focusNode?.parentElement?.closest(".edit")
    if (parent !== null && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      // textarea.addEventListener('keypress', checkcaret);
      // textarea.selectionStart
      // console.log(parent?.)

      console.log(window.getSelection()?.focusOffset)
      // TODO: change values on caret/cursor move
    }
  }
</script>

<svelte:window on:keydown={keydown} />

<div class="main">
  {#if item !== null}
    <!-- TODO: update values based of cursor position.... -->
    {#key item}
      <div>
        <p>Text Size:</p>
        <span>
          <button on:click={() => setStyle(["font-size", Number(getStyle("font-size")) - 10 + "px"])}>-</button>
          <!-- {editSlideItems[item]} -->
          {getStyle("font-size").replace(/\D+/g, "")}
          <button on:click={() => setStyle(["font-size", Number(getStyle("font-size")) + 10 + "px"])}>+</button>
        </span>
      </div>
      <div>
        <p>Color:</p>
        <span>
          <input type="color" value={getStyle("color")} on:change={() => setStyle(["color", "purple"])} />
        </span>
      </div>
    {/key}
  {/if}
</div>

<style>
  .main {
    padding: 10px;
  }
  .main div {
    display: flex;
    justify-content: space-between;
  }
</style>
