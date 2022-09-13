<script lang="ts">
  import { OUTPUT } from "../../../../types/Channels"
  import { activePopup, currentOutputSettings, labelsDisabled, outputDisplay, outputs, templates } from "../../../stores"
  import { send } from "../../../utils/request"
  import Icon from "../../helpers/Icon.svelte"
  import { addOutput, defaultOutput, getActiveOutputs } from "../../helpers/output"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Checkbox from "../../inputs/Checkbox.svelte"
  import Color from "../../inputs/Color.svelte"
  import Dropdown from "../../inputs/Dropdown.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import TextInput from "../../inputs/TextInput.svelte"

  const meta: any[] = [
    { id: "never", name: "$:show_at.never:$" },
    { id: "always", name: "$:show_at.always:$" },
    { id: "first", name: "$:show_at.first:$" },
    { id: "last", name: "$:show_at.last:$" },
    { id: "first_last", name: "$:show_at.first_last:$" },
  ]

  function reset() {
    let n = currentOutput.name
    let active = currentOutput.active
    let out = currentOutput.out
    outputs.update((output) => {
      let id: string = currentOutput.id
      output[id] = JSON.parse(JSON.stringify(defaultOutput))
      output[id].name = n
      output[id].active = active
      output[id].out = out

      currentOutputSettings.set(id)
      return output
    })
  }

  let templateList: any[] = []
  $: templateList = [{ id: null, name: "—" }, ...Object.entries($templates).map(([id, template]: any) => ({ id, name: template.name }))]

  let options: any[] = []
  $: options = Object.entries($outputs)
    .map(([id, a]) => ({ id, ...a }))
    .sort((a, b) => a.name.localeCompare(b.name))

  $: if (options.length && (!$currentOutputSettings || !$outputs[$currentOutputSettings])) currentOutputSettings.set(options[0].id)

  let currentOutput: any = {}
  $: if ($currentOutputSettings) currentOutput = { id: $currentOutputSettings, ...$outputs[$currentOutputSettings] }

  $: name = currentOutput?.name || ""

  let activeLayers: any[] = []
  $: {
    if (currentOutput.show?.layers) activeLayers = currentOutput.show?.layers
    else activeLayers = ["background", "slide", "overlays"]
  }

  function updateOutput(key: string, value: any) {
    outputs.update((a: any) => {
      if (key.includes(".")) {
        let split = key.split(".")
        a[currentOutput.id][split[0]][split[1]] = value
        if (split[1] === "lines" && !Number(value)) delete a[currentOutput.id][split[0]][split[1]]
      } else {
        a[currentOutput.id][key] = value
      }
      currentOutputSettings.set(currentOutput.id)
      return a
    })
  }

  function deleteOutput() {
    if (Object.keys($outputs).length <= 1) return

    outputs.update((a) => {
      delete a[currentOutput.id]
      currentOutputSettings.set(Object.keys(a)[0])
      return a
    })
    // history({ id: "addTheme", oldData: { ...$themes[$theme] }, location: { page: "settings", theme: $theme } })
  }

  const isChecked = (e: any) => e.target.checked
  const getValue = (e: any) => e.target.value
</script>

<div style="justify-content: center;flex-direction: column;font-style: italic;opacity: 0.8;">
  <p><T id="settings.hide_output_hint" /></p>
  <!-- <p><T id="settings.show_output_hint" /></p> -->
</div>

<Dropdown style="width: 100%;" {options} value={currentOutput?.name || ""} on:click={(e) => currentOutputSettings.set(e.detail.id)} />

