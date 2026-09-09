<script lang="ts">
    import Icon from "../../../components/helpers/Icon.svelte"
    import T from "../../../components/helpers/T.svelte"
    import HRule from "../../../components/input/HRule.svelte"
    import Link from "../../../components/inputs/Link.svelte"
    import MaterialButton from "../../../components/inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../../components/inputs/MaterialDropdown.svelte"
    import { ai, popupData } from "../../../stores"
    import { resolveSttEngine } from "../../stt/stt"
    import LlmFiles from "./LlmFiles.svelte"
    import LlmOptions from "./LlmOptions.svelte"
    import NemotronOptions from "./NemotronOptions.svelte"

    const mode = $popupData.mode
    popupData.set({})

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
        { value: "nemotron", label: "Nemotron", data: "Transcribes as you speak, so references are picked up almost immediately. Supports around 40 languages." }
        // other models in the future?
    ]
    $: selectedSttEngine = sttOptions.engine || resolveSttEngine()

    let showMore = false
</script>

{#if !mode}
    <MaterialButton class="popup-options {showMore ? 'active' : ''}" icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} on:click={() => (showMore = !showMore)} white />

    <div style="display: flex;justify-content: center;font-size: 0.9em;">
        <Link url="https://freeshow.app/docs/smart">
            <T id="main.docs" />
            <Icon id="launch" white />
        </Link>
    </div>
{/if}

{#if !mode || mode === "transcription"}
    {#if !mode}
        <!-- Speech to text -->
        <HRule title="ai.transcription" />
    {/if}

    <MaterialDropdown label="ai.engine" options={sttEngines} value={selectedSttEngine} on:change={(e) => updateValue("stt.engine", e.detail)} />

    {#if selectedSttEngine === "nemotron"}
        <NemotronOptions />
    {/if}
{/if}

{#if !mode || mode === "llm"}
    {#if !mode}
        <!-- LLM -->
        <HRule title="LLM" />
    {/if}

    <LlmOptions />
{/if}

{#if showMore}
    <!-- Download manager -->
    <HRule title="settings.files" />

    <LlmFiles />
{/if}
