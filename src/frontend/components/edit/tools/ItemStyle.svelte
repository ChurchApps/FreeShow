<script lang="ts">
  import type { Item } from "../../../../types/Show"
  import { activeEdit, activeShow } from "../../../stores"
  import { GetLayout } from "../../helpers/get"
  import { history } from "../../helpers/history"
  import { getStyles } from "../../helpers/style"
  import T from "../../helpers/T.svelte"
  import Color from "../../inputs/Color.svelte"
  import Dropdown from "../../inputs/Dropdown.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import Panel from "../../system/Panel.svelte"
  import { addStyleString } from "../scripts/textStyle"

  export let allSlideItems: Item[]
  export let item: Item | null

  const defaults: { [key: string]: any } = {
    "background-color": "rgb(0 0 0 / 0)",
    opacity: 1,
    "border-radius": 0,
    left: 0,
    top: 0,
    width: 300,
    height: 150,
    transform: null,
    // border
    "border-color": "#FFFFFF",
    "border-width": 0,
    "border-style": "solid",
    // shadow
    "box-shadow": null,
  }
  const shadows: { [key: string]: any } = {
    "shadow-x": 0,
    "shadow-y": 0,
    "shadow-blur": 0,
    "shadow-spread": 0,
    "shadow-color": "#000000",
  }
  const shadowsInset: { [key: string]: any } = {
    "ishadow-x": 0,
    "ishadow-y": 0,
    "ishadow-blur": 0,
    "ishadow-spread": 0,
    "ishadow-color": "#000000",
  }

  let data: { [key: string]: any } = {}

  $: {
    if (item?.style || item === null) setText() //  || selection === null
  }

  setText()
  function setText() {
    let styles = getStyles(item?.style, true)
    Object.entries(defaults).forEach(([key, value]) => (data[key] = styles[key]?.length ? styles[key] : value))
  }

  const inputChange = (e: any, key: string) => update(key, e.target.value)

  function update(key: string, style: any) {
    if (key.includes("shadow")) {
      let v: string[] = []
      let vi: string[] = []
      Object.entries(shadows).forEach(([shadowKey, shadowStyle]) => {
        if (shadowKey === key) v.push(style)
        else v.push(shadowStyle)
      })
      Object.entries(shadowsInset).forEach(([shadowKey, shadowStyle]) => {
        if (shadowKey === key) vi.push(style)
        else vi.push(shadowStyle)
      })

      if (key.includes("ishadow")) shadowsInset[key] = style
      else shadows[key] = style
      style = v.join("px ") + ", inset " + vi.join("px ")
      key = "box-shadow"
      data[key] = style
    } else {
      if (data[key] === undefined || style === undefined || style === null || !style.toString().length) style = defaults[key]
      data[key] = style
    }

    if (key === "left" || key === "top" || key === "width" || key === "height" || key === "border-width") style += "px"
    else if (key === "border-radius") style += "%"

    let allItems: number[] = $activeEdit.items
    // update all items if nothing is selected
    if (!allItems.length) {
      allItems = []
      allSlideItems.forEach((_item, i) => allItems.push(i))
    }
    let values: any = []
    let oldValues: any = []
    // loop through all items
    allItems.forEach((itemIndex) => {
      oldValues.push({ ...allSlideItems[itemIndex] })
      values.push(addStyleString(allSlideItems[itemIndex].style, [key, style]))
    })

    history({
      id: "setItems",
      oldData: { key: "style", values: oldValues },
      newData: {style: { key: "style", values }},
      location: { page: "edit", show: $activeShow!, slide: GetLayout()[$activeEdit.slide!].id, items: allItems },
    })
  }
</script>