<div class="flex">
  <TextInput
    value={name}
    on:input={(e) => (name = getValue(e))}
    on:change={() => {
      if (name) updateOutput("name", name)
    }}
    light
  />
  <Button on:click={deleteOutput} disabled={Object.keys($outputs).length <= 1}>
    <Icon id="delete" right />
    {#if !$labelsDisabled}
      <T id="actions.delete" />
    {/if}
  </Button>

  <Button on:click={() => addOutput()}>
    <Icon id="add" right />
    {#if !$labelsDisabled}
      <T id="settings.new_output" />
    {/if}
  </Button>
</div>

<!-- main -->

{#if Object.keys($outputs).length > 1}
  <br />

  <div>
    <p><T id="settings.enabled" /></p>
    <Checkbox
      checked={currentOutput.enabled}
      on:change={(e) => {
        updateOutput("enabled", isChecked(e))
        if ($outputDisplay) {
          let enabled = getActiveOutputs($outputs, false)
          Object.entries($outputs).forEach(([id, output]) => {
            send(OUTPUT, ["DISPLAY"], { enabled: enabled.includes(id), output: { id, ...output }, one: true })
          })
        }
      }}
    />
  </div>
  <div>
    <p><T id="settings.color_when_active" /></p>
    <span style="width: 200px;">
      <Color value={currentOutput.color} on:input={(e) => updateOutput("color", getValue(e))} />
    </span>
  </div>
{/if}

<hr />

<!-- window -->
<h3><T id="settings.window" /></h3>
<!-- <div style="justify-content: center;flex-direction: column;font-style: italic;opacity: 0.8;min-height: initial;">
  <p><T id="settings.move_output_hint" /></p>
</div> -->
<div>
  <p><T id="settings.position" /></p>
  <span class="inputs">
    <p style="width: 80px;text-align: right;font-weight: bold;"><T id="edit.x" /></p>
    <NumberInput
      value={currentOutput.bounds?.x || 0}
      min={-10000}
      max={100000}
      on:change={(e) => {
        updateOutput("bounds", { ...currentOutput.bounds, x: Number(e.detail) })
        updateOutput("screen", null)
        setTimeout(() => {
          send(OUTPUT, ["UPDATE_BOUNDS"], currentOutput)
        }, 10)
      }}
      buttons={false}
      outline
    />
    <p style="width: 80px;text-align: right;font-weight: bold;"><T id="edit.y" /></p>
    <NumberInput
      value={currentOutput.bounds?.y || 0}
      min={-10000}
      max={100000}
      on:change={(e) => {
        updateOutput("bounds", { ...currentOutput.bounds, y: Number(e.detail) })
        updateOutput("screen", null)
        setTimeout(() => {
          send(OUTPUT, ["UPDATE_BOUNDS"], currentOutput)
        }, 10)
      }}
      buttons={false}
      outline
    />
  </span>
</div>
<div>
  <p><T id="edit.size" /></p>
  <span class="inputs">
    <p style="width: 80px;text-align: right;font-weight: bold;"><T id="edit.width" /></p>
    <NumberInput
      value={currentOutput.bounds?.width || 0}
      min={40}
      max={100000}
      on:change={(e) => {
        updateOutput("bounds", { ...currentOutput.bounds, width: Number(e.detail) })
        updateOutput("screen", null)
        setTimeout(() => {
          send(OUTPUT, ["UPDATE_BOUNDS"], currentOutput)
        }, 10)
      }}
      buttons={false}
      outline
    />
    <p style="width: 80px;text-align: right;font-weight: bold;"><T id="edit.height" /></p>
    <NumberInput
      value={currentOutput.bounds?.height || 0}
      min={40}
      max={100000}
      on:change={(e) => {
        updateOutput("bounds", { ...currentOutput.bounds, height: Number(e.detail) })
        updateOutput("screen", null)
        setTimeout(() => {
          send(OUTPUT, ["UPDATE_BOUNDS"], currentOutput)
        }, 10)
      }}
      buttons={false}
      outline
    />
  </span>
</div>
<div>
  <p><T id="settings.output_screen" /></p>
  <Button on:click={() => activePopup.set("choose_screen")}>
    <Icon id="screen" right />
    <p><T id="popup.choose_screen" /></p>
  </Button>
  <!-- <Screens /> -->
</div>
<!-- disable on linux -->
<!-- {#if $os.platform !== "linux"}
  <div>
    <p><T id="settings.fixed" /></p>
    <Checkbox
      checked={currentOutput.kiosk}
      on:change={(e) => {
        updateOutput("kiosk", isChecked(e))
        setTimeout(() => {
          send(OUTPUT, ["UPDATE_BOUNDS"], currentOutput)
        }, 10)
      }}
    />
  </div>
{/if} -->
<div>
  <p>Advanced</p>
  <Button on:click={() => activePopup.set("advanced_settings")}>
    <Icon id="screen" right />
    <p>Advanced settings</p>
  </Button>
</div>

<hr />

<!-- show -->
<h3><T id="preview.slide" /></h3>
<!-- TODO: use stage (dropdown) -->
<div>
  <p><T id="edit.background_color" /></p>
  <span style="width: 200px;">
    <Color value={currentOutput.show?.background || "#000000"} on:input={(e) => updateOutput("show.background", getValue(e))} />
  </span>
</div>
<!-- TODO: transparency? -->
<div>
  <p><T id="settings.resolution" /></p>
  <span class="inputs">
    <!-- defaults dropdown -->
    <!-- custom... -->
    <p style="width: 80px; text-align: right; font-weight: bold;"><T id="screen.width" /></p>
    <NumberInput
      value={currentOutput.show?.resolution?.width || 1920}
      min={100}
      max={10000}
      buttons={false}
      outline
      on:change={(e) => updateOutput("show.resolution", { width: Number(e.detail), height: currentOutput.show?.resolution?.height || 1080 })}
    />
    <p style="width: 80px; text-align: right; font-weight: bold;"><T id="screen.height" /></p>
    <NumberInput
      value={currentOutput.show?.resolution?.height || 1080}
      min={100}
      max={10000}
      buttons={false}
      outline
      on:change={(e) => updateOutput("show.resolution", { height: Number(e.detail), width: currentOutput.show?.resolution?.width || 1920 })}
    />
  </span>
</div>

<div>
  <p><T id="settings.lines" /></p>
  <NumberInput
    value={currentOutput.show?.lines || 0}
    min={0}
    max={99}
    buttons={false}
    outline
    on:change={(e) => {
      updateOutput("show.lines", e.detail)
    }}
  />
</div>
<div>
  <p><T id="settings.override_with_template" /></p>
  <Dropdown
    options={templateList}
    value={$templates[currentOutput.show?.template]?.name || "—"}
    style="width: 200px;"
    on:click={(e) => updateOutput("show.template", e.detail.id)}
  />
</div>
<div>
  <p><T id="settings.display_metadata" /></p>
  <Dropdown
    options={meta}
    value={meta.find((a) => a.id === (currentOutput.show?.displayMetadata || "never"))?.name || "—"}
    style="width: 200px;"
    on:click={(e) => updateOutput("show.displayMetadata", e.detail.id)}
  />
</div>
<div>
  <p><T id="settings.active_layers" /></p>
  <span style="display: flex;">
    <!-- active={activeLayers.includes("background")} -->
    <Button
      on:click={() => {
        if (activeLayers.includes("background")) activeLayers.splice(activeLayers.indexOf("background"), 1)
        else activeLayers = [...new Set([...activeLayers, "background"])]
        console.log(activeLayers)
        updateOutput("show.layers", activeLayers)
      }}
      style={activeLayers.includes("background") ? "border-bottom: 2px solid var(--secondary) !important;" : "border-bottom: 2px solid var(--primary-lighter);"}
      bold={false}
      center
      dark
    >
      <Icon id="background" right />
      <T id="preview.background" />
    </Button>
    <!-- active={activeLayers.includes("slide")} -->
    <Button
      on:click={() => {
        if (activeLayers.includes("slide")) activeLayers.splice(activeLayers.indexOf("slide"), 1)
        else activeLayers = [...new Set([...activeLayers, "slide"])]
        updateOutput("show.layers", activeLayers)
      }}
      style={activeLayers.includes("slide") ? "border-bottom: 2px solid var(--secondary) !important;" : "border-bottom: 2px solid var(--primary-lighter);"}
      bold={false}
      center
      dark
    >
      <Icon id="slide" right />
      <T id="preview.slide" />
    </Button>
    <!-- active={activeLayers.includes("overlays")} -->
    <Button
      on:click={() => {
        if (activeLayers.includes("overlays")) activeLayers.splice(activeLayers.indexOf("overlays"), 1)
        else activeLayers = [...new Set([...activeLayers, "overlays"])]
        updateOutput("show.layers", activeLayers)
      }}
      style={activeLayers.includes("overlays") ? "border-bottom: 2px solid var(--secondary) !important;" : "border-bottom: 2px solid var(--primary-lighter);"}
      bold={false}
      center
      dark
    >
      <Icon id="overlays" right />
      <T id="preview.overlays" />
    </Button>
  </span>
</div>
<!-- TODO: override transition ? -->

<hr />

<Button style="width: 100%;" on:click={reset} center>
  <Icon id="reset" right />
  <T id="actions.reset" />
</Button>

<style>
  div:not(.scroll) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 5px 0;
    min-height: 38px;
    /* height: 35px; */
  }

  h3 {
    text-align: center;
    font-size: 1.8em;
    margin: 20px 0;
  }
  h3 {
    font-size: initial;
  }

  .inputs {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  hr {
    margin: 20px 0;
    border: none;
    height: 2px;
    background-color: var(--primary-lighter);
  }

  .flex {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .flex :global(button) {
    white-space: nowrap;
  }

  div :global(.numberInput) {
    width: 80px;
  }
</style>
