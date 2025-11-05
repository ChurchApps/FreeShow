<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import type { Output } from "../../../../types/Output"
    import { activePopup, currentOutputSettings, outputs, special } from "../../../stores"
    import { send } from "../../../utils/request"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    let currentOutput: (Output & { id: string }) | null = null
    $: if ($currentOutputSettings) getCurrentOutput($currentOutputSettings)
    function getCurrentOutput(id: string) {
        currentOutput = { id, ...$outputs[id] }
    }

    function updateOutput(key: string, value: any) {
        if (!currentOutput) return

        outputs.update((a) => {
            if (key.includes(".")) {
                let split = key.split(".")
                a[currentOutput!.id][split[0]][split[1]] = value
                if (split[1] === "lines" && !Number(value)) delete a[currentOutput!.id][split[0]][split[1]]
            } else {
                a[currentOutput!.id][key] = value
            }

            return a
        })

        getCurrentOutput(currentOutput.id)
    }

    function updateBounds(type: "x" | "y" | "width" | "height", value: number) {
        updateOutput("bounds", { ...currentOutput?.bounds, [type]: value })
        updateOutput("screen", null)
        setTimeout(() => send(OUTPUT, ["UPDATE_BOUNDS"], currentOutput), 10)
    }
</script>

{#if !currentOutput?.invisible}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => activePopup.set("choose_screen")} />
{/if}

<div style="min-width: 650px;">
    {#if !currentOutput?.invisible}
        {#if !$special.hideCursor}
            <p class="tip"><T id="settings.manual_drag_hint" /></p>
        {/if}

        <!-- This also makes the output never "auto position" itself if there is just 1 output and 1 extra screen -->
        <MaterialToggleSwitch label="settings.allow_main_screen" checked={currentOutput?.allowMainScreen} defaultValue={false} on:change={(e) => updateOutput("allowMainScreen", e.detail)} />
    {/if}
</div>

{#if currentOutput?.allowMainScreen === true || currentOutput?.invisible}
    {#if !currentOutput?.invisible}
        <HRule title="settings.position" />

        <InputRow>
            <MaterialNumberInput label="edit.x (px)" value={currentOutput?.bounds?.x || 0} min={-10000} on:change={(e) => updateBounds("x", e.detail)} />
            <MaterialNumberInput label="edit.y (px)" value={currentOutput?.bounds?.y || 0} min={-10000} on:change={(e) => updateBounds("y", e.detail)} />
        </InputRow>
    {/if}

    <HRule title="edit.size" />

    <InputRow>
        <MaterialNumberInput label="edit.width (px)" disabled={!!currentOutput?.forcedResolution} value={currentOutput?.bounds?.width || 0} min={40} on:change={(e) => updateBounds("width", e.detail)} />
        <MaterialNumberInput label="edit.height (px)" disabled={!!currentOutput?.forcedResolution} value={currentOutput?.bounds?.height || 0} min={40} on:change={(e) => updateBounds("height", e.detail)} />
    </InputRow>
{/if}

<!-- {#if !currentOutput?.invisible}
    <Button on:click={() => toggleOutputs(null, { force: true })} style="width: 100%;margin-top: 10px;" dark center>
        <Icon id="outputs" right />
        <p><T id="context.force_outputs" /></p>
    </Button>
{/if} -->

<style>
    .tip {
        margin-bottom: 10px;

        opacity: 0.7;
        font-size: 0.8em;
    }
</style>
