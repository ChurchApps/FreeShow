<script lang="ts">
  import type { Item } from "../../../../types/Show"
  import { activeShow, activeEdit, dictionary } from "../../../stores"
  import { GetLayout, getSlide } from "../../helpers/get"
  import { history } from "../../helpers/history"
  import T from "../../helpers/T.svelte"
  import Color from "../../inputs/Color.svelte"
  import FontDropdown from "../../inputs/FontDropdown.svelte"
  import IconButton from "../../inputs/IconButton.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import { addStyle, addStyleString, getItemStyleAtPos, getItemText, getSelectionRange } from "./TextStyle"

  $: active = $activeShow?.id!
  $: allSlideItems = $activeEdit.slide !== null ? getSlide(active, $activeEdit.slide).items : []
  const getItemsByIndex = (array: number[]): Item[] => array.map((i) => allSlideItems[i])
  // select active items or all items
  $: items = $activeEdit.items.length ? getItemsByIndex($activeEdit.items.sort((a, b) => a - b)) : allSlideItems
  // select last item
  $: item = items.length ? items[items.length - 1] : null
  // get style of last text or at caret pos
  $: style = item?.text ? (selection !== null && selection[1] - selection[0] >= 0 ? getItemStyleAtPos(item.text, selection[1]) : item.text[item.text.length - 1].style) : null
  $: alignStyle = item?.align ? item.align : null

  let selection: null | [number, number] = null
  activeEdit.subscribe((ae) => {
    if (!ae.items.length) selection = null
  })

  function getTextSelection(e: any) {
    let sel: any = window.getSelection()
    // if (sel.focusNode?.parentElement?.closest(".edit") !== null && !e.target.closest(".editTools")) {
    // if (e.target.closest(".edit") && !e.target.closest(".editTools")) {
    if (e.target.closest(".edit")) {
      if (sel.type === "None") selection = null
      else if (sel.type === "caret") selection = [sel.anchorOffset, sel.focusOffset]
      else selection = getSelectionRange() // range
    }
  }

  const defaults: { [key: string]: any } = {
    "font-family": "CMGSans",
    color: "#FFFFFF",
    "font-size": 100,
    "font-weight": null,
    "font-style": null,
    "text-decoration": null,
    "line-height": 1,
    "letter-spacing": 0,
    "word-spacing": 0,
    // outline
    "-webkit-text-stroke-color": "#000000",
    "-webkit-text-stroke-width": 0,
    // shadow
    "text-shadow": "2px 2px 10px #000000",
  }
  const shadows: { [key: string]: any } = {
    "shadow-x": 2,
    "shadow-y": 2,
    "shadow-blur": 10,
    "shadow-color": "#000000",
  }
  // align
  const defaultAligns: { [key: string]: any } = {
    "text-align": "center",
    "align-items": "center",
  }

  let text: { [key: string]: any } = {}
  let align: { [key: string]: any } = {}

  $: {
    if (selection || item || item === null) setText() //  || selection === null
  }

  setText()
  function setText() {
    Object.entries(defaults).forEach(([key, value]) => {
      let styles = getStyle(key, style)
      if (key === "text-shadow" && value !== null) {
        let v = value.split(" ")
        Object.keys(shadows).forEach((shadowKey, i) => {
          text[shadowKey] = v[i]
        })
      } else text[key] = styles === null ? value : styles
    })
    Object.entries(defaultAligns).forEach(([key, value]) => {
      let style = getStyle(key, alignStyle)
      align[key] = style === null ? value : style
    })
  }

  function getStyle(key: string, style: string | null) {
    let newStyle: any = null
    if (style?.includes(key)) {
      style.split(";").forEach((s: string) => {
        if (s.includes(key)) newStyle = s.split(":")[1]
      })

      if (newStyle?.includes("px") || newStyle?.includes("em")) newStyle = newStyle.replace(/\D+/g, "")
    }

    return newStyle
  }

  const inputChange = (e: any, key: string) => update(key, e.target.value)
  const updateNull = (key: string, style: string) => update(key, text[key] === style ? null : style)
  const decoration = (key: string) => {
    let style: any = text["text-decoration"]?.split(" ") || null
    if (style === null) style = key
    else if (style.length > 1) style = style[0] === key ? style[1] : style[0]
    else if (style.includes(key)) style = null
    else {
      style.push(key)
      style = style.join(" ")
    }
    update("text-decoration", style)
  }

  function update(key: string, style: any, aligns: boolean = false) {
    console.log(style)
    if (aligns) {
      if (align[key] === undefined || style === undefined || style === null || !style.toString().length) style = defaults[key]
      align[key] = style
    } else {
      if (key.includes("shadow")) {
        let v: string[] = []
        Object.entries(shadows).forEach(([shadowKey, shadowStyle]) => {
          if (shadowKey === key) v.push(style)
          else v.push(shadowStyle)
        })
        // if () style = shadows[key]
        shadows[key] = style
        style = v.join("px ")
        key = "text-shadow"
        text[key] = style
      } else {
        if (text[key] === undefined || style === undefined || style === null || !style.toString().length) style = defaults[key]
        text[key] = style
      }
    }

    if (key === "font-size" || key === "letter-spacing" || key === "word-spacing" || key === "-webkit-text-stroke-width") style += "px"
    else if (key === "line-height") style += "em"
    console.log(style)

    let allItems: number[] = $activeEdit.items
    // update all items if nothing is selected
    if (!allItems.length) {
      allItems = []
      allSlideItems.forEach((_item, i) => allItems.push(i))
    }
    let newData: any = []
    let oldData: any = []
    // loop through all items
    allItems.forEach((itemIndex) => {
      oldData.push({ ...allSlideItems[itemIndex] })
      let selected = selection
      if (selected === null || selected[1] - selected[0] <= 0) selected = [0, getItemText(allSlideItems[itemIndex]).length]
      newData.push(aligns ? addStyleString(allSlideItems[itemIndex].align || "", [key, style]) : addStyle(selected, allSlideItems[itemIndex], [key, style]))
    })

    history({
      id: aligns ? "itemAlign" : "textStyle",
      oldData,
      newData,
      location: { page: "edit", show: $activeShow!, slide: GetLayout()[$activeEdit.slide!].id, items: allItems },
    })
  }

  function keyup(e: any) {
    if (e.key.includes("Arrow") || e.key.toUpperCase() === "A") getTextSelection(e)
  }
