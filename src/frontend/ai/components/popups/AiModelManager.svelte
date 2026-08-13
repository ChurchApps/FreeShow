<script lang="ts">
    import HRule from "../../../components/input/HRule.svelte"
    import MaterialDropdown from "../../../components/inputs/MaterialDropdown.svelte"
    import { ai, language } from "../../../stores"
    import NemotronOptions from "./NemotronOptions.svelte"
    import WhisperOptions from "./WhisperOptions.svelte"

    $: sttOptions = $ai.stt || {}
    $: llmOptions = $ai.llm || {}

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
        { value: "whisper", label: "Whisper", data: "Transcribes in short blocks. Supports many languages and live interpretation, but a spoken phrase is only recognised once its block finishes." },
        // only show if any English language is selected, as this only supports English:
        ...($language?.includes("en") || $ai.stt?.engine === "nemotron" ? [{ value: "nemotron", label: "Nemotron", data: "Transcribes as you speak, so references and voice commands are picked up almost immediately. English only." }] : [])
    ]
    $: selectedSttEngine = sttOptions.engine || sttEngines[0].value
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
<HRule title="LLM" />

{#if llmOptions.provider === "ollama"}
    <!-- <LocalApiOptions /> -->
{:else}
    <!-- <RemoteApiOptions /> -->
{/if}

<!-- Download manager -->
<!-- TODO: a downloaded manager where the user can see the file sizes/loocations of downloaded engines/models and delete them -->
