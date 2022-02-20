<script lang="ts">
  import {
    autoOutput,
    defaultProjectName,
    dictionary,
    displayMetadata,
    fullColors,
    groupNumbers,
    groups,
    imageExtensions,
    labelsDisabled,
    os,
    screen,
    settingsTab,
    theme,
    themes,
    videoExtensions,
  } from "../../stores"
  import { history } from "../helpers/history"
  import { uid } from "uid"
  import T from "../helpers/T.svelte"
  import Screens from "./Screens.svelte"
  import Color from "../inputs/Color.svelte"
  import Button from "../inputs/Button.svelte"
  import Checkbox from "../inputs/Checkbox.svelte"
  import Dropdown from "../inputs/Dropdown.svelte"
  import TextInput from "../inputs/TextInput.svelte"
  import ThemeSwitcher from "./ThemeSwitcher.svelte"
  import LocaleSwitcher from "./LocaleSwitcher.svelte"
  import NumberInput from "../inputs/NumberInput.svelte"
  import FontDropdown from "../inputs/FontDropdown.svelte"

  const labels = (e: any) => labelsDisabled.set(e.target.checked)
  const setColors = (e: any) => fullColors.set(e.target.checked)
  const setAutoOutput = (e: any) => autoOutput.set(e.target.checked)
  const setGroupNumber = (e: any) => groupNumbers.set(e.target.checked)

  const projectNames: any[] = [
    { name: "$:projectName.${date}:$", id: "date" },
    { name: "$:projectName.${today}:$", id: "today" },
    { name: "$:projectName.${sunday}:$", id: "sunday" },
    { name: "$:projectName.${week}:$", id: "week" },
    { name: "$:projectName.${custom}:$", id: "custom" },
    { name: "$:projectName.${blank}:$", id: "blank" },
  ]

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

  function changeGroup(e: any, id: string, key: string = "name") {
    groups.update((a) => {
      if (key === "name" && a[id].default) delete a[id].default
      a[id][key] = e.target.value
      return a
    })
  }

  $: g = Object.entries($groups).map(([id, a]: any) => ({ id, ...a }))

  const changeValue = (e: any, key: string) => (value[key] = e.target.value)
  let value: any = {
    video: "",
    image: "",
    group: "",
    theme: "",
    groupColor: "#ffffff",
  }
  $: value.theme = $themes[$theme].default ? $dictionary.themes[$themes[$theme].name] : $themes[$theme].name

  const meta: any[] = [{ name: "never" }, { name: "always" }, { name: "last" }, { name: "first_last" }]
</script>

