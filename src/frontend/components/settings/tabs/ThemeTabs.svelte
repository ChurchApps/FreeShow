<script lang="ts">
    import type { Themes } from "../../../../types/Settings"
    import { selected, theme, themes } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { updateThemeValues } from "../../../utils/updateSettings"
    import Icon from "../../helpers/Icon.svelte"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Tabs from "../../input/Tabs.svelte"
    import HiddenInput from "../../inputs/HiddenInput.svelte"

    $: themeNames = getThemesArray($themes)

    function getThemesArray(themes: { [key: string]: Themes }) {
        let names: any[] = []
        Object.entries(themes).forEach(([id, obj]) => {
            names.push({ name: obj.default ? `themes.${obj.name}` : obj.name, id, default: obj.default })
        })

        return names.sort((a, b) => {
            if (a.id === "default" || b.id === "default") return 1
            let nameA = a.default ? translateText(`themes.${a.name.slice(a.name.indexOf(".") + 1, a.name.length - 2)}`) : a.name || ""
            let nameB = b.default ? translateText(`themes.${b.name.slice(b.name.indexOf(".") + 1, b.name.length - 2)}`) : b.name || ""
            return nameA.localeCompare(nameB)
        })
    }

    function updateTheme(e: any, id: null | string, key = "colors") {
        let value: string = e.target?.value ?? e

        let themeId = $selected.data[0]?.id || $theme

        if (themeId === "default") {
            if (!value) return

            // duplicate
            let thisTheme = clone($themes[themeId])
            let data = {
                ...thisTheme,
                default: false,
                name: (key === "name" ? value : thisTheme.name) + " 2"
            }
            if (key !== "name") data[key] = { ...thisTheme[key], [id!]: value }

            history({ id: "UPDATE", newData: { data }, location: { page: "settings", id: "settings_theme" } })
            updateThemeValues(data)
        } else {
            history({ id: "UPDATE", newData: { key, subkey: id, data: value }, oldData: { id: themeId }, location: { page: "settings", id: "settings_theme", override: "theme#" + themeId + "." + id } })

            setTimeout(() => {
                updateThemeValues($themes[themeId])
            }, 20)
        }
    }

    let themeValue: any
    $: themeValue = $themes[$theme]?.default ? translateText(`themes.${$themes[$theme].name}`) : $themes[$theme]?.name || ""

    // CREATE

    function createTheme() {
        history({ id: "UPDATE", newData: { data: clone($themes[$theme]), replace: { default: false, name: themeValue + " 2" } }, location: { page: "settings", id: "settings_theme" } })
    }

    let edit: any
</script>

<Tabs id="theme" tabs={themeNames} value={$theme} class="context #theme" on:open={e => theme.set(e.detail)} on:create={createTheme} let:tab>
    {#if $theme === tab.id}<Icon id="check" size={0.7} right white />{/if}
    <HiddenInput style="text-align: center;" value={translateText(tab.name)} id={"theme_" + tab.id} on:edit={e => updateTheme(e.detail.value, null, "name")} bind:edit />
</Tabs>
