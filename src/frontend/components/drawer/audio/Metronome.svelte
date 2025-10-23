<script lang="ts">
    import { onMount } from "svelte"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { dictionary, metronome, outLocked, playingMetronome } from "../../../stores"
    import type { API_metronome } from "../../actions/api"
    import Icon from "../../helpers/Icon.svelte"
    import { clone } from "../../helpers/array"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import MetronomeInputs from "./MetronomeInputs.svelte"
    import { toggleMetronome, updateMetronome } from "./metronome"
    import MetronomeVisualizer from "./MetronomeVisualizer.svelte"

    // audio outputs
    let audioOutputs: { value: string; label: string }[] = []
    onMount(async () => {
        audioOutputs = await AudioPlayer.getOutputs()
    })

    function playPause() {
        paused = !paused
        toggleMetronome()
    }

    let values: API_metronome = {}
    let paused = true

    $: values = clone($metronome)

    $: updatePausedState($playingMetronome)
    function updatePausedState(active: boolean) {
        paused = !active
    }

    let options = false

    function updateValue(key: string, value: any) {
        updateMetronome({ ...values, [key]: value })
    }
</script>

{#if options}
    <div class="settings">
        <MaterialNumberInput label="media.volume" value={Number(((values.volume || 1) * 100).toFixed(2))} min={1} max={300} on:change={(e) => updateValue("volume", e.detail / 100)} showSlider sliderValues={{ max: 100 }} />
        <MaterialDropdown label="audio.custom_output" style="margin-top: 5px;" options={audioOutputs} value={values.audioOutput || ""} on:change={(e) => updateValue("audioOutput", e.detail)} allowEmpty />
    </div>
{:else}
    <div class="settings" style="display: flex;gap: 10px;">
        <SelectElem id="metronome" data={{ tempo: values.tempo || 120, beats: values.beats || 4 }} draggable>
            <!-- title={paused ? $dictionary.media?.play : $dictionary.media?.pause} -->
            <Button style="width: 100%;height: 100%;justify-content: center;border-radius: 6px;" disabled={$outLocked} center title={$dictionary.audio?.toggle_metronome} on:click={playPause}>
                <Icon id={paused ? "play" : "stop"} white={paused} size={5} />
            </Button>
        </SelectElem>

        <div style="flex: 1;">
            <MetronomeInputs
                {values}
                on:change={(e) => {
                    values = e.detail
                    updateMetronome(values)
                }}
            />

            <MetronomeVisualizer />
        </div>
    </div>

    <!-- TODO: last used values, click to play with preset values -->
{/if}

<FloatingInputs round>
    <MaterialButton isActive={options} title="edit.options" on:click={() => (options = !options)}>
        <Icon size={1.1} id="options" white={!options} />
    </MaterialButton>
</FloatingInputs>

<style>
    .settings {
        margin: 15px;
        padding: 10px;

        border: 1px solid var(--primary-lighter);

        border-radius: 8px;
        /* overflow: hidden; */
    }
</style>