<main>
  <h2>
    {#key $settingsTab}
      <T id="settings.{$settingsTab}" />
    {/key}
  </h2>
  <div class="scroll">
    {#if $settingsTab === "general"}
      <div>
        <p><T id="settings.language" /></p>
        <LocaleSwitcher />
      </div>
      <div>
        <p><T id="settings.disable_labels" /></p>
        <!-- style="width: 200px;" -->
        <Checkbox checked={$labelsDisabled} on:change={labels} />
      </div>
      <div>
        <p><T id="settings.group_numbers" /></p>
        <Checkbox checked={$groupNumbers} on:change={setGroupNumber} />
      </div>
      <div>
        <p><T id="settings.full_colors" /></p>
        <Checkbox checked={$fullColors} on:change={setColors} />
      </div>
      <div>
        <p><T id="settings.auto_output" /></p>
        <Checkbox checked={$autoOutput} on:change={setAutoOutput} />
      </div>
      <div>
        <p><T id="settings.display_metadata" /></p>
        <Dropdown
          options={meta}
          value={$displayMetadata}
          style="width: 200px;"
          on:click={(e) => {
            displayMetadata.set(e.detail.name)
          }}
        />
      </div>
      <div>
        <p><T id="settings.default_project_name" /></p>
        <Dropdown
          options={projectNames}
          value={$defaultProjectName}
          style="width: 200px;"
          on:click={(e) => {
            // history?
            defaultProjectName.set(e.detail.id)
          }}
        />
      </div>
      <div>
        <p><T id="settings.resolution" /></p>
        <span>
          <!-- defaults dropdown -->
          <!-- custom... -->
          <NumberInput
            value={$screen.resolution.width}
            min={100}
            max={10000}
            buttons={false}
            on:change={(e) => {
              screen.update((a) => {
                a.resolution.width = e.detail
                return a
              })
            }}
          />
          <NumberInput
            value={$screen.resolution.height}
            min={100}
            max={10000}
            buttons={false}
            on:change={(e) => {
              screen.update((a) => {
                a.resolution.height = e.detail
                return a
              })
            }}
          />
        </span>
      </div>
      <div>
        <p><T id="settings.video_extensions" /></p>
        <span class="flex">
          {#each $videoExtensions as extension, i}
            <span style="text-transform: uppercase;">
              {#if i > 0},&nbsp;{/if}<span class="hoverDelete" on:click={() => videoExtensions.set($videoExtensions.filter((a) => a !== extension))}>{extension}</span>
            </span>
          {/each}
          <TextInput value={value.video} on:input={(e) => changeValue(e, "video")} light />
          <Button
            on:click={() => {
              if (!$videoExtensions.includes(value.video.toLowerCase())) {
                videoExtensions.set([...$videoExtensions, value.video.toLowerCase()])
                value.video = ""
              }
            }}
          >
            <p><T id="settings.add" /></p>
          </Button>
        </span>
      </div>
      <div>
        <p><T id="settings.image_extensions" /></p>
        <span class="flex">
          {#each $imageExtensions as extension, i}
            <span style="text-transform: uppercase;">
              {#if i > 0},&nbsp;{/if}<span class="hoverDelete" on:click={() => imageExtensions.set($imageExtensions.filter((a) => a !== extension))}>{extension}</span>
            </span>
          {/each}
          <TextInput value={value.image} on:input={(e) => changeValue(e, "image")} light />
          <Button
            on:click={() => {
              if (!$imageExtensions.includes(value.image.toLowerCase())) {
                imageExtensions.set([...$imageExtensions, value.image.toLowerCase()])
                value.image = ""
              }
            }}
          >
            <p><T id="settings.add" /></p>
          </Button>
        </span>
      </div>
      <div>
        <p><T id="settings.show_location" /></p>
        <span>select folder... (user/documents/FreeShow)</span>
      </div>
      <!-- project store location... -->
    {:else if $settingsTab === "theme"}
      <ThemeSwitcher />
      {#if value.theme !== $dictionary.themes.default}
        <div class="flex">
          <TextInput value={value.theme} on:input={(e) => changeValue(e, "theme")} light />
          <!-- TODO: history -->
          {#if value.theme === ($themes[$theme].default ? $dictionary.themes[$themes[$theme].name] : $themes[$theme].name)}
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
                updateTheme(value.theme, null, "name")
              }}
            >
              <T id="settings.change_name" />
            </Button>
          {/if}
          <Button
            on:click={() => {
              history({ id: "addTheme", newData: { ...$themes[$theme], name: value.theme }, location: { page: "settings", theme: uid() } })
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
      <Button style="width: 100%;" center>
        <T id="settings.reset_colors" />
      </Button>
      <Button style="width: 100%;" center>
        <T id="settings.reset_themes" />
      </Button>
    {:else if $settingsTab === "groups"}
      <!-- <hr>
      <h3>Global Groups</h3> -->
      {#each g as group}
        <div>
          <TextInput value={group.default ? $dictionary.groups[group.name] : group.name} on:change={(e) => changeGroup(e, group.id)} light />
          <!-- {#if group.default}
              <T id="groups.{group.name}" />
            {:else}
              {group.name}
            {/if} -->
          <Color value={group.color} on:input={(e) => changeGroup(e, group.id, "color")} style="width: 200px;" />
          <Button
            on:click={() => {
              history({ id: "addGlobalGroup", oldData: { id: group.id, data: { ...$groups[group.id] } } })
            }}
          >
            <T id="settings.remove" />
          </Button>
        </div>
      {/each}
      <hr />
      <h3><T id="settings.add_group" /></h3>
      <div>
        <TextInput value={value.group} on:input={(e) => changeValue(e, "group")} light />
        <Color value={value.groupColor} on:input={(e) => changeValue(e, "groupColor")} style="width: 200px;" />
      </div>
      <Button
        style="width: 100%;"
        center
        on:click={() => {
          if (value.group.length) history({ id: "addGlobalGroup", newData: { id: uid(), data: { name: value.group, color: value.groupColor } } })
        }}
      >
        <T id="settings.add" />
      </Button>
    {:else if $settingsTab === "display"}
      <!-- TODO: display... -->
      <div>
        <p><T id="settings.output_screen" /></p>
        <Screens />
      </div>
    {:else if $settingsTab === "connection"}
      <!-- TODO: connection -->
      <div>
        <p><T id="settings.device_name" /></p>
        <TextInput value={$os.name} light />
      </div>
      <div>
        <p>RemoteShow <T id="settings.port" /></p>
        <NumberInput value={5510} min={1000} max={10000} buttons={false} />
      </div>
      <div>
        <p>StageShow <T id="settings.port" /></p>
        <NumberInput value={5511} min={1000} max={10000} buttons={false} />
      </div>
      <div>
        <p><T id="settings.max_connections" /></p>
        <NumberInput value={10} />
      </div>
      <div>
        <p><T id="settings.allowed_connections" /></p>
        <span>(all, only phones, (laptops), ...)</span>
      </div>
    {:else if $settingsTab === "calendar"}
      <!-- WIP -->
      <!-- starting day -->
      <!-- date format (DD.MM.YYYY, YYYY-MM-DD) -->
      ...
    {:else if $settingsTab === "other"}
      <!-- WIP -->
      <Button style="width: 100%;" center><T id="settings.reset_settings" /></Button>
      <Button style="width: 100%;" center><T id="settings.export_all" /></Button>
    {/if}
  </div>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    margin: 0 100px;
    height: 100%;
  }

  h2,
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

  .scroll {
    overflow-y: auto;
    overflow-x: hidden;
    height: 100%;
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
  .flex span {
    display: flex;
  }

  .hoverDelete:hover {
    color: red;
    text-decoration: line-through;
  }
</style>