</script>

<svelte:window on:keyup={keyup} on:mouseup={getTextSelection} />

<section>
  <!-- TODO: update values based of cursor position.... -->
  <!-- {#key item}
    {#key selectedTextItem} -->
  <!-- {#key $activeShow?.id} -->
  <h6><T id="edit.font" /></h6>
  <div style="display: flex;gap: 10px;">
    <span class="titles">
      <p><T id="edit.family" /></p>
      <p><T id="edit.color" /></p>
      <p><T id="edit.size" /></p>
      <p><T id="edit.auto_size" /></p>
    </span>
    <!-- overflow-x: hidden; -->
    <span style="flex: 1;">
      <!-- dropdown: system fonts, web fonts, custom (CMGSans) -->
      <FontDropdown value={text["font-family"]} on:click={(e) => update("font-family", e.detail)} />
      <Color bind:value={text.color} on:input={(e) => inputChange(e, "color")} />
      <NumberInput value={text["font-size"]} on:change={(e) => update("font-size", e.detail)} />
      <!-- TODO: auto size -->
      <span><input type="checkbox" /></span>
    </span>
  </div>
  <hr />
  <h6><T id="edit.style" /></h6>
  <div class="line" style="margin-bottom: 10px;">
    <IconButton on:click={() => updateNull("font-weight", "bold")} title={$dictionary.edit._title_bold} icon="bold" active={text["font-weight"] === "bold"} />
    <IconButton on:click={() => updateNull("font-style", "italic")} title={$dictionary.edit._title_italic} icon="italic" active={text["font-style"] === "italic"} />
    <IconButton on:click={() => decoration("underline")} title={$dictionary.edit._title_underline} icon="underline" active={text["text-decoration"]?.includes("underline")} />
    <IconButton
      on:click={() => decoration("line-through")}
      title={$dictionary.edit._title_strikethrough}
      icon="strikethrough"
      active={text["text-decoration"]?.includes("line-through")}
    />
  </div>
  <div style="display: flex;gap: 10px;">
    <span class="titles">
      <p><T id="edit.line_spacing" /></p>
      <p><T id="edit.letter_spacing" /></p>
      <p><T id="edit.word_spacing" /></p>
    </span>
    <span>
      <NumberInput value={text["line-height"]} min={0.1} max={100} step={0.1} inputMultiplier={10} on:change={(e) => update("line-height", e.detail)} />
      <NumberInput value={text["letter-spacing"]} min={-1000} on:change={(e) => update("letter-spacing", e.detail)} />
      <NumberInput value={text["word-spacing"]} min={-100} on:change={(e) => update("word-spacing", e.detail)} />
    </span>
  </div>
  <hr />
  <h6><T id="edit.align" /></h6>
  <div class="line">
    <IconButton on:click={() => update("text-align", "left", true)} title={$dictionary.edit._title_left} icon="alignLeft" active={align["text-align"] === "left"} />
    <IconButton on:click={() => update("text-align", "center", true)} title={$dictionary.edit._title_center} icon="alignCenter" active={align["text-align"] === "center"} />
    <IconButton on:click={() => update("text-align", "right", true)} title={$dictionary.edit._title_right} icon="alignRight" active={align["text-align"] === "right"} />
    <IconButton on:click={() => update("text-align", "justify", true)} title={$dictionary.edit._title_justify} icon="alignJustify" active={align["text-align"] === "justify"} />
  </div>
  <div class="line">
    <IconButton on:click={() => update("align-items", "flex-start", true)} title={$dictionary.edit._title_top} icon="alignTop" active={align["align-items"] === "flex-start"} />
    <IconButton on:click={() => update("align-items", "center", true)} title={$dictionary.edit._title_center} icon="alignMiddle" active={align["align-items"] === "center"} />
    <IconButton on:click={() => update("align-items", "flex-end", true)} title={$dictionary.edit._title_bottom} icon="alignBottom" active={align["align-items"] === "flex-end"} />
  </div>
  <hr />
  <span>
    <input type="checkbox" />
    <h6><T id="edit.outline" /></h6>
  </span>
  <!-- color, distance -->
  <div style="display: flex;gap: 10px;">
    <span class="titles">
      <p><T id="edit.color" /></p>
      <p><T id="edit.width" /></p>
    </span>
    <span>
      <Color bind:value={text["-webkit-text-stroke-color"]} on:input={(e) => inputChange(e, "-webkit-text-stroke-color")} />
      <NumberInput value={text["-webkit-text-stroke-width"]} max={100} on:change={(e) => update("-webkit-text-stroke-width", e.detail)} />
    </span>
  </div>
  <hr />
  <span>
    <input type="checkbox" />
    <h6><T id="edit.shadow" /></h6>
  </span>
  <!-- color, blur, distance, density -->
  <div style="display: flex;gap: 10px;">
    <span class="titles">
      <p><T id="edit.color" /></p>
      <p><T id="edit.offsetX" /></p>
      <p><T id="edit.offsetY" /></p>
      <p><T id="edit.blur" /></p>
      <!-- <p>Angle</p>
      <p>Radius</p> -->
    </span>
    <span>
      <Color value={shadows["shadow-color"]} on:input={(e) => inputChange(e, "shadow-color")} />
      <NumberInput value={shadows["shadow-x"]} min={-10} on:change={(e) => update("shadow-x", e.detail)} />
      <NumberInput value={shadows["shadow-y"]} min={-10} on:change={(e) => update("shadow-y", e.detail)} />
      <NumberInput value={shadows["shadow-blur"]} on:change={(e) => update("shadow-blur", e.detail)} />
    </span>
  </div>
  <!-- {/key} -->
  <!-- {/key}
  {/key} -->
</section>

<style>
  h6 {
    color: var(--text);
    text-transform: uppercase;
    text-align: center;
    font-size: 0.9em;
    margin: 20px 0;
  }

  .titles {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
  }

  p {
    width: 100%;
    opacity: 0.8;
    align-self: center;
    /* font-weight: bold; */
    /* text-transform: uppercase; */
    font-size: 0.9em;
  }

  /* span {
    margin: 10px 0;
  } */

  .line {
    display: flex;
    align-items: center;
    background-color: var(--primary-darker);
    flex-flow: wrap;
  }

  hr {
    width: 100%;
    height: 2px;
    background-color: var(--primary-lighter);
    border: none;
    margin: 20px 0;
  }
</style>
