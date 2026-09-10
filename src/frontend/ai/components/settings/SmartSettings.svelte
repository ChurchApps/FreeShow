<script lang="ts">
    import MaterialToggleSwitch from "../../../components/inputs/MaterialToggleSwitch.svelte"
    import Tip from "../../../components/main/Tip.svelte"
    import { activePopup, ai, popupData, sttTempDisabled } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import AutoScriptureOptions from "./AutoScriptureOptions.svelte"
    import STTOptions from "./STTOptions.svelte"

    $: isEnabled = $ai.enabled

    function updateValue(key: string, value: any) {
        ai.update((a) => {
            a[key] = value
            return a
        })

        if (key === "enabled" && value) {
            sttTempDisabled.set(false)
            popupData.set({ mode: "setup" })
            activePopup.set("ai_model_manager")
        }
    }
</script>

<div class="experimental">EXPERIMENTAL!</div>

<MaterialToggleSwitch label={translateText("actions.enable_specific", null, ["settings.ai"])} checked={isEnabled} on:change={(e) => updateValue("enabled", e.detail)} />

{#if isEnabled}
    <STTOptions />

    <AutoScriptureOptions />

    <!-- TODO: auto lyrics & more -->
{:else}
    <Tip type="info" value="ai.hint" top={20} />
    <Tip type="warning" value="ai.privacy_details" top={10} />
{/if}

<style>
    .experimental {
        color: red;
        text-align: center;
        font-weight: bold;
        margin-bottom: 20px;
    }
</style>
