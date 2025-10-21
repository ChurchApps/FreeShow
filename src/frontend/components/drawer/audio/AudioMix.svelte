<script lang="ts">
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { drawer, gain, outputs, special, volume } from "../../../stores"
    import { getActiveOutputs } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import Slider from "../../inputs/Slider.svelte"
    import AudioMeter2 from "../../output/preview/AudioMeter.svelte"
    import AudioMeter from "./AudioMeter.svelte"

    function setVolume(e: any) {
        let value = e.target?.value || e

        // "snap" to 100%
        // && !e.altKey
        if ($special.allowGaining && value > 0.95 && value < 1.05) value = 1

        let newGain = 1
        let newVolume = 1

        if (value > 1) newGain = (value - 1) / 0.125 + 1
        else newVolume = value

        volume.set(newVolume)
        gain.set(newGain)

        AudioPlayer.updateVolume()
    }

    // 25% / 200 = 0.125
    $: gainValue = (Number($gain || 0) - 1) * 0.125
    $: volumeValue = $special.allowGaining ? Number($volume ?? 1) + gainValue : Number($volume ?? 1)

    $: drawerHeight = $drawer.height - 40 - 180

    const outputIds = getActiveOutputs($outputs, true, true, true)
</script>

<section>
    <div class="output">
        <MaterialNumberInput label="media.volume (Main)" value={volumeValue * 100} min={0} max={100} on:change={(e) => setVolume(e.detail / 100)} showSlider />
        <Slider value={volumeValue} step={0.01} max={$special.allowGaining ? 1.25 : 1} on:input={setVolume} />
    </div>

    <AudioMeter channelId="main" />
</section>

{#each outputIds as outputId}
    <section>
        <div class="output">
            <MaterialNumberInput label={`media.volume (Output: ${$outputs[outputId]?.name})`} value={volumeValue * 100} min={0} max={100} on:change={(e) => setVolume(e.detail / 100)} showSlider />
        </div>

        <AudioMeter channelId={outputId} />
    </section>
{/each}

<br />
<br />
<br />

<main style="--height: {drawerHeight || 150}px;">
    <div class="meter">
        <AudioMeter2 advanced />
    </div>

    <div class="volume" style="inset-inline-start: calc(50% + (48px / 2));">
        <p style="font-size: 0.9em;"><T id="media.volume" /></p>
        <div class="slider">
            <Slider value={volumeValue} step={0.01} max={$special.allowGaining ? 1.25 : 1} on:input={setVolume} />
        </div>
        <p style="font-size: 1em;margin: 10px;{volumeValue === 1 || volumeValue === 0 ? 'color: var(--secondary);' : ''}">{(volumeValue * 100).toFixed()}<span style="color: var(--text);">%</span></p>
    </div>
</main>

<style>
    section {
        margin: 10px;
        padding: 10px;

        border: 2px solid RED;
        border-radius: 8px;
    }

    main {
        height: 100%;
        display: flex;
        align-items: center;
        gap: 10px;

        overflow-x: hidden;
    }

    p {
        text-align: center;
        font-weight: 600;
        font-size: 1.2em;
        padding: 10px;
    }

    .volume {
        position: absolute;
        left: 50%;
        top: 80%;
        transform: translate(-50%, -45%);
        pointer-events: none;
    }

    .slider {
        min-height: 100px;
        height: var(--height);
        position: relative;
    }

    .slider :global(input) {
        min-width: 100px;
        width: var(--height);
        height: 8px;

        box-shadow:
            inset 1px 1px 3px rgb(0 0 0 / 0.5),
            0 1px 1px rgb(255 255 255 / 0.1);
        border-radius: 8px;

        transform: rotate(270deg) translateX(-50%);
        /* appearance: slider-vertical; */

        pointer-events: auto;
    }

    .slider :global(input)::-webkit-slider-thumb {
        width: 50px;
        height: 23px;
        cursor: default;

        box-shadow: 0 0 5px rgb(0 0 0 / 0.3);

        opacity: 1;
        background: #bababa;

        background-image: url("../assets/mixer_slider.webp");
        background-size: contain;
        background-position: center center;
        background-repeat: no-repeat;

        border-radius: 2px;

        /* position: relative; */
    }
    /* .slider :global(input)::-webkit-slider-thumb::after {
        width: 80%;
        height: 2px;
        background-color: black;

        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
    } */

    .slider :global(input)::-webkit-slider-thumb:hover {
        width: 51px;
        height: 24px;

        box-shadow: 0 0 14px rgb(0 0 0 / 0.4);
    }

    /* meter */
    .meter {
        display: flex;
        /* width: 10px; */
        height: 100%;
    }
</style>
