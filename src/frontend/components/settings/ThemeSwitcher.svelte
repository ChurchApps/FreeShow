<!-- https://dev.to/josef/theming-in-svelte-with-css-variables-53kd -->
<script lang="ts">
    import { theme, language, themes, dictionary } from "../../stores"
    import { updateThemeValues } from "../../utils/updateSettings"
    import Dropdown from "../inputs/Dropdown.svelte"

    theme.subscribe((a: string) => {
        if (!$themes[a]) return
        updateThemeValues($themes[a])
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
                : (a.default ? $dictionary.themes?.[a.name.slice(a.name.indexOf(".") + 1, a.name.length - 2)] || "" : a.name).localeCompare(b.default ? $dictionary.themes?.[b.name.slice(b.name.indexOf(".") + 1, b.name.length - 2)] || "" : b.name)
        )
    }
</script>

<Dropdown style="width: 100%;" value={$themes[$theme]?.default ? `$:themes.${$themes[$theme].name}:$` : $themes[$theme]?.name || ""} options={themeNames} on:click={(e) => theme.set(e.detail.id)} />
