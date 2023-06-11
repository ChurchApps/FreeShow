<script lang="ts">
    import { uid } from "uid"
    import { OUTPUT } from "../../../../types/Channels"
    import { activePopup, currentOutputSettings, labelsDisabled, outputDisplay, outputs, styles } from "../../../stores"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import { addOutput, defaultOutput, deleteOutput, getActiveOutputs, keyOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Color from "../../inputs/Color.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"

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
        .filter((a) => !a.isKeyOutput)
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

                // update key output style
                if (["style", "enabled", "alwaysOnTop"].includes(key) && a[currentOutput.id].keyOutput) {
                    a[a[currentOutput.id].keyOutput][key] = value
                }
            }

            if (key === "alwaysOnTop") {
                send(OUTPUT, ["SET_VALUE"], { id: $currentOutputSettings, key, value })

                // update key output
                if (a[currentOutput.id].keyOutput) {
                    send(OUTPUT, ["SET_VALUE"], { id: a[currentOutput.id].keyOutput, key, value })
                }
            }

            currentOutputSettings.set(currentOutput.id)
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

<div class="info">
    <p><T id="settings.hide_output_hint" /></p>
    <!-- <p><T id="settings.show_output_hint" /></p> -->
</div>

<CombinedInput>
    <Dropdown style="width: 100%;" {options} value={currentOutput?.name || ""} on:click={(e) => currentOutputSettings.set(e.detail.id)} />
</CombinedInput>

<CombinedInput>
    <TextInput
        value={name}
        on:input={(e) => (name = getValue(e))}
        on:change={() => {
            if (name) updateOutput("name", name)
        }}
        light
    />
    <Button on:click={() => deleteOutput(currentOutput.id)} disabled={options.length <= 1}>
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
</CombinedInput>

<!-- main -->

<br />

{#if options.length > 1}
    <CombinedInput>
        <p><T id="settings.enabled" /></p>
        <div class="alignRight">
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
    </CombinedInput>
{/if}

<CombinedInput>
    <p><T id="settings.color_when_active" /></p>
    <span style="width: 200px;">
        <Color value={currentOutput.color} on:input={(e) => updateOutput("color", getValue(e))} />
    </span>
</CombinedInput>

<CombinedInput>
    <p><T id="settings.active_style" /></p>
    <Dropdown options={stylesList} value={$styles[currentOutput.style]?.name || "—"} style="width: 200px;" on:click={(e) => updateOutput("style", e.detail.id)} />
</CombinedInput>

<CombinedInput>
    <p><T id="settings.always_on_top" /></p>
    <div class="alignRight">
        <Checkbox checked={currentOutput.alwaysOnTop !== false} on:change={(e) => updateOutput("alwaysOnTop", isChecked(e))} />
    </div>
</CombinedInput>

<CombinedInput>
    <p><T id="settings.enable_key_output" /></p>
    <div class="alignRight">
        <Checkbox
            checked={!!currentOutput.keyOutput}
            on:change={(e) => {
                let outputId = isChecked(e) ? "key_" + uid(5) : currentOutput.keyOutput
                let keyValue = isChecked(e) ? outputId : null
                updateOutput("keyOutput", keyValue)
                keyOutput(outputId, !isChecked(e))
            }}
        />
    </div>
</CombinedInput>

<!-- window -->
<h3><T id="settings.window" /></h3>
<!-- <div style="justify-content: center;flex-direction: column;font-style: italic;opacity: 0.8;min-height: initial;">
  <p><T id="settings.move_output_hint" /></p>
</div> -->
<CombinedInput>
    <p><T id="settings.output_screen" /></p>
    <Button on:click={() => activePopup.set("choose_screen")}>
        <Icon id="screen" right />
        <p><T id="popup.choose_screen" /></p>
    </Button>
    <!-- <Screens /> -->
</CombinedInput>
<CombinedInput>
    <p><T id="settings.position" /></p>
    <Button on:click={() => activePopup.set("change_output_values")}>
        <Icon id="screen" right />
        <p><T id="popup.change_output_values" /></p>
    </Button>
</CombinedInput>
<!-- disable on linux -->
<!-- {#if $os.platform !== "linux"}
  <div>
    <p><T id="settings.fixed" /></p>
    <div class="alignRight">
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
  </div>
{/if} -->
<CombinedInput>
    <p>Advanced</p>
    <Button on:click={() => activePopup.set("advanced_settings")}>
        <Icon id="screen" right />
        <p>Advanced settings</p>
    </Button>
</CombinedInput>

<br />

<Button style="width: 100%;" on:click={reset} center>
    <Icon id="reset" right />
    <T id="actions.reset" />
</Button>

<br />

<style>
    .info {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        min-height: 38px;
        margin: 5px 0;
        font-style: italic;
        opacity: 0.8;
    }

    .info p {
        white-space: initial;
    }

    h3 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }
</style>
