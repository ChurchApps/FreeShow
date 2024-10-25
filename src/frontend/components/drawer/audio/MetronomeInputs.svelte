<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import T from "../../helpers/T.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import type { API_metronome } from "../../actions/api"
    import { getLeftParenthesis, getRightParenthesis } from "../../../utils/language"

    export let values: API_metronome = {}
    export let volume: boolean = true

    let dispatch = createEventDispatcher()
    function updateValue(key, e) {
        let value = Number(e.detail)
        console.log(value, Math.floor(value), Math.floor(values.tempo || 0) === (values.tempo || 0))

        if (Math.floor(value) === value) value = Math.floor(value) // remove .0
        console.log(value)

        dispatch("change", { ...values, [key]: value })
    }
</script>

<CombinedInput>
    <p><T id="audio.tempo" /> {getLeftParenthesis()}<T id="audio.bpm" />{getRightParenthesis()}</p>
    <NumberInput value={values.tempo || 120} min={1} decimals={1} fixed={Math.floor(values.tempo || 0) === (values.tempo || 0) ? 0 : 1} max={320} on:change={(e) => updateValue("tempo", e)} />
</CombinedInput>
<CombinedInput>
    <p><T id="audio.beats" /></p>
    <NumberInput value={values.beats || 4} min={1} max={16} on:change={(e) => updateValue("beats", e)} />
</CombinedInput>
<!-- <NumberInput value={values.notesPerBeat} min={1} max={4} on:change={(e) => (values.notesPerBeat = e.detail)} /> -->
{#if volume}
    <CombinedInput>
        <p><T id="media.volume" /></p>
        <NumberInput value={values.volume || 1} min={0.1} max={3} decimals={1} step={0.1} inputMultiplier={100} on:change={(e) => updateValue("volume", e)} />
    </CombinedInput>
{/if}
