<script lang="ts">
  import { activeEdit, activeShow } from "../../../stores"
  import { GetLayout } from "../../helpers/get"
  import { history } from "../../helpers/history"
  import { _show } from "../../helpers/shows"
  import T from "../../helpers/T.svelte"
  import Checkbox from "../../inputs/Checkbox.svelte"
  import Color from "../../inputs/Color.svelte"
  import Panel from "../../system/Panel.svelte"

  // $: editSlide = $activeEdit.slide !== null ? getSlide($activeShow?.id!, $activeEdit.slide) : null
  $: editSlide =
    $activeEdit.slide !== null
      ? _show("active")
          .slides([_show("active").layouts("active").slides([$activeEdit.slide]).get()[0][0]?.id])
          .get()[0]
      : null
  // get(showsCache)[out.id].slides[GetLayout(out.id, out.layout)[out.index]?.id]

  $: background = editSlide?.settings?.background || false
  $: color = editSlide?.settings?.color || "#000000"
  // $: resolution = editSlide?.settings.resolution || []
  // $: transition = editSlide?.settings.transition || {}

  const inputChange = (e: any, key: string) => update(key, e.target.value)

  function update(id: string, value: any) {
    let newData: any = { ...editSlide?.settings }
    newData[id] = value

    history({
      id: "slideStyle",
      oldData: editSlide?.settings,
      newData,
      location: { page: "edit", show: $activeShow!, slide: GetLayout()[$activeEdit.slide!].id },
    })
  }
</script>

<Panel>
  <h6><T id="edit.style" /></h6>
  <div class="gap">
    <span class="titles">
      <p><T id="edit.background" /></p>
      <p><T id="edit.color" /></p>
    </span>
    <span style="flex: 1;">
      <!-- <input type="checkbox" checked={background} /> -->
      <Checkbox checked={background} />
      <Color bind:value={color} on:input={(e) => inputChange(e, "background")} />
    </span>
  </div>
  <hr />
  <h6><T id="edit.options" /></h6>
  <div class="gap">
    <span class="titles">
      <p><T id="edit.resolution" /></p>
      <!-- <p><T id="edit.transition" /></p> -->
    </span>
    <span style="flex: 1;">
      <!-- <input type="checkbox" checked={background} />
      <Color bind:value={color} on:input={colorChange} /> -->
    </span>
  </div>
</Panel>
