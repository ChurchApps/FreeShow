<script lang="ts">
    import { dictionary, labelsDisabled, theme, themes } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Color from "../../inputs/Color.svelte"
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
        if ($theme === "default") {
            // duplicate
            let thisTheme: any = clone($themes[$theme])
            let data: any = {
                ...thisTheme,
                default: false,
                name: themeValue + " 2",
                [key]: { ...thisTheme[key], [id!]: e.target?.value || e },
            }

            history({ id: "UPDATE", newData: { data }, location: { page: "settings", id: "settings_theme" } })
            updateStyle(data)
        } else {
            let value: string = e.target?.value || e

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

<ThemeSwitcher />
<div class="flex">
    <TextInput disabled={$theme === "default"} value={themeValue} on:input={changeValue} on:change={() => updateTheme(themeValue, null, "name")} light />
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
</div>
<hr />
<h3><T id="settings.font" /></h3>
<div>
    <p><T id="settings.font_family" /></p>
    <!-- <Dropdown options={fonts} value={$themes[$theme].font.family} on:click={(e) => updateTheme(e.detail.name, "family", "font")} width="200px" /> -->
    <FontDropdown system value={$theme === "default" ? "" : $themes[$theme].font.family} on:click={(e) => updateTheme(e.detail, "family", "font")} style="width: 200px;" />
</div>
<div>
    <p><T id="settings.font_size" /></p>
    <NumberInput value={$themes[$theme].font.size.replace("em", "")} inputMultiplier={10} step={0.1} decimals={1} min={0.5} max={2} outline on:change={(e) => updateTheme(e.detail + "em", "size", "font")} />
</div>
<hr />
<h3><T id="settings.colors" /></h3>
{#each colors as color}
    <div>
        <p><T id={"theme." + color} /></p>
        <Color value={$themes[$theme].colors[color]} style="width: 200px;" on:input={(e) => updateTheme(e, color)} />
    </div>
{/each}
<hr />
<Button style="width: 100%;" on:click={resetTheme} center>
    <Icon id="reset" right />
    <T id="settings.reset_theme" />
</Button>
<Button style="width: 100%;" on:click={resetThemes} center>
    <Icon id="reset" right />
    <T id="settings.reset_themes" />
</Button>

<style>
    div:not(.scroll) {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 5px 0;
        min-height: 38px;
    }

    h3 {
        text-align: center;
        font-size: 1.8em;
        margin: 20px 0;
    }
    h3 {
        font-size: initial;
    }

    hr {
        background-color: var(--primary-lighter);
        border: none;
        height: 2px;
        margin: 20px 0;
    }

    .flex {
        display: flex;
        align-items: center;
        gap: 5px;
    }
</style>
