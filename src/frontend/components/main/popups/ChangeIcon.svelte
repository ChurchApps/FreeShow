<script lang="ts">
  import { activePopup, categories, selected } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import Button from "../../inputs/Button.svelte"
  import { customIcons } from "../customIcons"
</script>

<div style="display: flex;flex-wrap: wrap;gap: 5px;justify-content: center;">
  {#each Object.keys(customIcons) as icon}
    <Button
      on:click={() => {
        categories.update((a) => {
          $selected.data.forEach((b) => {
            a[b].icon = icon
          })
          return a
        })
        activePopup.set(null)
      }}
    >
      <Icon id={icon} size={2} custom white />
    </Button>
  {/each}
</div>
