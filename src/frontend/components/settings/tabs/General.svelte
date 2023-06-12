<script lang="ts">
    import { alertUpdates, autoOutput, labelsDisabled, timeFormat } from "../../../stores"
    import { setLanguage } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import LocaleSwitcher from "../LocaleSwitcher.svelte"

    const inputs: any = {
        timeFormat: (e: any) => timeFormat.set(e.target.checked ? "24" : "12"),
        updates: (e: any) => alertUpdates.set(e.target.checked),
        labels: (e: any) => labelsDisabled.set(e.target.checked),
        autoOutput: (e: any) => autoOutput.set(e.target.checked),
    }

    // const projectNames: any[] = ["date", "today", "sunday", "week", "custom", "blank"].map((id) => ({ name: "$:projectName.${" + id + "}:$", id }))

    function reset() {
        setLanguage(null)
        timeFormat.set("24")
        alertUpdates.set(true)
        autoOutput.set(false)
        labelsDisabled.set(false)
    }
</script>

<CombinedInput>
    <p><T id="settings.language" /></p>
    <LocaleSwitcher />
</CombinedInput>
<CombinedInput>
    <p><T id="settings.use24hClock" /></p>
    <div class="alignRight">
        <Checkbox checked={$timeFormat === "24"} on:change={inputs.timeFormat} />
    </div>
</CombinedInput>
<CombinedInput>
    <p><T id="settings.alert_updates" /></p>
    <div class="alignRight">
        <Checkbox checked={$alertUpdates} on:change={inputs.updates} />
    </div>
</CombinedInput>
<CombinedInput>
    <p><T id="settings.auto_output" /></p>
    <div class="alignRight">
        <Checkbox checked={$autoOutput} on:change={inputs.autoOutput} />
    </div>
</CombinedInput>
<CombinedInput>
    <p><T id="settings.disable_labels" /></p>
    <div class="alignRight">
        <Checkbox checked={$labelsDisabled} on:change={inputs.labels} />
    </div>
</CombinedInput>

<!-- <hr /> -->
<!-- <div>
  <p><T id="settings.default_project_name" /></p>
  <Dropdown
    options={projectNames}
    value={$defaultProjectName}
    on:click={(e) => {
      // history?
      defaultProjectName.set(e.detail.id)
    }}
  />
</div> -->

<!-- TODO: video / image extensions -->
<!-- <div>
  <p><T id="settings.video_extensions" /></p>
  <span class="flex">
    <span style="text-transform: uppercase;margin-right: 10px;">
      {#each $videoExtensions as extension, i}
        {#if i > 0},&nbsp;{/if}<span class="hoverDelete" on:click={() => videoExtensions.set($videoExtensions.filter((a) => a !== extension))}>{extension}</span>
      {/each}
    </span>
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
    <span style="text-transform: uppercase;margin-right: 10px;">
      {#each $imageExtensions as extension, i}
        {#if i > 0},&nbsp;{/if}<span class="hoverDelete" on:click={() => imageExtensions.set($imageExtensions.filter((a) => a !== extension))}>{extension}</span>
      {/each}
    </span>
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
</div> -->

<br />

<!-- <Button style="width: 100%;" center><T id="settings.export_settings" /></Button> -->
<!-- <Button style="width: 100%;" center><T id="settings.import_all" /></Button>
<Button style="width: 100%;" center><T id="settings.export_all" /></Button> -->
<Button style="width: 100%;" on:click={reset} center>
    <Icon id="reset" right />
    <T id="actions.reset" />
</Button>

<!-- project store location... -->

<br />
