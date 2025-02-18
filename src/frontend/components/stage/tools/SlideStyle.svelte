<script lang="ts">
    import { activeStage, outputs, stageShows } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"

    $: currentStage = $stageShows[$activeStage.id || ""]
    $: settings = currentStage.settings

    function updateStageSettings(e: any, key: string) {
        let value = e.target?.value || e
        if (value === settings[key]) return

        history({ id: "UPDATE", newData: { data: value, key: "settings", subkey: key }, oldData: { id: $activeStage.id }, location: { page: "stage", id: "stage" } })
    }

    function toggleValue(e: any, key: string) {
        let value = e.target.checked
        updateStageSettings(value, key)
    }

    // VALUES

    const defaultSettings = {
        output: "—",
        background: false,
        color: "#000000",
        resolution: false,
        size: { width: 10, height: 20 },
        labels: false,
        showLabelIfEmptySlide: true,
    }

    // resolution ?
    // show labels
    // flash on update
    // stage notes/message
    // password

    let outputList: any[] = []
    $: outputList = sortByName(keysToID($outputs).filter((a) => !a.isKeyOutput && !a.stageOutput))
</script>

<div class="section">
    <CombinedInput>
        <p><T id="stage.source_output" /></p>
        <Dropdown
            style="width: 100%;"
            options={[{ id: "", name: "—" }, ...outputList]}
            value={$outputs[settings.output || ""] ? $outputs[settings.output || ""].name : defaultSettings.output}
            on:click={(e) => updateStageSettings(e.detail.id, "output")}
        />
    </CombinedInput>

    <h6><T id="edit.style" /></h6>
    <CombinedInput>
        <p><T id="edit.background_color" /></p>
        <Color value={settings.color || defaultSettings.color} on:input={(e) => updateStageSettings(e.detail, "color")} />
    </CombinedInput>
    <!-- probably not needed -->
    <!-- <CombinedInput>
        <p><T id="stage.auto_stretch" /></p>
        <div class="alignRight">
            <Checkbox checked={settings.autoStretch ?? true} on:change={(e) => toggleValue(e, "autoStretch")} />
        </div>
    </CombinedInput> -->

    <CombinedInput>
        <p><T id="stage.labels" /></p>
        <div class="alignRight">
            <Checkbox checked={settings.labels ?? false} on:change={(e) => toggleValue(e, "labels")} />
        </div>
    </CombinedInput>
    {#if settings.labels}
        <CombinedInput>
            <p><T id="stage.label_color" /></p>
            <Color value={settings.labelColor || "#ac9c35"} on:input={(e) => updateStageSettings(e.detail, "labelColor")} />
        </CombinedInput>
    {/if}

    <!-- <h6><T id="settings.resolution" /></h6>
  <CombinedInput>
      <p><T id="edit.width" /></p>
      <NumberInput
          value={settings.resolution.width}
          max={100000}
          on:change={(e) => {
              settings.resolution.width = Number(e.detail)
              update()
          }}
      />
  </CombinedInput>
  <CombinedInput>
      <p><T id="edit.height" /></p>
      <NumberInput
          value={settings.resolution.height}
          max={100000}
          on:change={(e) => {
              settings.resolution.height = Number(e.detail)
              update()
          }}
      />
  </CombinedInput>

  <h6><T id="tools.notes" /></h6>
  <div class="notes">
      <Notes value={note} on:edit={edit} />
  </div> -->
</div>

<!-- <EditValues edits={textEdits} styles={data} {item} on:change={updateStyle} /> -->

<style>
    .section {
        display: flex;
        flex-direction: column;
        margin: 10px;
        margin-bottom: 40px;
    }

    h6 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }

    p {
        opacity: 0.8;
        font-size: 0.9em;
    }

    /* .notes :global(div) {
        display: block !important;
    }

    .notes :global(div.paper) {
        position: relative;
        display: block;
        background: var(--primary-darker);
    } */
</style>
