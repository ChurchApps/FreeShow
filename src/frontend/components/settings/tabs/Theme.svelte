<script lang="ts">
    import { onDestroy } from "svelte"
    import { dictionary, outputs, selected, theme, themes } from "../../../stores"
    import { translate } from "../../../utils/language"
    import { updateThemeValues } from "../../../utils/updateSettings"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import FontDropdown from "../../inputs/FontDropdown.svelte"
    import HiddenInput from "../../inputs/HiddenInput.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import { defaultThemes } from "./defaultThemes"

    const colors: string[] = [
        "primary",
        "primary-lighter",
        "primary-darker",
        "primary-darkest",
        "secondary",
        "text",
        "secondary-text",
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

    $: themeNames = getThemesArray($themes)

    function getThemesArray(themes: any) {
        let names: any[] = []
        Object.entries(themes).forEach(([id, obj]: any) => {
            names.push({ name: obj.default ? `$:themes.${obj.name}:$` : obj.name, id, default: obj.default })
        })
        return names.sort((a, b) =>
            a.id === "default" || b.id === "default"
                ? 1
                : (a.default ? $dictionary.themes?.[a.name.slice(a.name.indexOf(".") + 1, a.name.length - 2)] || "" : a.name).localeCompare(b.default ? $dictionary.themes?.[b.name.slice(b.name.indexOf(".") + 1, b.name.length - 2)] || "" : b.name)
        )
    }

    function updateTheme(e: any, id: null | string, key: string = "colors") {
        let value: string = e.target?.value ?? e

        let themeId = $selected.data[0]?.id || $theme

        if (themeId === "default") {
            if (!value) return

            // duplicate
            let thisTheme: any = clone($themes[themeId])
            let data: any = {
                ...thisTheme,
                default: false,
                name: (key === "name" ? value : thisTheme.name) + " 2",
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

    let themeValue: any
    $: themeValue = $themes[$theme]?.default ? $dictionary.themes?.[$themes[$theme].name] || "" : $themes[$theme]?.name || ""

    function resetThemes() {
        theme.set("default")
        themes.set(clone(defaultThemes))
        updateThemeValues(defaultThemes.default)
    }

    let edit: boolean = false
</script>

<!-- <h3><T id="settings.font" /></h3> -->
<CombinedInput>
    <p><T id="settings.font_family" /></p>
    <!-- <Dropdown options={fonts} value={$themes[$theme]?.font?.family} on:click={(e) => updateTheme(e.detail.name, "family", "font")} width="200px" /> -->
    <FontDropdown system value={$theme === "default" ? "" : $themes[$theme]?.font?.family} on:click={(e) => updateTheme(e.detail, "family", "font")} />
</CombinedInput>
<CombinedInput>
    <p><T id="settings.font_size" /></p>
    <NumberInput value={$themes[$theme]?.font?.size.replace("em", "") ?? 1} inputMultiplier={10} step={0.1} decimals={1} min={0.5} max={2} on:change={(e) => updateTheme(e.detail + "em", "size", "font")} />
</CombinedInput>
<CombinedInput>
    <p><T id="settings.border_radius" /></p>
    <NumberInput value={$themes[$theme]?.border?.radius?.replace("px", "") || 0} max={30} step={5} on:change={(e) => updateTheme(e.detail + "px", "radius", "border")} />
</CombinedInput>

<h3><T id="settings.colors" /></h3>
{#each colors as color}
    <CombinedInput>
        <p><T id={"theme." + color} /></p>
        <Color value={$themes[$theme]?.colors?.[color]} on:input={(e) => updateTheme(e.detail, color)} />
    </CombinedInput>
{/each}

<div class="filler" />
<div class="bottom">
    <div class="themes" style="display: flex;overflow-x: auto;">
        {#each themeNames as currentTheme}
            {@const active = $theme === currentTheme.id}
            {@const currentColors = $themes[currentTheme.id].colors}
            {@const name = translate(currentTheme.name, { parts: true })}

            <SelectElem id="theme" data={{ id: currentTheme.id }} fill>
                <Button
                    outline={active}
                    class={currentTheme.id === "default" ? "" : "context #theme"}
                    {active}
                    style="width: 100%;{active ? '' : `background-color: ${currentColors.primary};`}"
                    on:click={() => theme.set(currentTheme.id)}
                    bold={false}
                    center
                >
                    {#if active}<Icon id="theme" right white />{/if}
                    <HiddenInput style="color: {currentColors.secondary};" value={name} id={"theme_" + currentTheme.id} on:edit={(e) => updateTheme(e.detail.value, null, "name")} bind:edit />
                </Button>
            </SelectElem>
        {/each}
    </div>

    <div style="display: flex;">
        <Button
            style="width: 100%;"
            on:click={() => {
                history({ id: "UPDATE", newData: { data: clone($themes[$theme]), replace: { default: false, name: themeValue + " 2" } }, location: { page: "settings", id: "settings_theme" } })
            }}
            center
        >
            <Icon id="add" right />
            <T id="settings.add" />
        </Button>
        {#if Object.values($themes).length < 10}
            <Button on:click={resetThemes} center>
                <Icon id="reset" right />
                <p><T id="settings.reset_themes" /></p>
            </Button>
        {/if}
    </div>
</div>

<style>
    h3 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }

    .filler {
        height: 76px;
    }
    .bottom {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        background-color: var(--primary-darkest);

        display: flex;
        flex-direction: column;
    }

    .bottom .themes :global(button) {
        padding: 0 0.8em !important;
        font-size: 14px;
        font-family: sans-serif;
    }
    .bottom .themes :global(button.outline) {
        outline: 2px solid white !important;
    }
</style>