<Panel>
  <!-- position // dimension / align -->
  <h6><T id="edit.item" /></h6>
  <div class="gap">
    <span class="titles">
      <p><T id="edit.x" /></p>
      <p><T id="edit.y" /></p>
      <p><T id="edit.width" /></p>
      <p><T id="edit.height" /></p>
      <p><T id="edit.rotation" /></p>
    </span>
    <!-- overflow-x: hidden; -->
    <span style="flex: 1;">
      <NumberInput value={data["left"]} on:change={(e) => update("left", e.detail)} />
      <NumberInput value={data["top"]} on:change={(e) => update("top", e.detail)} />
      <NumberInput value={data["width"]} on:change={(e) => update("width", e.detail)} />
      <NumberInput value={data["height"]} on:change={(e) => update("height", e.detail)} />
      <NumberInput value={data["transform"]} on:change={(e) => update("transform", e.detail)} />
    </span>
  </div>
  <hr />
  <h6><T id="edit.style" /></h6>
  <div class="gap">
    <span class="titles">
      <p><T id="edit.color" /></p>
      <p><T id="edit.opacity" /></p>
      <p><T id="edit.corner_radius" /></p>
    </span>
    <span>
      <Color bind:value={data["background-color"]} on:input={(e) => inputChange(e, "background-color")} />
      <NumberInput value={data.opacity} step={0.1} decimals={1} max={1} inputMultiplier={10} on:change={(e) => update("opacity", e.detail)} />
      <!-- <NumberInput value={data["border-radius"]} step={2} max={50} inputMultiplier={0.5} on:change={(e) => update("border-radius", e.detail)} /> -->
      <NumberInput value={data["border-radius"]} step={0.5} decimals={1} max={50} inputMultiplier={2} on:change={(e) => update("border-radius", e.detail)} />
    </span>
  </div>
  <hr />
  <span>
    <!-- <input type="checkbox" /> -->
    <h6><T id="edit.border" /></h6>
  </span>
  <!-- color, distance -->
  <div class="gap">
    <span class="titles">
      <p><T id="edit.color" /></p>
      <p><T id="edit.width" /></p>
      <p><T id="edit.style" /></p>
    </span>
    <span>
      <Color bind:value={data["border-color"]} on:input={(e) => inputChange(e, "border-color")} />
      <NumberInput value={data["border-width"]} max={500} on:change={(e) => update("border-width", e.detail)} />
      <Dropdown
        options={[
          { name: "$:borders.solid:$", id: "solid" },
          { name: "$:borders.dashed:$", id: "dashed" },
          { name: "$:borders.dotted:$", id: "dotted" },
          { name: "$:borders.double:$", id: "double" },
          { name: "$:borders.inset:$", id: "inset" },
          { name: "$:borders.outset:$", id: "outset" },
          { name: "$:borders.groove:$", id: "groove" },
          { name: "$:borders.ridge:$", id: "ridge" },
        ]}
        value="$:borders.{data['border-style']}:$"
        on:click={(e) => update("border-style", e.detail.id)}
      />
    </span>
  </div>
  <hr />
  <span>
    <!-- <input type="checkbox" /> -->
    <h6><T id="edit.shadow" /></h6>
  </span>
  <!-- color, blur, distance, density -->
  <div class="gap">
    <span class="titles">
      <p><T id="edit.color" /></p>
      <p><T id="edit.offsetX" /></p>
      <p><T id="edit.offsetY" /></p>
      <p><T id="edit.blur" /></p>
      <p><T id="edit.length" /></p>
    </span>
    <span>
      <Color value={shadows["shadow-color"]} on:input={(e) => inputChange(e, "shadow-color")} />
      <NumberInput value={shadows["shadow-x"]} min={-1000} on:change={(e) => update("shadow-x", e.detail)} />
      <NumberInput value={shadows["shadow-y"]} min={-1000} on:change={(e) => update("shadow-y", e.detail)} />
      <NumberInput value={shadows["shadow-blur"]} on:change={(e) => update("shadow-blur", e.detail)} />
      <NumberInput value={shadows["shadow-spread"]} min={-100} on:change={(e) => update("shadow-spread", e.detail)} />
    </span>
  </div>
  <hr />
  <span>
    <!-- <input type="checkbox" /> -->
    <h6><T id="edit.shadow_inset" /></h6>
  </span>
  <div class="gap">
    <span class="titles">
      <p><T id="edit.color" /></p>
      <p><T id="edit.offsetX" /></p>
      <p><T id="edit.offsetY" /></p>
      <p><T id="edit.blur" /></p>
      <p><T id="edit.length" /></p>
    </span>
    <span>
      <Color value={shadowsInset["ishadow-color"]} on:input={(e) => inputChange(e, "ishadow-color")} />
      <NumberInput value={shadowsInset["ishadow-x"]} min={-1000} on:change={(e) => update("ishadow-x", e.detail)} />
      <NumberInput value={shadowsInset["ishadow-y"]} min={-1000} on:change={(e) => update("ishadow-y", e.detail)} />
      <NumberInput value={shadowsInset["ishadow-blur"]} on:change={(e) => update("ishadow-blur", e.detail)} />
      <NumberInput value={shadowsInset["ishadow-spread"]} min={-100} on:change={(e) => update("ishadow-spread", e.detail)} />
    </span>
  </div>
</Panel>
