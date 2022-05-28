<script lang="ts">
  import { onMount } from "svelte"
  import type { Item } from "../../../../types/Show"
  import { activeEdit, activePopup, timers } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import { getStyles } from "../../helpers/style"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Checkbox from "../../inputs/Checkbox.svelte"
  import Dropdown from "../../inputs/Dropdown.svelte"
  import Panel from "../../system/Panel.svelte"
  import { getSelectionRange } from "../scripts/textStyle"

  export let allSlideItems: Item[]
  export let item: any

  console.log(allSlideItems)

  $: style = item.style

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
    "font-family": "Arial",
    color: "#FFFFFF",
    "font-size": 100,
    "font-weight": "bold",
    // "font-style": null,
    // "text-decoration": null,
    // "line-height": 1,
    // "letter-spacing": 0,
    // "word-spacing": 0,
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

  // let styles: { [key: string]: any } = {}

  setStyles()
  function setStyles() {
    let styles = getStyles(style, true)

    Object.entries(defaults).forEach(([key, value]) => {
      if (key === "text-shadow" && value !== null) {
        let v = value.split(" ")
        Object.keys(shadows).forEach((shadowKey, i) => {
          styles[shadowKey] = v[i]
        })
      } else styles[key] = styles[key]?.length ? styles[key] : value
    })
  }

  // const inputChange = (e: any, key: string) => update(key, e.target.value)

  // function update(key: string, style: any, aligns: boolean = false) {
  //   if (key.includes("shadow")) {
  //     let v: string[] = []
  //     Object.entries(shadows).forEach(([shadowKey, shadowStyle]) => {
  //       if (shadowKey === key) v.push(style)
  //       else v.push(shadowStyle)
  //     })
  //     shadows[key] = style
  //     style = v.join("px ")
  //     key = "text-shadow"
  //     styles[key] = style
  //   } else {
  //     if (styles[key] === undefined || style === undefined || style === null || !style.toString().length) style = defaults[key]
  //     styles[key] = style
  //   }

  //   if (key === "font-size" || key === "letter-spacing" || key === "word-spacing" || key === "-webkit-text-stroke-width") style += "px"
  //   else if (key === "line-height") style += "em"

  //   let allItems: number[] = $activeEdit.items
  //   // update all items if nothing is selected
  //   if (!allItems.length) {
  //     allItems = []
  //     allSlideItems.forEach((_item, i) => allItems.push(i))
  //   }
  //   let newData: any = []
  //   // let oldData: any = []
  //   // loop through all items
  //   allItems.forEach((itemIndex) => {
  //     // oldData.push({ ...allSlideItems[itemIndex] })
  //     let selected = selection
  //     if (!selected?.length) {
  //       selected = []
  //       allSlideItems[itemIndex].lines?.forEach((line) => {
  //         selected!.push({ start: 0, end: getLineText(line).length })
  //       })
  //     }

  //     console.log(selected)

  //     if (allSlideItems[itemIndex].lines) {
  //       newData.push(
  //         aligns ? addStyleString(allSlideItems[itemIndex].align || "", [key, style]) : addStyle(selected, allSlideItems[itemIndex], [key, style]).lines!.map((a) => a.text)
  //       )
  //     }
  //   })

  //   // TODO: remove unused (if default)
  //   if (newData.length && $activeEdit.id) {
  //     // update layout
  //   } else if (newData.length) {
  //     history({
  //       // WIP
  //       id: key === "text-align" ? "textAlign" : aligns ? "setItems" : "textStyle",
  //       // oldData: { key: aligns ? "align" : "style", values: oldData },
  //       newData: { style: { key: aligns ? "align" : "text", values: newData } },
  //       location: { page: "edit", show: $activeShow!, slide: GetLayout()[$activeEdit.slide!].id, items: allItems },
  //     })
  //   }
  // }

  function keyup(e: any) {
    if (e.key.includes("Arrow") || e.key.toUpperCase() === "A") getTextSelection(e)
  }

  let timersList: any[] = []
  let activeTimer: any = {}
  onMount(() => {
    Object.entries($timers).forEach(([id, timer]: any) => timersList.push({ id, name: timer.name }))
    // activeTimer = timersList[0] || {}
  })

  let isPrivate: boolean = true

  function togglePrivate(e: any) {
    isPrivate = e.target.checked
    if (isPrivate) activeTimer = {}
  }
</script>

<svelte:window on:keyup={keyup} on:mouseup={getTextSelection} />

<!-- auto start on slide -->

<Panel>
  <div class="gap">
    <span class="titles">
      <p><T id="timer.private" /></p>
      <!-- {#if !isPrivate} -->
      <p><T id="timer.timer" /></p>
      <p><T id="menu.edit" /></p>
      <!-- {/if} -->
    </span>
    <span style="flex: 1;">
      <Checkbox checked={isPrivate} on:change={togglePrivate} />
      <!-- {#if !isPrivate} -->
      <Dropdown
        options={timersList}
        value={activeTimer.name || "—"}
        on:click={(e) => {
          activeTimer = e.detail
          if (isPrivate) isPrivate = false
        }}
      />
      <!-- {/if} -->
      <Button on:click={() => activePopup.set("timer")} style="width: 100%;" center dark>
        <Icon id="edit" right />
        <T id="menu.edit" />
      </Button>
      <!-- <TextInput bind:value={styles.name} /> -->
    </span>
  </div>
  <!-- <h6><T id="edit.font" /></h6>
  <div class="gap">
    <span class="titles">
      <p><T id="edit.family" /></p>
      <p><T id="edit.color" /></p>
      <p><T id="edit.size" /></p>
    </span>
    <span style="flex: 1;">
      <FontDropdown value={styles["font-family"]} on:click={(e) => update("font-family", e.detail)} />
      <Color bind:value={styles.color} on:input={(e) => inputChange(e, "color")} />
      <NumberInput value={styles["font-size"]} on:change={(e) => update("font-size", e.detail)} />
    </span>
  </div> -->
</Panel>
