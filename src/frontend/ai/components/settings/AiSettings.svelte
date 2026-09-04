<script lang="ts">
    import Title from "../../../components/input/Title.svelte"
    import MaterialDropdown from "../../../components/inputs/MaterialDropdown.svelte"
    import MaterialToggleSwitch from "../../../components/inputs/MaterialToggleSwitch.svelte"
    import Tip from "../../../components/main/Tip.svelte"
    import { ai } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import AiScriptureSettings from "./AiScriptureSettings.svelte"
    import STTOptions from "./STTOptions.svelte"

    $: isEnabled = $ai.enabled

    function updateValue(key: string, value: any) {
        ai.update((a) => {
            a[key] = value
            return a
        })
    }

    // scripture

    $: settings = $ai.scripture || {}

    function updateScripture(key: string, value: any) {
        ai.update((a) => {
            if (!a.scripture) a.scripture = {}
            a.scripture[key] = value
            return a
        })
    }

    const confidenceOptions = [
        { value: "ask", label: "ai.confidence_ask" },
        { value: "highest", label: "ai.confidence_highest", data: "> 95%" },
        { value: "high", label: "ai.confidence_high", data: "> 75%" },
        { value: "medium", label: "ai.confidence_medium", data: "> 50%" }
    ]
</script>

<MaterialToggleSwitch label={translateText("actions.enable_specific", null, ["settings.ai"])} checked={isEnabled} on:change={(e) => updateValue("enabled", e.detail)} />

{#if isEnabled}
    <STTOptions />

    <Title label="tabs.scripture" icon="scripture" />

    <MaterialDropdown label="Auto present" options={confidenceOptions} value={settings.confidence || "ask"} on:change={(e) => updateScripture("confidence", e.detail)} />

    <!-- TODO: auto lyrics & more -->

    <br />
    <br />

    <!-- WIP this is being deprecated: -->
    <AiScriptureSettings />
{:else}
    <Tip type="info" value="ai.hint" top={20} />
    <Tip type="warning" value="ai.privacy_details" top={10} />
{/if}
