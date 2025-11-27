<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { API_metronome } from "../../actions/api"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    export let values: API_metronome = {}
    export let action = false

    let dispatch = createEventDispatcher()
    function updateValue(key, value: number | undefined) {
        if (typeof value === "number") value = Number(value.toFixed(3))

        dispatch("change", { ...values, [key]: value })
    }
</script>

{#if action}
    <MaterialToggleSwitch label="audio.use_metadata_bpm" checked={values.metadataBPM} defaultValue={false} on:change={e => updateValue("metadataBPM", e.detail)} />
{/if}
<InputRow>
    {#if !values.metadataBPM}
        <MaterialNumberInput label="audio.tempo <span style='margin-left: 5px;opacity: 0.4;font-size: 0.8em;color: var(--text);'>audio.bpm</span>" value={values.tempo || 120} min={1} max={320} on:change={e => updateValue("tempo", e.detail)} />
    {/if}
    <MaterialNumberInput label="audio.beats" value={values.beats || 4} min={1} max={16} on:change={e => updateValue("beats", e.detail)} />
    <!-- <NumberInput value={values.notesPerBeat} min={1} max={4} on:change={(e) => (values.notesPerBeat = e.detail)} /> -->
</InputRow>
