<script lang="ts">
  import { onMount } from "svelte"
  import { activeEdit, activePopup, activeShow, timers } from "../../../stores"
  import { history } from "../../helpers/history"
  import Icon from "../../helpers/Icon.svelte"
  import { select } from "../../helpers/select"
  import { _show } from "../../helpers/shows"
  import { getStyles } from "../../helpers/style"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Color from "../../inputs/Color.svelte"
  import FontDropdown from "../../inputs/FontDropdown.svelte"
  import Panel from "../../system/Panel.svelte"
  import { addStyleString } from "../scripts/textStyle"

  // export let allSlideItems: Item[]
  export let item: any
  export let index: number

  $: style = item.style

  const defaults: { [key: string]: any } = {
    "font-family": "CMGSans",
    color: "#FFFFFF",
  }

  let styles: { [key: string]: any } = {}

  $: if (item) setStyles()
  function setStyles() {
    styles = getStyles(style, true)

    Object.entries(defaults).forEach(([key, value]) => {
      // if (key === "text-shadow" && value !== null) {
      //   let v = value.split(" ")
      //   Object.keys(shadows).forEach((shadowKey, i) => {
      //     styles[shadowKey] = v[i]
      //   })
      // } else
      styles[key] = styles[key]?.length ? styles[key] : value
    })
  }

  const inputChange = (e: any, key: string) => update(key, e.target.value)

  function update(key: string, style: any) {
    // if (key.includes("shadow")) {
    //   let v: string[] = []
    //   Object.entries(shadows).forEach(([shadowKey, shadowStyle]) => {
    //     if (shadowKey === key) v.push(style)
    //     else v.push(shadowStyle)
    //   })
    //   shadows[key] = style
    //   style = v.join("px ")
    //   key = "text-shadow"
    //   styles[key] = style
    // } else {
    if (styles[key] === undefined || style === undefined || style === null || !style.toString().length) style = defaults[key]
    styles[key] = style
    // }

    // if (key === "font-size" || key === "letter-spacing" || key === "word-spacing" || key === "-webkit-text-stroke-width") style += "px"
    // else if (key === "line-height") style += "em"

    // console.log(item, allSlideItems)
    // let timerItem: any = item || allSlideItems[0]
    // console.log(style, timerItem)
    let oldData: any = JSON.parse(JSON.stringify(item.style))
    let newData: any = addStyleString(item.style, [key, style])

    let ref = _show("active").layouts("active").ref()[0]
    if (newData.length) {
      history({
        id: "setItems",
        oldData: { style: { key: "style", values: [oldData] } },
        newData: { style: { key: "style", values: [newData] } },
        location: { page: "edit", show: $activeShow!, slide: ref[$activeEdit.slide!].id, items: [index] },
      })
    }
  }

  let timersList: any[] = []
  let activeTimer: any = {}
  onMount(() => {
    Object.entries($timers).forEach(([id, timer]: any) => timersList.push({ id, name: timer.name }))
    // activeTimer = timersList[0] || {}
  })

  let isPrivate: boolean = true

  // function togglePrivate(e: any) {
  //   isPrivate = e.target.checked
  //   if (isPrivate) activeTimer = {}
  // }
</script>

<Panel>
  <div class="gap">
    <Button
      on:click={() => {
        if (!isPrivate && activeTimer) select("timer", { id: activeTimer.id })
        else {
          let showId = $activeEdit?.id || $activeShow?.id
          let ref = _show(showId).layouts("active").ref()[0]
          select("timer", { id: item.timer.id, showId, slideId: ref[$activeEdit?.slide || ""].id })
        }
        activePopup.set("timer")
      }}
      style="width: 100%;"
      center
      dark
    >
      <Icon id="edit" right />
      <T id="menu.edit" />
    </Button>
    <!-- TODO: use global timers! -->
    <!-- <span class="titles">
      <p><T id="timer.private" /></p>
      <p><T id="timer.timer" /></p>
      <p><T id="menu.edit" /></p>
    </span>
    <span style="flex: 1;">
      <Checkbox checked={isPrivate} on:change={togglePrivate} />
      <Dropdown
        disabled={isPrivate}
        options={timersList}
        value={activeTimer.name || "—"}
        on:click={(e) => {
          activeTimer = e.detail
          if (isPrivate) isPrivate = false
        }}
      />
      <Button
        on:click={() => {
          if (!isPrivate && activeTimer) select("timer", { id: activeTimer.id })
          else {
            let showId = $activeEdit?.id || $activeShow?.id
            let ref = _show(showId).layouts("active").ref()[0]
            select("timer", { id: item.timer.id, showId, slideId: ref[$activeEdit?.slide || ""].id })
          }
          activePopup.set("timer")
        }}
        style="width: 100%;"
        center
        dark
      >
        <Icon id="edit" right />
        <T id="menu.edit" />
      </Button>
    </span> -->
  </div>
  <h6><T id="edit.font" /></h6>
  <div class="gap">
    <span class="titles">
      <p><T id="edit.family" /></p>
      <p><T id="edit.color" /></p>
      <!-- <p><T id="edit.size" /></p> -->
    </span>
    <span style="flex: 1;">
      <FontDropdown value={styles["font-family"]} on:click={(e) => update("font-family", e.detail)} />
      <Color bind:value={styles.color} on:input={(e) => inputChange(e, "color")} />
    </span>
  </div>
</Panel>
