<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import { currentOutputSettings, outputs } from "../../../stores"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { displayOutputs } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"

    let currentOutput: any = {}
    $: if ($currentOutputSettings) currentOutput = { id: $currentOutputSettings, ...$outputs[$currentOutputSettings] }

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
</script>

<div>
    <p style="margin-bottom: 10px;"><T id="settings.manual_drag_hint" /></p>
    <Button on:click={() => displayOutputs({ ctrlKey: true })} style="width: 100%;" dark center>
        <Icon id="outputs" right />
        <p><T id="context.force_outputs" /></p>
    </Button>

    <br />

    <strong><T id="settings.position" /></strong>
    <div class="input">
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
            buttons={false}
            outline
        />
    </div>
    <div class="input">
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
            buttons={false}
            outline
        />
    </div>
</div>

<br />

<div>
    <strong><T id="edit.size" /></strong>
    <div class="input">
        <p style="width: 80px;"><T id="edit.width" /></p>
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
    </div>
    <div class="input">
        <p style="width: 80px;"><T id="edit.height" /></p>
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
    </div>
</div>

<style>
    div {
        margin: 5px 0;
    }

    .input {
        display: flex;
        gap: 10px;
        align-items: center;
        justify-content: space-between;
    }

    div :global(.numberInput) {
        width: 50%;
    }
    div :global(.numberInput input) {
        background-color: var(--primary-darker);
    }
</style>
