<script lang="ts">
    import { dictionary, metronome, outLocked, playingMetronome } from "../../../stores"
    import type { API_metronome } from "../../actions/api"
    import Icon from "../../helpers/Icon.svelte"
    import { clone } from "../../helpers/array"
    import Button from "../../inputs/Button.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import MetronomeInputs from "./MetronomeInputs.svelte"
    import { toggleMetronome, updateMetronome } from "./metronome"

    function playPause() {
        paused = !paused
        toggleMetronome()
    }

    let values: API_metronome = {}
    let paused = true

    $: values = clone($metronome)

    $: updatePausedState($playingMetronome)
    function updatePausedState(active) {
        paused = !active
    }
</script>

<div class="scroll">
    <SelectElem id="metronome" data={{ tempo: values.tempo || 120, beats: values.beats || 4 }} draggable>
        <!-- title={paused ? $dictionary.media?.play : $dictionary.media?.pause} -->
        <Button style="width: 100%;" disabled={$outLocked} center title={$dictionary.audio?.toggle_metronome} on:click={playPause}>
            <Icon id={paused ? "play" : "pause"} white={paused} size={5} />
        </Button>
    </SelectElem>

    <div class="inputs">
        <MetronomeInputs
            {values}
            on:change={(e) => {
                values = e.detail
                updateMetronome(values)
            }}
        />
    </div>
</div>

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .inputs {
        display: flex;
        flex-direction: column;

        padding: 10px;
    }
</style>
