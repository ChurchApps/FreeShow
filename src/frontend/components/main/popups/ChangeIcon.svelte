<script lang="ts">
  import { activePopup, categories, selected } from "../../../stores"
  import { addItem } from "../../edit/scripts/addItem"
  import Icon from "../../helpers/Icon.svelte"
  import Button from "../../inputs/Button.svelte"
  import { customIcons } from "../customIcons"

  function click(icon: string) {
    if ($selected.id === "category") {
      categories.update((a) => {
        $selected.data.forEach((b) => {
          a[b].icon = icon
        })
        return a
      })
    } else if ($selected.id === "slide") {
      addItem("icon", icon)
    }
    activePopup.set(null)
  }
</script>

<div style="display: flex;flex-wrap: wrap;gap: 5px;justify-content: center;">
  {#each Object.keys(customIcons) as icon}
    <Button on:click={() => click(icon)}>
      <Icon id={icon} size={2} custom white />
    </Button>
  {/each}
</div>
