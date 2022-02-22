<script lang="ts">
  import type { Item } from "../../../../types/Show"
  import { activeEdit, activeShow, dictionary } from "../../../stores"
  import { GetLayout } from "../../helpers/get"
  import { history } from "../../helpers/history"
  import { getStyles } from "../../helpers/style"
  import T from "../../helpers/T.svelte"
  import Color from "../../inputs/Color.svelte"
  import FontDropdown from "../../inputs/FontDropdown.svelte"
  import IconButton from "../../inputs/IconButton.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import Panel from "../../system/Panel.svelte"
  import { autoSize } from "../scripts/autoSize"
  import { addStyle, addStyleString, getItemStyleAtPos, getLineText, getSelectionRange } from "../scripts/textStyle"

  export let allSlideItems: Item[]
  export let item: Item | null

  // get style of last text or at caret pos
  // $: style = item?.lines
  //   ? selection !== null && selection[selection.length - 1]?.end - selection[selection.length - 1]?.start >= 0
  //     ? getItemStyleAtPos(item.lines, selection)
  //     : item.lines[item.lines.length - 1].text[item.lines[item.lines.length - 1].text.length - 1].style
  //   : ""
  $: style = item?.lines ? getItemStyleAtPos(item.lines, selection) : ""
  $: lineAlignStyle = item?.lines && selection?.length ? getLastLineAlign() : ""
  $: alignStyle = item?.align ? item.align : null

  function getLastLineAlign() {
    let last = ""
    item?.lines!.forEach((line: any, i: number) => {
      if (selection![i].start) last = line.align.length ? line.align.split(":")[1].replaceAll(";", "").trim() : ""
    })
    return last
  }

  let selection: null | { start: number; end: number }[] = null
  activeEdit.subscribe((ae) => {
    if (!ae.items.length) selection = null
  })

  function getTextSelection(e: any) {
    let sel: any = window.getSelection()
    // if (sel.focusNode?.parentElement?.closest(".edit") !== null && !e.target.closest(".editTools")) {
    // if (e.target.closest(".edit") && !e.target.closest(".editTools")) {
    if (e.target.closest(".edit")) {
      if (sel.type === "None") selection = null
      // else if (sel.type === "caret") selection = [sel.anchorOffset, sel.focusOffset]
      else selection = getSelectionRange() // range
    }
    console.log("SEL: ", selection)
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
    let styles = getStyles(style, true)

    Object.entries(defaults).forEach(([key, value]) => {
      if (key === "text-shadow" && value !== null) {
        let v = value.split(" ")
        Object.keys(shadows).forEach((shadowKey, i) => {
          text[shadowKey] = v[i]
        })
      } else text[key] = styles[key]?.length ? styles[key] : value
    })
    // TODO: better aligns....
    let aligns = getStyles(alignStyle)
    align["align-items"] = aligns["align-items"]?.length ? aligns["align-items"] : defaultAligns["align-items"]
    align["text-align"] = lineAlignStyle?.length ? lineAlignStyle : defaultAligns["text-align"]
    console.log(align)
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

  // auto
  let isAuto: boolean = false
  $: if (item?.auto) isAuto = true
  const auto = (e: any) => {
    isAuto = e.target.checked
    let allItems: number[] = $activeEdit.items
    // update all items if nothing is selected
    if (!allItems.length) {
      allItems = []
      allSlideItems.forEach((_item, i) => allItems.push(i))
    }
    let fullItems = allItems.map((a) => allSlideItems[a])
    history({
      id: "setItems",
      newData: { key: "auto", values: [isAuto] },
      location: { page: "edit", show: $activeShow!, slide: GetLayout()[$activeEdit.slide!].id, items: allItems },
    })
    if (isAuto) autoSize(allItems, fullItems, false)
  }

  function update(key: string, style: any, aligns: boolean = false) {
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

    let allItems: number[] = $activeEdit.items
    // update all items if nothing is selected
    if (!allItems.length) {
      allItems = []
      allSlideItems.forEach((_item, i) => allItems.push(i))
    }
    let newData: any = []
    // let oldData: any = []
    // loop through all items
    allItems.forEach((itemIndex) => {
      // oldData.push({ ...allSlideItems[itemIndex] })
      let selected = selection
      if (!selected?.length) {
        selected = []
        allSlideItems[itemIndex].lines?.forEach((line) => {
          selected!.push({ start: 0, end: getLineText(line).length })
        })
      }

      console.log(selected)

      if (key === "text-align") {
        let newAligns: any[] = []
        allSlideItems[itemIndex].lines?.forEach((_a, line) => {
          if (!selection || selection[line].start !== undefined) newAligns.push(key + ": " + align[key])
          else newAligns.push(allSlideItems[itemIndex].lines![line].align)
        })
        newData.push(newAligns)
      } else {
        newData.push(
          aligns ? addStyleString(allSlideItems[itemIndex].align || "", [key, style]) : addStyle(selected, allSlideItems[itemIndex], [key, style]).lines!.map((a) => a.text)
        )
      }
    })

    // TODO: remove unused (if default)
    history({
      // WIP
      id: key === "text-align" ? "textAlign" : aligns ? "setItems" : "textStyle",
      // oldData: { key: aligns ? "align" : "style", values: oldData },
      newData: { key: aligns ? "align" : "text", values: newData },
      location: { page: "edit", show: $activeShow!, slide: GetLayout()[$activeEdit.slide!].id, items: allItems },
    })
  }

  function keyup(e: any) {
    if (e.key.includes("Arrow") || e.key.toUpperCase() === "A") getTextSelection(e)
  }
</script>

<svelte:window on:keyup={keyup} on:mouseup={getTextSelection} />

<Panel>
  <h6><T id="edit.font" /></h6>
  <div class="gap">
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
      <NumberInput disabled={isAuto} value={text["font-size"]} on:change={(e) => update("font-size", e.detail)} />
      <!-- TODO: auto size -->
      <span><input type="checkbox" on:click={auto} checked={isAuto} /></span>
    </span>
  </div>
  <hr />
  <h6><T id="edit.style" /></h6>
  <div class="line" style="margin-bottom: 10px;">
    <IconButton on:click={() => updateNull("font-weight", "bold")} title={$dictionary.edit?._title_bold} icon="bold" active={text["font-weight"] === "bold"} />
    <IconButton on:click={() => updateNull("font-style", "italic")} title={$dictionary.edit?._title_italic} icon="italic" active={text["font-style"] === "italic"} />
    <IconButton on:click={() => decoration("underline")} title={$dictionary.edit?._title_underline} icon="underline" active={text["text-decoration"]?.includes("underline")} />
    <IconButton
      on:click={() => decoration("line-through")}
      title={$dictionary.edit?._title_strikethrough}
      icon="strikethrough"
      active={text["text-decoration"]?.includes("line-through")}
    />
  </div>
  <div class="gap">
    <span class="titles">
      <p><T id="edit.line_spacing" /></p>
      <p><T id="edit.letter_spacing" /></p>
      <p><T id="edit.word_spacing" /></p>
    </span>
    <span>
      <NumberInput value={text["line-height"]} max={10} step={0.1} decimals={1} inputMultiplier={10} on:change={(e) => update("line-height", e.detail)} />
      <NumberInput value={text["letter-spacing"]} max={100} min={-1000} on:change={(e) => update("letter-spacing", e.detail)} />
      <NumberInput value={text["word-spacing"]} min={-100} on:change={(e) => update("word-spacing", e.detail)} />
    </span>
  </div>
  <hr />
  <h6><T id="edit.align" /></h6>
  <div class="line">
    <IconButton on:click={() => update("text-align", "left", true)} title={$dictionary.edit?._title_left} icon="alignLeft" active={align["text-align"] === "left"} />
    <IconButton on:click={() => update("text-align", "center", true)} title={$dictionary.edit?._title_center} icon="alignCenter" active={align["text-align"] === "center"} />
    <IconButton on:click={() => update("text-align", "right", true)} title={$dictionary.edit?._title_right} icon="alignRight" active={align["text-align"] === "right"} />
    <IconButton on:click={() => update("text-align", "justify", true)} title={$dictionary.edit?._title_justify} icon="alignJustify" active={align["text-align"] === "justify"} />
  </div>
  <div class="line">
    <IconButton on:click={() => update("align-items", "flex-start", true)} title={$dictionary.edit?._title_top} icon="alignTop" active={align["align-items"] === "flex-start"} />
    <IconButton on:click={() => update("align-items", "center", true)} title={$dictionary.edit?._title_center} icon="alignMiddle" active={align["align-items"] === "center"} />
    <IconButton on:click={() => update("align-items", "flex-end", true)} title={$dictionary.edit?._title_bottom} icon="alignBottom" active={align["align-items"] === "flex-end"} />
  </div>
  <hr />
  <span>
    <!-- <input type="checkbox" /> -->
    <h6><T id="edit.outline" /></h6>
  </span>
  <!-- color, distance -->
  <div class="gap">
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
      <!-- <p>Angle</p>
      <p>Radius</p> -->
    </span>
    <span>
      <Color value={shadows["shadow-color"]} on:input={(e) => inputChange(e, "shadow-color")} />
      <NumberInput value={shadows["shadow-x"]} min={-1000} on:change={(e) => update("shadow-x", e.detail)} />
      <NumberInput value={shadows["shadow-y"]} min={-1000} on:change={(e) => update("shadow-y", e.detail)} />
      <NumberInput value={shadows["shadow-blur"]} on:change={(e) => update("shadow-blur", e.detail)} />
    </span>
  </div>
</Panel>
