<script lang="ts">
  import { onMount } from "svelte"
  import { activePopup, overlays, selected, templates } from "../../../stores"
  import { history } from "../../helpers/history"
  import Icon from "../../helpers/Icon.svelte"
  import Button from "../../inputs/Button.svelte"
  import Color from "../../inputs/Color.svelte"

  let value: any = "#FFFFFF"
  $: console.log(value)
  onMount(() => {
    if ($selected.id === "overlay") value = $overlays[$selected.data[0]].color
    else if ($selected.id === "template") value = $templates[$selected.data[0]].color
  })

  const actions: any = {
    overlay: () => {
      $selected.data.forEach((id) => {
        history({ id: "updateOverlay", newData: { key: "color", data: value }, location: { page: "drawer", id } })
      })
    },
    template: () => {
      $selected.data.forEach((id) => {
        history({ id: "updateTemplate", newData: { key: "color", data: value }, location: { page: "drawer", id } })
      })
    },
  }

  function updateColor() {
    if ($selected.id) actions[$selected.id]()
    activePopup.set(null)
  }

  function colorChange(e: any) {
    value = e.target.value
  }
</script>

<Color {value} on:input={colorChange} height={100} />

<br />

<Button on:click={updateColor} dark center>
  <Icon id="check" />
</Button>
