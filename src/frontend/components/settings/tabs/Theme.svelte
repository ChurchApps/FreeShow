<script lang="ts">
  import { uid } from "uid"

  import { dictionary, theme, themes } from "../../../stores"
  import { history } from "../../helpers/history"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Color from "../../inputs/Color.svelte"
  import FontDropdown from "../../inputs/FontDropdown.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import TextInput from "../../inputs/TextInput.svelte"
  import ThemeSwitcher from "../ThemeSwitcher.svelte"

  const colors: string[] = [
    "primary",
    "primary-lighter",
    "primary-darker",
    "primary-darkest",
    "text",
    "textInvert",
    "secondary-text",
    "secondary",
    "secondary-opacity",
    "hover",
    "focus",
  ]

  function updateTheme(e: any, id: null | string, key: string = "colors") {
    history({ id: "theme", newData: { key, id, value: e.target?.value || e }, location: { page: "settings", theme: $theme } })
  }

  const changeValue = (e: any) => (themeValue = e.target.value)
  let themeValue: any
  $: themeValue = $themes[$theme].default ? $dictionary.themes[$themes[$theme].name] : $themes[$theme].name
</script>

<ThemeSwitcher />
{#if themeValue !== $dictionary.themes.default}
  <div class="flex">
    <TextInput value={themeValue} on:input={changeValue} light />
    <!-- TODO: history -->
    {#if themeValue === ($themes[$theme].default ? $dictionary.themes[$themes[$theme].name] : $themes[$theme].name)}
      <Button
        on:click={() => {
          history({ id: "addTheme", oldData: { ...$themes[$theme] }, location: { page: "settings", theme: $theme } })
        }}
      >
        <T id="settings.remove" />
      </Button>
    {:else}
      <Button
        on:click={() => {
          updateTheme(themeValue, null, "name")
        }}
      >
        <T id="settings.change_name" />
      </Button>
    {/if}
    <Button
      on:click={() => {
        history({ id: "addTheme", newData: { ...$themes[$theme], name: themeValue }, location: { page: "settings", theme: uid() } })
      }}
    >
      <T id="settings.add" />
    </Button>
  </div>
{/if}
<hr />
<h3><T id="settings.font" /></h3>
<div>
  <p><T id="settings.font_family" /></p>
  <!-- <Dropdown options={fonts} value={$themes[$theme].font.family} on:click={(e) => updateTheme(e.detail.name, "family", "font")} width="200px" /> -->
  <FontDropdown value={$themes[$theme].font.family} on:click={(e) => updateTheme(e.detail, "family", "font")} style="width: 200px;" />
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
<Button style="width: 100%;" center disabled>
  <T id="settings.reset_colors" />
</Button>
<Button style="width: 100%;" center disabled>
  <T id="settings.reset_themes" />
</Button>

<style>
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
    width: 100%;
    margin: 20px 0;
  }

  div:not(.scroll) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 5px 0;
  }

  .flex {
    display: flex;
    align-items: center;
  }
</style>
