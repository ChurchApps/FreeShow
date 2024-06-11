<script lang="ts">
    import { onMount } from "svelte"
    import { dictionary, metronome, outLocked } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import { toggleMetronome, updateMetronome } from "./metronome"

    function playPause() {
        paused = !paused
        toggleMetronome()
    }

    $: updateMetronome(values)

    let values: any = {}
    let paused = true

    onMount(() => {
        values = clone($metronome)
        paused = !values.timeout
    })
</script>

<div class="scroll">
    <Button style="flex: 0" disabled={$outLocked} center title={paused ? $dictionary.media?.play : $dictionary.media?.pause} on:click={playPause}>
        <Icon id={paused ? "play" : "pause"} white={paused} size={5} />
    </Button>

    <CombinedInput>
        <p><T id="audio.tempo" /> (<T id="audio.bpm" />)</p>
        <NumberInput value={values.tempo || 120} min={1} decimals={1} max={320} on:change={(e) => (values.tempo = e.detail)} />
    </CombinedInput>
    <CombinedInput>
        <p><T id="audio.beats" /></p>
        <NumberInput value={values.beats || 4} min={1} max={16} on:change={(e) => (values.beats = e.detail)} />
    </CombinedInput>
    <CombinedInput>
        <p><T id="media.volume" /></p>
        <NumberInput value={values.volume || 1} min={0.1} max={3} decimals={1} step={0.1} inputMultiplier={100} on:change={(e) => (values.volume = e.detail)} />
    </CombinedInput>
    <!-- <NumberInput value={values.notesPerBeat} min={1} max={4} on:change={(e) => (values.notesPerBeat = e.detail)} /> -->
</div>

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }
</style>
