<script lang="ts">
  import type { Slide } from "../../../../types/Show"

  import { activeEdit, activeShow, shows } from "../../../stores"
  import { history, History } from "../../helpers/history"

  import Color from "../../inputs/Color.svelte"
  import { addStyleString } from "./TextStyle"

  let active = $activeShow?.id!
  let editSlide: null | Slide = $activeEdit.slide !== null ? $shows[active].slides[$shows[active].layouts[$shows[active].settings.activeLayout].slides[$activeEdit.slide].id] : null

  const defaults: { [key: string]: string } = {
    "background-color": "#000",
  }

  function getStyle(id: string) {
    // select active item or first item
    let style: null | string = null
    if (editSlide) {
      let oldStyle: any = editSlide?.style.split(";")
      if (oldStyle.includes(id)) style = oldStyle.split(":")[1]
    }

    return style || defaults[id]
  }

  function setStyle(style: any[]) {
    let layout: string = $shows[active].settings.activeLayout
    let slide: string = $shows[active].layouts[layout].slides[$activeEdit.slide!].id
    // let itemObj: Item = $shows[active].slides[slide].items[item]
    let oldStyle: string = $shows[active].slides[slide].style
    let newStyle = addStyleString(oldStyle, style)

    let obj: History = {
      id: "slideStyle",
      oldData: oldStyle,
      newData: newStyle,
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
  <div>...</div>
  <div>
    <p>Background:</p>
    <span>
      <!-- <input type="color" bind:value={colorVal} on:input={colorChange} /> -->
      <Color bind:value={bgColor} on:input={colorChange} />
    </span>
  </div>
</section>
