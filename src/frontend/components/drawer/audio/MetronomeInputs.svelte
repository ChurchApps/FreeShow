<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { API_metronome } from "../../actions/api"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    export let values: API_metronome = {}
    export let audioOutputs: { value: string; label: string }[] = []
    export let action = false

    let dispatch = createEventDispatcher()
    function updateValue(key, value: number | undefined) {
        if (typeof value === "number") value = Number(value.toFixed(3))

        dispatch("change", { ...values, [key]: value })
    }
</script>

{#if action}
    <MaterialToggleSwitch label="audio.use_metadata_bpm" checked={values.metadataBPM} defaultValue={false} on:change={(e) => updateValue("metadataBPM", e.detail)} />
{/if}
{#if !values.metadataBPM}
    <MaterialNumberInput label="audio.tempo <span style='margin-left: 5px;opacity: 0.4;color: var(--text);'>audio.bpm</span>" value={values.tempo || 120} min={1} max={320} on:change={(e) => updateValue("tempo", e.detail)} />
{/if}
<MaterialNumberInput label="audio.beats" value={values.beats || 4} min={1} max={16} on:change={(e) => updateValue("beats", e.detail)} />
<!-- <NumberInput value={values.notesPerBeat} min={1} max={4} on:change={(e) => (values.notesPerBeat = e.detail)} /> -->
{#if !action}
    <MaterialNumberInput label="media.volume" value={Number(((values.volume || 1) * 100).toFixed(2))} min={1} max={300} step={10} on:change={(e) => updateValue("volume", e.detail / 100)} />
{/if}

{#if audioOutputs.length}
    <MaterialDropdown label="audio.custom_output" style="margin-top: 5px;" options={audioOutputs} value={values.audioOutput || ""} on:change={(e) => updateValue("audioOutput", e.detail)} allowEmpty />
{/if}
