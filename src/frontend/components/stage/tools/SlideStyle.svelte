<script lang="ts">
    import { uid } from "uid"
    import { OUTPUT } from "../../../../types/Channels"
    import { activeStage, outputs, stageShows } from "../../../stores"
    import { send } from "../../../utils/request"
    import T from "../../helpers/T.svelte"
    import { keysToID } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getActiveOutputs } from "../../helpers/output"
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

        if (!$activeStage.id) return

        // add / remove physical stage output
        if (key === "outputScreen") {
            let outputIds = getActiveOutputs()
            let bounds = $outputs[outputIds[0]]?.bounds || { x: 0, y: 0, width: 100, height: 100 }

            outputs.update((a) => {
                if (value) {
                    let id = uid()
                    a[id] = {
                        enabled: true,
                        active: true,
                        stageOutput: $activeStage.id!,
                        name: currentStage.name,
                        color: "#555555",
                        bounds,
                        screen: null,
                    }

                    // , rate: $special.previewRate || "auto"
                    send(OUTPUT, ["CREATE"], { ...a[id], id })
                } else {
                    // WIP: remove alpha key outputs...
                    let outputWithStageId = keysToID(a).find((output) => output.stageOutput === $activeStage.id)?.id
                    if (outputWithStageId) delete a[outputWithStageId]

                    send(OUTPUT, ["REMOVE"], { id: outputWithStageId })
                }

                return a
            })
        }
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
    $: outputList = Object.entries($outputs)
        .map(([id, a]) => ({ id, ...a }))
        .filter((a) => !a.isKeyOutput && !a.stageOutput)
        .sort((a, b) => a.name.localeCompare(b.name))
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
    <CombinedInput>
        <p><T id="settings.output_screen" /></p>
        <div class="alignRight">
            <Checkbox checked={settings.outputScreen} on:change={(e) => toggleValue(e, "outputScreen")} />
        </div>
    </CombinedInput>

    <h6><T id="edit.style" /></h6>
    <CombinedInput>
        <p><T id="edit.background_color" /></p>
        <Color value={settings.color || defaultSettings.color} on:input={(e) => updateStageSettings(e.detail, "color")} />
    </CombinedInput>
    <CombinedInput>
        <p><T id="stage.auto_stretch" /></p>
        <div class="alignRight">
            <Checkbox checked={settings.autoStretch ?? true} on:change={(e) => toggleValue(e, "autoStretch")} />
        </div>
    </CombinedInput>
    <CombinedInput>
        <p><T id="stage.labels" /></p>
        <div class="alignRight">
            <Checkbox checked={settings.labels ?? false} on:change={(e) => toggleValue(e, "labels")} />
        </div>
    </CombinedInput>

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
