<script lang="ts">
    import MaterialToggleSwitch from "../../../components/inputs/MaterialToggleSwitch.svelte"
    import T from "../../../components/helpers/T.svelte"
    import { setAiEnabled } from "../../aiState"
    import { ai } from "../../../stores"
    import STTOptions from "./STTOptions.svelte"

    $: isEnabled = $ai.enabled
</script>

<MaterialToggleSwitch label="ai.enable" checked={isEnabled} on:change={(e) => setAiEnabled(!!e.detail)} />

{#if isEnabled}
    <STTOptions />

    <!-- feature-specific AI settings live with their feature -->
    <p style="opacity: 0.6; font-size: 0.85em; white-space: initial; padding-top: 15px;"><T id="ai.scripture_settings_moved" /></p>
{/if}
