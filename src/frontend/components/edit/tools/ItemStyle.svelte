<script lang="ts">
  import type { Item } from "../../../../types/Show"

  import { activeEdit, activeShow, shows } from "../../../stores"
  import { history, History } from "../../helpers/history"

  import Color from "../../inputs/Color.svelte"
  import { addStyleString } from "./TextStyle"

  let active = $activeShow?.id!
  let editSlideItems = $activeEdit.slide !== null ? $shows[active].slides[$shows[active].layouts[$shows[active].settings.activeLayout].slides[$activeEdit.slide].id].items : []
  $: console.log(editSlideItems)
  // TODO: not updating in child(layout) slides

  let item = $activeEdit.item !== null ? $activeEdit.item : null

  const defaults: { [key: string]: string } = {
    "background-color": "rgb(0 0 0 / 0)",
  }

  function getStyle(id: string) {
    // select active item or first item
    // TODO: check if item 0 exists...
    let styles: any = editSlideItems[item || 0].style.split(";")

    let style = null
    styles.forEach((s: string) => {
      if (s.includes(id)) style = s.split(":")[1]
    })

    return style || defaults[id]
  }

  function setStyle(style: any[]) {
    let layout: string = $shows[active].settings.activeLayout
    let slide: string = $shows[active].layouts[layout].slides[$activeEdit.slide!].id

    let oldData = JSON.parse(JSON.stringify($shows[active].slides[slide].items))
    let items: Item[] = [...$shows[active].slides[slide].items]
    if (item !== null) items = [items[item]]

    let newItems = [...items]
    console.log(oldData[0].style)
    newItems.forEach((i) => {
      i.style = addStyleString(i.style, style)
    })
    console.log(oldData[0].style)
    if (item !== null) {
      let changed = newItems[0]
      newItems = [...$shows[active].slides[slide].items]
      newItems[item] = changed
    }

    console.log(newItems)

    // let newItem = items[item!].style

    // items[item!].style += style

    let obj: History = {
      id: "itemStyle",
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
  }

  const colorChange = () => {
    setStyle(["background-color", bgColor])
  }

  $: bgColor = getStyle("background-color")
</script>

<section>
  {#key item}
    <div>
      <p>Background:</p>
      <span>
        <!-- <input type="color" bind:value={colorVal} on:input={colorChange} /> -->
        <Color bind:value={bgColor} on:input={colorChange} />
      </span>
    </div>{/key}
</section>
