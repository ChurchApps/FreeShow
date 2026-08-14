<script lang="ts">
    import AiScriptureSettings from "../../../components/ai/AiScriptureSettings.svelte"
    import MaterialToggleSwitch from "../../../components/inputs/MaterialToggleSwitch.svelte"
    import { ai } from "../../../stores"
    import STTOptions from "./STTOptions.svelte"

    $: isEnabled = $ai.enabled

    function updateValue(key: string, value: any) {
        ai.update((a) => {
            a[key] = value
            return a
        })
    }
</script>

<MaterialToggleSwitch label="ai.enable" checked={isEnabled} on:change={(e) => updateValue("enabled", e.detail)} />

{#if isEnabled}
    <STTOptions />

    <br />
    <br />

    <AiScriptureSettings />
{/if}
