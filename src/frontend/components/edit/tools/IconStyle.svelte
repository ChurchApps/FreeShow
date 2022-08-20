<script lang="ts">
  import { activeEdit, activeShow } from "../../../stores"
  import { history } from "../../helpers/history"
  import { _show } from "../../helpers/shows"
  import { getStyles } from "../../helpers/style"
  import T from "../../helpers/T.svelte"
  import Color from "../../inputs/Color.svelte"
  import Panel from "../../system/Panel.svelte"
  import { addStyleString } from "../scripts/textStyle"

  // export let allSlideItems: Item[]
  export let item: any
  export let index: number

  $: style = item.style

  const defaults: { [key: string]: any } = {
    color: "#FFFFFF",
  }

  let styles: { [key: string]: any } = {}

  $: if (item) setStyles()
  function setStyles() {
    styles = getStyles(style, true)

    Object.entries(defaults).forEach(([key, value]) => {
      styles[key] = styles[key]?.length ? styles[key] : value
    })
  }

  const inputChange = (e: any, key: string) => update(key, e.target.value)

  function update(key: string, style: any) {
    if (styles[key] === undefined || style === undefined || style === null || !style.toString().length) style = defaults[key]
    styles[key] = style

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
</script>

<Panel>
  <!-- <h6><T id="edit.font" /></h6> -->
  <div class="gap">
    <span class="titles">
      <!-- <p><T id="edit.family" /></p> -->
      <p><T id="edit.color" /></p>
    </span>
    <span style="flex: 1;">
      <!-- <FontDropdown value={styles["font-family"]} on:click={(e) => update("font-family", e.detail)} /> -->
      <Color bind:value={styles.color} on:input={(e) => inputChange(e, "color")} />
    </span>
  </div>
</Panel>
