<script lang="ts">
    import { metronome, outLocked, playingMetronome, special } from "../../../stores"
    import type { MetronomeSettings } from "../../../types/Audio"
    import { translateText } from "../../../utils/language"
    import { audioExtensions } from "../../../values/extensions"
    import Icon from "../../helpers/Icon.svelte"
    import { clone } from "../../helpers/array"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialFilePicker from "../../inputs/MaterialFilePicker.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import MetronomeInputs from "./MetronomeInputs.svelte"
    import MetronomeVisualizer from "./MetronomeVisualizer.svelte"
    import { toggleMetronome, updateMetronome } from "./metronome"

    function playPause() {
        paused = !paused
        toggleMetronome()
    }

    let values: MetronomeSettings = {}
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

    const clickSounds = [
        // { value: "soft", label: "Soft" },
        { value: "metal", label: "Metal" },
        { value: "wood", label: "Wood" },
        { value: "custom", label: translateText("sort.custom") }
    ]

    function updateSpecial(key: string, value: any) {
        special.update((a) => {
            a[key] = value
            return a
        })
    }
</script>

{#if options}
    <div class="settings">
        <MaterialDropdown label="audio.click_sound" disabled={!paused} options={clickSounds} value={$special.clickSound || "metal"} on:change={(e) => updateSpecial("clickSound", e.detail)} />
        {#if $special.clickSound === "custom"}
            <InputRow>
                <MaterialFilePicker label="tabs.audio (Hi)" icon="music" disabled={!paused} value={$special.clickSound_hi || ""} filter={{ name: "Audio files", extensions: audioExtensions }} on:change={(e) => updateSpecial("clickSound_hi", e.detail)} />
                <MaterialFilePicker label="tabs.audio (Lo)" icon="music" disabled={!paused} value={$special.clickSound_lo || ""} filter={{ name: "Audio files", extensions: audioExtensions }} on:change={(e) => updateSpecial("clickSound_lo", e.detail)} />
            </InputRow>
        {/if}
        <InputRow>
            <MaterialNumberInput label="media.volume (Hi)" value={Number(((values.accentVolume ?? 2) * 100).toFixed(0))} min={0} max={500} step={5} defaultValue={200} on:change={(e) => updateValue("accentVolume", e.detail / 100)} showSlider />
            <MaterialNumberInput label="media.volume (Lo)" value={Number(((values.secondaryVolume ?? 1.75) * 100).toFixed(0))} min={0} max={500} step={5} defaultValue={175} on:change={(e) => updateValue("secondaryVolume", e.detail / 100)} showSlider />
        </InputRow>
    </div>
{:else}
    <div class="settings" style="display: flex;gap: 10px;">
        <SelectElem id="metronome" data={{ tempo: values.tempo || 120, beats: values.beats || 4 }} draggable>
            <Button style="width: 100%;height: 100%;justify-content: center;border-radius: 6px;" disabled={$outLocked} center title={translateText("audio.toggle_metronome")} on:click={playPause}>
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
