<script lang="ts">
    import { dictionary, labelsDisabled, theme, themes } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import FontDropdown from "../../inputs/FontDropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import ThemeSwitcher from "../ThemeSwitcher.svelte"
    import { defaultThemes } from "./defaultThemes"

    const colors: string[] = [
        "primary",
        "primary-lighter",
        "primary-darker",
        "primary-darkest",
        "secondary",
        "secondary-text",
        "text",
        // "textInvert",
        // "secondary-opacity",
        // "hover",
        // "focus",
    ]

    function updateTheme(e: any, id: null | string, key: string = "colors") {
        let value: string = e.target?.value ?? e

        if ($theme === "default") {
            if (!value) return

            // duplicate
            let thisTheme: any = clone($themes[$theme])
            let data: any = {
                ...thisTheme,
                default: false,
                name: themeValue + " 2",
                [key]: { ...thisTheme[key], [id!]: value },
            }

            history({ id: "UPDATE", newData: { data }, location: { page: "settings", id: "settings_theme" } })
            updateStyle(data)
        } else {
            history({ id: "UPDATE", newData: { key, subkey: id, data: value }, oldData: { id: $theme }, location: { page: "settings", id: "settings_theme", override: "theme#" + $theme + "." + id } })

            setTimeout(() => {
                updateStyle($themes[$theme])
            }, 20)
        }
    }

    const changeValue = (e: any) => (themeValue = e.target.value)
    let themeValue: any
    $: themeValue = $themes[$theme].default ? $dictionary.themes[$themes[$theme].name] : $themes[$theme].name

    function resetTheme() {
        let data = { ...defaultThemes.default, default: false, name: themeValue }
        history({ id: "UPDATE", newData: { data }, oldData: { id: $theme }, location: { page: "settings", id: "settings_theme" } })
        updateStyle($themes[$theme])
    }

    function resetThemes() {
        theme.set("default")
        themes.set(JSON.parse(JSON.stringify(defaultThemes)))
        updateStyle(defaultThemes.default)
    }

    function updateStyle(themes: any) {
        Object.entries(themes.colors).forEach(([key, value]: any) => document.documentElement.style.setProperty("--" + key, value))
        Object.entries(themes.font).forEach(([key, value]: any) => document.documentElement.style.setProperty("--font-" + key, value))
    }
</script>

<CombinedInput>
    <ThemeSwitcher />
</CombinedInput>

<CombinedInput>
    <TextInput disabled={$theme === "default"} value={themeValue} on:input={changeValue} on:change={() => updateTheme(themeValue, null, "name")} />
    <Button
        disabled={$theme === "default"}
        on:click={() => {
            history({ id: "UPDATE", newData: { id: $theme }, location: { page: "settings", id: "settings_theme" } })
        }}
    >
        <Icon id="delete" right />
        {#if !$labelsDisabled}
            <T id="actions.delete" />
        {/if}
    </Button>
    <Button
        on:click={() => {
            history({ id: "UPDATE", newData: { data: clone($themes[$theme]), replace: { default: false, name: themeValue + " 2" } }, location: { page: "settings", id: "settings_theme" } })
        }}
    >
        <Icon id="duplicate" right />
        {#if !$labelsDisabled}
            <T id="actions.duplicate" />
        {/if}
    </Button>
</CombinedInput>

<h3><T id="settings.font" /></h3>
<CombinedInput>
    <p><T id="settings.font_family" /></p>
    <!-- <Dropdown options={fonts} value={$themes[$theme].font.family} on:click={(e) => updateTheme(e.detail.name, "family", "font")} width="200px" /> -->
    <FontDropdown system value={$theme === "default" ? "" : $themes[$theme].font.family} on:click={(e) => updateTheme(e.detail, "family", "font")} />
</CombinedInput>
<CombinedInput>
    <p><T id="settings.font_size" /></p>
    <NumberInput value={$themes[$theme].font.size.replace("em", "")} inputMultiplier={10} step={0.1} decimals={1} min={0.5} max={2} on:change={(e) => updateTheme(e.detail + "em", "size", "font")} />
</CombinedInput>

<h3><T id="settings.colors" /></h3>
{#each colors as color}
    <CombinedInput>
        <p><T id={"theme." + color} /></p>
        <Color value={$themes[$theme].colors[color]} on:input={(e) => updateTheme(e, color)} />
    </CombinedInput>
{/each}

<br />

<Button style="width: 100%;" on:click={resetTheme} center>
    <Icon id="reset" right />
    <T id="settings.reset_theme" />
</Button>
<Button style="width: 100%;" on:click={resetThemes} center>
    <Icon id="reset" right />
    <T id="settings.reset_themes" />
</Button>

<br />

<style>
    h3 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }
</style>
