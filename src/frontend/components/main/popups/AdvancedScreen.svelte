<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import type { Output } from "../../../../types/Output"

    import { currentOutputSettings, outputs } from "../../../stores"
    import { send } from "../../../utils/request"
    import Checkbox from "../../inputs/Checkbox.svelte"

    let currentOutput: (Output & { id: string }) | null = null
    $: if ($currentOutputSettings) currentOutput = { id: $currentOutputSettings, ...$outputs[$currentOutputSettings] }

    function updateOutput(key: string, value: any) {
        if (!currentOutput) return

        outputs.update((a: any) => {
            a[currentOutput!.id][key] = value
            // currentOutputSettings.set(currentOutput.id)
            return a
        })
    }

    const toggleList: string[] = ["Maximize", "Minimize", "Fullscreen", "Kiosk", "Hide", "Disabled", "Menubar", "Workspaces", "AlwaysOnTop", "AlwaysOnTop2"]
</script>

<main>
    <p>These settings are temporary for testing</p>
    <br />
    {#each toggleList as toggle}
        <div>
            <p>{toggle}</p>
            <Checkbox
                checked={currentOutput?.[toggle.toLowerCase()]}
                on:change={() => {
                    updateOutput(toggle.toLowerCase(), !currentOutput?.[toggle.toLowerCase()])
                    setTimeout(() => {
                        send(OUTPUT, ["TOGGLE_VALUE"], { id: $currentOutputSettings, key: toggle.toLowerCase() })
                    }, 10)
                }}
            />
        </div>
    {/each}
</main>

<style>
    div {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 5px 0;
    }
</style>
