<script lang="ts">
  import { autoOutput, defaultProjectName, displayMetadata, fullColors, groupNumbers, imageExtensions, labelsDisabled, screen, showsPath, videoExtensions } from "../../../stores"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Checkbox from "../../inputs/Checkbox.svelte"
  import Dropdown from "../../inputs/Dropdown.svelte"
  import FolderPicker from "../../inputs/FolderPicker.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import TextInput from "../../inputs/TextInput.svelte"
  import LocaleSwitcher from "../LocaleSwitcher.svelte"

  const inputs: any = {
    labels: (e: any) => labelsDisabled.set(e.target.checked),
    colors: (e: any) => fullColors.set(e.target.checked),
    autoOutput: (e: any) => autoOutput.set(e.target.checked),
    groupNumber: (e: any) => groupNumbers.set(e.target.checked),
  }

  const projectNames: any[] = ["date", "today", "sunday", "week", "custom", "blank"].map((id) => ({ name: "$:projectName.${" + id + "}:$", id }))
  const meta: any[] = [{ name: "never" }, { name: "always" }, { name: "last" }, { name: "first_last" }]

  const changeValue = (e: any, key: string) => (value[key] = e.target.value)
  let value: any = { video: "", image: "" }
</script>

<div>
  <p><T id="settings.language" /></p>
  <LocaleSwitcher />
</div>
<div>
  <p><T id="settings.disable_labels" /></p>
  <!-- style="width: 200px;" -->
  <Checkbox checked={$labelsDisabled} on:change={inputs.labels} />
</div>
<div>
  <p><T id="settings.group_numbers" /></p>
  <Checkbox checked={$groupNumbers} on:change={inputs.groupNumber} />
</div>
<div>
  <p><T id="settings.full_colors" /></p>
  <Checkbox checked={$fullColors} on:change={inputs.colors} />
</div>
<div>
  <p><T id="settings.auto_output" /></p>
  <Checkbox checked={$autoOutput} on:change={inputs.autoOutput} />
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
  <span>
    {$showsPath}
    <FolderPicker id="shows">[[[Choose another location...]]]</FolderPicker>
  </span>
</div>

<!-- project store location... -->
<style>
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
