<!-- https://dev.to/josef/theming-in-svelte-with-css-variables-53kd -->
<script lang="ts">
  import { theme, language, themes } from "../../stores"
  import Dropdown from "../inputs/Dropdown.svelte"

  theme.subscribe((a: string) => {
    Object.entries($themes[a].colors).forEach(([key, value]: any) => document.documentElement.style.setProperty("--" + key, value))
    Object.entries($themes[a].font).forEach(([key, value]: any) => document.documentElement.style.setProperty("--font-" + key, value))
  })

  function getThemesArray() {
    let names: any[] = []
    if (Object.keys(themes).length) {
      Object.entries($themes).forEach(([id, obj]) => {
        names.push({ name: obj.default ? `$:themes.${obj.name}:$` : obj.name, id, updater: $language })
      })
    }
    return names
  }
</script>

<Dropdown value={$themes[$theme].default ? `$:themes.${$themes[$theme].name}:$` : $themes[$theme].name} options={getThemesArray()} on:click={(e) => theme.set(e.detail.id)} />
