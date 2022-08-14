<script lang="ts">
  import { uid } from "uid"
  import { dictionary, labelsDisabled, theme, themes } from "../../../stores"
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
      let thisTheme: any = $themes[$theme]
      let newData: any = {
        ...thisTheme,
        default: false,
        name: themeValue + " 2",
        [key]: { ...thisTheme[key], [id!]: e.target?.value || e },
      }
      history({
        id: "addTheme",
        newData,
        location: { page: "settings", theme: uid() },
      })
    } else {
      let value: string = e.target?.value || e
      history({ id: "theme", newData: { key, id, value }, location: { page: "settings", theme: $theme } })
      converts[id!]?.forEach((newValue: any) => {
        let rgba: string | null = makeTransparent(value, newValue.opacity)
        if (rgba) history({ id: "theme", newData: { key: "colors", id: newValue.id, value: rgba }, location: { page: "settings", theme: $theme } })
      })
    }
  }

  const converts: any = {
    secondary: [{ id: "secondary-opacity", opacity: 0.5 }],
    text: [
      { id: "hover", opacity: 0.05 },
      { id: "focus", opacity: 0.1 },
    ],
  }

  function makeTransparent(value: string, amount: number = 0.5) {
    let rgb = hexToRgb(value)
    if (!rgb) return null
    let newValue: string = `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${amount})`
    return newValue
  }
  function hexToRgb(hex: string) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null
  }

  const changeValue = (e: any) => (themeValue = e.target.value)
  let themeValue: any
  $: themeValue = $themes[$theme].default ? $dictionary.themes[$themes[$theme].name] : $themes[$theme].name

  function resetTheme() {
    history({
      id: "addTheme",
      newData: { ...defaultThemes.default, default: false, name: themeValue },
      oldData: { ...$themes[$theme] },
      location: { page: "settings", theme: $theme },
    })
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
{#if $theme !== "default"}
  <div class="flex">
    <TextInput value={themeValue} on:input={changeValue} on:change={() => updateTheme(themeValue, null, "name")} light />
    <Button
      on:click={() => {
        history({ id: "addTheme", oldData: { ...$themes[$theme] }, location: { page: "settings", theme: $theme } })
      }}
    >
      <Icon id="delete" right />
      {#if !$labelsDisabled}
        <T id="actions.delete" />
      {/if}
    </Button>
    <Button
      on:click={() => {
        history({
          id: "addTheme",
          newData: { ...JSON.parse(JSON.stringify($themes[$theme])), default: false, name: themeValue + " 2" },
          location: { page: "settings", theme: uid() },
        })
      }}
    >
      <Icon id="duplicate" right />
      {#if !$labelsDisabled}
        <T id="actions.duplicate" />
      {/if}
    </Button>
  </div>
{/if}
<hr />
<h3><T id="settings.font" /></h3>
<div>
  <p><T id="settings.font_family" /></p>
  <!-- <Dropdown options={fonts} value={$themes[$theme].font.family} on:click={(e) => updateTheme(e.detail.name, "family", "font")} width="200px" /> -->
  <FontDropdown system value={$theme === "default" ? "" : $themes[$theme].font.family} on:click={(e) => updateTheme(e.detail, "family", "font")} style="width: 200px;" />
</div>
<div>
  <p><T id="settings.font_size" /></p>
  <NumberInput
    value={$themes[$theme].font.size.replace("em", "")}
    inputMultiplier={10}
    step={0.1}
    decimals={1}
    min={0.5}
    max={2}
    outline
    on:change={(e) => updateTheme(e.detail + "em", "size", "font")}
  />
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
