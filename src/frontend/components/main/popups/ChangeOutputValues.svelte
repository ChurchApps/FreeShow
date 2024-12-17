<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import { currentOutputSettings, outputs, dictionary, activePopup } from "../../../stores"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { displayOutputs } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"

    let currentOutput: any = {}
    $: if ($currentOutputSettings) getCurrentOutput($currentOutputSettings)
    function getCurrentOutput(id: string) {
        currentOutput = { id, ...$outputs[id] }
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

            return a
        })

        getCurrentOutput(currentOutput.id)
    }

    const isChecked = (e: any) => e.target.checked
</script>

<Button style="position: absolute;left: 0;top: 0;min-height: 58px;" title={$dictionary.actions?.back} on:click={() => activePopup.set("choose_screen")}>
    <Icon id="back" size={2} white />
</Button>

<div>
    <p style="margin-bottom: 10px;"><T id="settings.manual_drag_hint" /></p>

    <CombinedInput>
        <!-- This also makes the output never "auto position" itself if there is just 1 output and 1 extra screen -->
        <p style="flex: 2;"><T id="settings.allow_main_screen" /></p>
        <div class="alignRight">
            <Checkbox checked={currentOutput.allowMainScreen === true} on:change={(e) => updateOutput("allowMainScreen", isChecked(e))} />
        </div>
    </CombinedInput>
    <Button disabled={currentOutput.allowMainScreen} on:click={() => displayOutputs({ ctrlKey: true })} style="width: 100%;" dark center>
        <Icon id="outputs" right />
        <p><T id="context.force_outputs" /></p>
    </Button>

    {#if currentOutput.keyOutput}
        <Button on:click={() => getCurrentOutput(currentOutput.keyOutput)} style="width: 100%;" dark center>
            <Icon id="display" right />
            <p><T id="settings.change_key_output_position" /></p>
        </Button>
    {/if}

    <h3><T id="settings.position" /></h3>
    <CombinedInput>
        <p style="width: 80px;"><T id="edit.x" /></p>
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
            style="background-color: var(--primary-darker);"
            outline
        />
    </CombinedInput>
    <CombinedInput>
        <p style="width: 80px;"><T id="edit.y" /></p>
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
            style="background-color: var(--primary-darker);"
            outline
        />
    </CombinedInput>
</div>

<div>
    <h3><T id="edit.size" /></h3>
    <CombinedInput>
        <p style="width: 80px;"><T id="edit.width" /></p>
        <NumberInput
            disabled={currentOutput.forcedResolution}
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
            style="background-color: var(--primary-darker);"
            outline
        />
    </CombinedInput>
    <CombinedInput>
        <p style="width: 80px;"><T id="edit.height" /></p>
        <NumberInput
            disabled={currentOutput.forcedResolution}
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
            style="background-color: var(--primary-darker);"
            outline
        />
    </CombinedInput>
</div>

<style>
    h3 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }
</style>
