<!-- https://dev.to/josef/theming-in-svelte-with-css-variables-53kd -->
<script lang="ts">
  import { theme, language, themes, dictionary } from "../../stores"
  import Dropdown from "../inputs/Dropdown.svelte"

  theme.subscribe((a: string) => {
    Object.entries($themes[a].colors).forEach(([key, value]: any) => document.documentElement.style.setProperty("--" + key, value))
    Object.entries($themes[a].font).forEach(([key, value]: any) => {
      if ((key === "family" && !value) || a === "default")
        value = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif'
      document.documentElement.style.setProperty("--font-" + key, value)
    })
  })

  $: themeNames = getThemesArray($themes)

  function getThemesArray(themes: any) {
    let names: any[] = []
    Object.entries(themes).forEach(([id, obj]: any) => {
      names.push({ name: obj.default ? `$:themes.${obj.name}:$` : obj.name, id, updater: $language, default: obj.default })
    })
    return names.sort((a, b) =>
      a.id === "default" || b.id === "default"
        ? 1
        : (a.default ? $dictionary.themes?.[a.name.slice(a.name.indexOf(".") + 1, a.name.length - 2)] || "" : a.name).localeCompare(
            b.default ? $dictionary.themes?.[b.name.slice(b.name.indexOf(".") + 1, b.name.length - 2)] || "" : b.name
          )
    )
  }
</script>

<Dropdown value={$themes[$theme].default ? `$:themes.${$themes[$theme].name}:$` : $themes[$theme].name} options={themeNames} on:click={(e) => theme.set(e.detail.id)} />
