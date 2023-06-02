<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import { activePopup, currentOutputSettings, labelsDisabled, outputDisplay, outputs, styles } from "../../../stores"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import { addOutput, defaultOutput, getActiveOutputs } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Color from "../../inputs/Color.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

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

    let options: any[] = []
    $: options = Object.entries($outputs)
        .map(([id, a]) => ({ id, ...a }))
        .sort((a, b) => a.name.localeCompare(b.name))

    $: if (options.length && (!$currentOutputSettings || !$outputs[$currentOutputSettings])) currentOutputSettings.set(options[0].id)

    let currentOutput: any = {}
    $: if ($currentOutputSettings) currentOutput = { id: $currentOutputSettings, ...$outputs[$currentOutputSettings] }

    $: name = currentOutput?.name || ""

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
    }

    const isChecked = (e: any) => e.target.checked
    const getValue = (e: any) => e.target.value

    // styles
    $: stylesList = getList($styles)
    function getList(styles) {
        let list = Object.entries(styles).map(([id, obj]: any) => {
            return { ...obj, id }
        })

        let sortedList = list.sort((a, b) => a.name.localeCompare(b.name))

        return [{ id: null, name: "—" }, ...sortedList]
    }
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

<br />
{#if Object.keys($outputs).length > 1}
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
{/if}
<div>
    <p><T id="settings.color_when_active" /></p>
    <span style="width: 200px;">
        <Color value={currentOutput.color} on:input={(e) => updateOutput("color", getValue(e))} />
    </span>
</div>

<div>
    <p><T id="settings.active_style" /></p>
    <Dropdown options={stylesList} value={$styles[currentOutput.style]?.name || "—"} style="width: 200px;" on:click={(e) => updateOutput("style", e.detail.id)} />
</div>

<hr />

<!-- window -->
<h3><T id="settings.window" /></h3>
<!-- <div style="justify-content: center;flex-direction: column;font-style: italic;opacity: 0.8;min-height: initial;">
  <p><T id="settings.move_output_hint" /></p>
</div> -->
<div>
    <p><T id="settings.output_screen" /></p>
    <Button on:click={() => activePopup.set("choose_screen")}>
        <Icon id="screen" right />
        <p><T id="popup.choose_screen" /></p>
    </Button>
    <!-- <Screens /> -->
</div>
<div>
    <p><T id="settings.position" /></p>
    <Button on:click={() => activePopup.set("change_output_values")}>
        <Icon id="screen" right />
        <p><T id="popup.change_output_values" /></p>
    </Button>
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
