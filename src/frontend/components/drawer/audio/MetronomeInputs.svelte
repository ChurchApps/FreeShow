<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { dictionary } from "../../../stores"
    import { getLeftParenthesis, getRightParenthesis } from "../../../utils/language"
    import type { API_metronome } from "../../actions/api"
    import T from "../../helpers/T.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"

    export let values: API_metronome = {}
    export let audioOutputs: { id: string; name: string }[] = []
    export let action = false

    let dispatch = createEventDispatcher()
    function updateValue(key, e) {
        let value = e.detail !== undefined ? Number(e.detail) : e

        if (typeof value === "number" && Math.floor(value) === value) value = Math.floor(value) // remove .0

        dispatch("change", { ...values, [key]: value })
    }

    const isChecked = (e: any) => e.target.checked
</script>

{#if action}
    <CombinedInput>
        <p><T id="audio.use_metadata_bpm" /></p>
        <span class="alignRight">
            <Checkbox checked={values.metadataBPM} on:change={(e) => updateValue("metadataBPM", isChecked(e))} />
        </span>
    </CombinedInput>
{/if}
{#if !values.metadataBPM}
    <CombinedInput>
        <p><T id="audio.tempo" /> {getLeftParenthesis()}<T id="audio.bpm" />{getRightParenthesis()}</p>
        <NumberInput value={values.tempo || 120} min={1} decimals={1} fixed={Math.floor(values.tempo || 0) === (values.tempo || 0) ? 0 : 1} max={320} on:change={(e) => updateValue("tempo", e)} />
    </CombinedInput>
{/if}
<CombinedInput>
    <p><T id="audio.beats" /></p>
    <NumberInput value={values.beats || 4} min={1} max={16} on:change={(e) => updateValue("beats", e)} />
</CombinedInput>
<!-- <NumberInput value={values.notesPerBeat} min={1} max={4} on:change={(e) => (values.notesPerBeat = e.detail)} /> -->
{#if !action}
    <CombinedInput>
        <p><T id="media.volume" /></p>
        <NumberInput value={values.volume || 1} min={0.1} max={3} decimals={1} step={0.1} inputMultiplier={100} on:change={(e) => updateValue("volume", e)} />
    </CombinedInput>
{/if}

{#if audioOutputs.length}
    <div class="input" style="margin-top: 5px;">
        <CombinedInput>
            <p data-title={$dictionary.audio?.custom_output}><T id="audio.custom_output" /></p>
            <Dropdown options={audioOutputs} value={audioOutputs.find((a) => a.id === values.audioOutput)?.name || "—"} on:click={(e) => updateValue("audioOutput", e.detail?.id)} />
        </CombinedInput>
    </div>
{/if}

<style>
    .input :global(.dropdownElem) {
        width: 50%; /* 0px / 90% works, not 100% */
    }
</style>
