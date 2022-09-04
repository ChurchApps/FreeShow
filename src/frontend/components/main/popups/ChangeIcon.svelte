<script lang="ts">
  import { activePopup, categories, mediaFolders, overlayCategories, selected, templateCategories } from "../../../stores"
  import { addItem } from "../../edit/scripts/addItem"
  import Icon from "../../helpers/Icon.svelte"
  import Button from "../../inputs/Button.svelte"
  import { customIcons, customIconsColors } from "../customIcons"

  const names: any = {
    category_shows: (icon: string) => categories.update((a) => changeIcon(a, icon)),
    category_media: (icon: string) => mediaFolders.update((a) => changeIcon(a, icon)),
    category_overlays: (icon: string) => overlayCategories.update((a) => changeIcon(a, icon)),
    category_templates: (icon: string) => templateCategories.update((a) => changeIcon(a, icon)),
    slide: (icon: string) => addItem("icon", icon, { color: customIconsColors[icon] }),
  }

  $: colors = $selected.id === "slide"

  const changeIcon = (a: any, icon: string) => {
    $selected.data.forEach((b) => {
      if (b !== "all" && b !== "unlabeled") a[b].icon = icon
    })
    return a
  }

  function click(icon: string) {
    console.log($selected)
    if ($selected.id && names[$selected.id]) names[$selected.id](icon)
    else console.log("change icon " + $selected.id)

    activePopup.set(null)
  }
</script>

<div style="display: flex;flex-wrap: wrap;gap: 5px;justify-content: center;">
  {#each Object.keys(customIcons) as icon}
    {@const color = colors && customIconsColors[icon] ? "color: " + customIconsColors[icon] : ""}
    <Button on:click={() => click(icon)}>
      <Icon id={icon} size={2} custom white style={color} />
    </Button>
  {/each}
</div>
