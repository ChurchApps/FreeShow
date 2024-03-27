<script lang="ts">
    import { drawer, gain, volume } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { updateVolume } from "../../helpers/audio"
    import Slider from "../../inputs/Slider.svelte"
    import AudioMeter from "../../output/preview/AudioMeter.svelte"

    // TODO: video player volume

    // TODO: reduce volume on video/player too

    // let volume: number = 100

    function setVolume(e: any, changeGain: boolean = false) {
        updateVolume(e.target.value, changeGain)
    }

    $: drawerHeight = $drawer.height - 40 - 100
</script>

<!-- TODO: effects?: https://alemangui.github.io/pizzicato/ -->

<main style="--height: {drawerHeight || 150}px;">
    <div class="meter">
        <AudioMeter advanced />
    </div>
    <div class="volume">
        <p style="font-size: 0.9em;"><T id="media.volume" /></p>
        <div class="slider">
            <Slider value={$volume} step={0.01} max={1} on:input={setVolume} />
        </div>
        <p style="font-size: 1em;margin: 10px;{$volume === 1 || $volume === 0 ? 'color: var(--secondary);' : ''}">{($volume * 100).toFixed()}</p>
    </div>
    <div class="volume" style="left: 75%">
        <p style="font-size: 0.9em;"><T id="media.gain" /></p>
        <div class="slider">
            <Slider value={$gain} step={0.01} min={1} max={3} on:input={(e) => setVolume(e, true)} />
        </div>
        <p style="font-size: 1em;margin: 10px;{$gain === 1 ? 'color: var(--secondary);' : ''}">{(($gain - 1) * 100).toFixed()}</p>
    </div>
</main>

<style>
    main {
        height: 100%;
        display: flex;
        align-items: center;
        gap: 10px;

        overflow-x: hidden;
    }

    p {
        text-align: center;
        font-weight: bold;
        font-size: 1.2em;
        padding: 10px;
    }

    .volume {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
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
        background: #71797e;

        background-image: url("../assets/mixer_slider.webp");
        background-size: contain;
        background-position: center center;
        background-repeat: no-repeat;

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
