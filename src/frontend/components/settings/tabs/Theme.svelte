<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { outputs, selected, theme, themes } from "../../../stores"
    import { updateThemeValues } from "../../../utils/updateSettings"
    import { clone } from "../../helpers/array"
    import { getSystemFontsList } from "../../helpers/fonts"
    import { history } from "../../helpers/history"
    import Title from "../../input/Title.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"

    const colors: string[] = [
        "primary",
        "primary-lighter",
        "primary-darker",
        "primary-darkest",
        "secondary",
        "text",
        "secondary-text"
        // "textInvert",
        // "secondary-opacity",
        // "hover",
        // "focus",
    ]

    const unsubscribe = theme.subscribe((a: string) => {
        if (!$themes[a]) return
        updateThemeValues($themes[a])
    })
    onDestroy(unsubscribe)

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

        // update output outline color if just one output
        if (key !== "colors" || id !== "secondary") return

        let colorKeys = Object.keys($outputs)
        if (colorKeys.length !== 1) return

        outputs.update((a) => {
            a[colorKeys[0]].color = value
            return a
        })
    }

    let fontsList: { label: string; value: string; style: string }[] = []
    onMount(async () => {
        fontsList = await getSystemFontsList()
    })
</script>

<MaterialDropdown options={fontsList} value={$theme === "default" ? "" : $themes[$theme]?.font?.family || ""} label="settings.font_family" on:change={(e) => updateTheme(e.detail || "", "family", "font")} allowEmpty />
<MaterialNumberInput label="settings.font_size" value={Number($themes[$theme]?.font?.size.replace("em", "") ?? 1) * 10} min={5} max={20} on:change={(e) => updateTheme(e.detail / 10 + "em", "size", "font")} />

<!-- WIP deprecated -->
<MaterialNumberInput label="settings.border_radius" value={Number($themes[$theme]?.border?.radius?.replace("px", "") || 0)} max={30} step={5} on:change={(e) => updateTheme(e.detail + "px", "radius", "border")} />

<Title label="settings.colors" icon="color" />

<div class="colors">
    {#each colors as color}
        <MaterialColorInput label={"theme." + color} value={$themes[$theme]?.colors?.[color] || ""} on:change={(e) => updateTheme(e.detail, color)} />
    {/each}
</div>

<style>
    .colors {
        display: flex;
        flex-direction: column;
    }
</style>
