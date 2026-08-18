<script lang="ts">
    import HRule from "../../../components/input/HRule.svelte"
    import MaterialDropdown from "../../../components/inputs/MaterialDropdown.svelte"
    import { ai, language } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { resolveSttEngine } from "../../stt/stt"
    import LlmOptions from "./LlmOptions.svelte"
    import NemotronOptions from "./NemotronOptions.svelte"
    import WhisperOptions from "./WhisperOptions.svelte"

    $: sttOptions = $ai.stt || {}

    function updateValue(key: string, value: any) {
        ai.update((a) => {
            const keys = key.toString().split(".")
            if (keys.length === 1) {
                a[key] = value
                return a
            }

            if (!a[keys[0]]) a[keys[0]] = {}
            a[keys[0]][keys[1]] = value

            return a
        })
    }

    const sttEngines = [
        // only show if any English language is selected, as this only supports English:
        ...($language?.includes("en") || $ai.stt?.engine === "nemotron" ? [{ value: "nemotron", label: "Nemotron", data: translateText("ai.engine_nemotron_hint") }] : []),
        { value: "whisper", label: "Whisper", data: translateText("ai.engine_whisper_hint") }
    ]
    $: selectedSttEngine = sttOptions.engine || resolveSttEngine()
</script>

<!-- Speech to text -->
<HRule title="ai.transcription" style="margin-top: 0;" />

<MaterialDropdown label="ai.engine" options={sttEngines} value={selectedSttEngine} on:change={(e) => updateValue("stt.engine", e.detail)} />

{#if selectedSttEngine === "whisper"}
    <WhisperOptions />
{:else if selectedSttEngine === "nemotron"}
    <NemotronOptions />
{/if}

<!-- LLM -->
<HRule title="ai.llm" />

<LlmOptions />

<!-- Download manager -->
<!-- TODO: a downloaded manager where the user can see the file sizes/loocations of downloaded engines/models and delete them -->
