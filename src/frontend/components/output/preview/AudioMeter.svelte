<script lang="ts">
    import { AudioAnalyserMerger } from "../../../audio/audioAnalyserMerger"
    import { activeDrawerTab, activePage, audioChannels, drawer } from "../../../stores"
    import { DEFAULT_DRAWER_HEIGHT } from "../../../utils/common"

    function getDBValue(dB: any) {
        if (!dB) return AudioAnalyserMerger.dBmax

        let value: number = dB.value
        const max: number = dB.max || AudioAnalyserMerger.dBmax
        const min: number = dB.min || AudioAnalyserMerger.dBmin

        if (value > max) value = max
        if (value < min) value = min

        let percentage = (value - min) / (max - min)
        percentage = 1 - transformRange(1 - percentage)

        return percentage * 100
    }

    const newRange = 1 - 0.4 // %
    const threshold = 1 - 0.78 // bottom X% will be compressed into new range
    const compressionFactor = threshold / newRange
    const expansionFactor = (1 - newRange) / (1 - threshold)

    function transformRange(value) {
        if (value <= threshold) {
            return value / compressionFactor
        } else {
            return newRange + (value - threshold) * expansionFactor
        }
    }

    function openAudioMix() {
        activePage.set("show")
        activeDrawerTab.set("audio")

        const minHeight = 40
        if ($drawer.height <= minHeight) drawer.set({ height: $drawer.stored || DEFAULT_DRAWER_HEIGHT, stored: null })
    }
</script>

<!-- on:keydown={triggerClickOnEnterSpace} role="button" tabindex="0" aria-label="Open audio mixer" -->
<div class="main" on:click={openAudioMix}>
    <!-- <span class="left">
            <div style="height: {100 - ($audioChannels.volume?.left || 0)}%" />
        </span>
        <span class="right">
            <div style="height: {100 - ($audioChannels.volume?.right || 0)}%" />
        </span> -->
    <span class="left">
        <div style="height: {100 - getDBValue($audioChannels[0]?.dB)}%" />
    </span>
    <span class="right">
        <div style="height: {100 - getDBValue($audioChannels[1]?.dB)}%" />
    </span>
</div>

<style>
    .main {
        width: 6px;
        display: flex;
    }

    span {
        /* background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(255, 220, 0) 16%, rgb(0, 220, 0) 45%, rgb(0, 120, 0) 100%); */
        /* background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(200, 100, 0) 16%, rgb(0, 255, 120) 45%, rgb(0, 120, 200) 100%); */
        /* background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(255, 200, 0) 16%, rgb(0, 255, 50) 45%, rgb(0, 200, 150) 100%); */
        background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(255, 200, 0) 16%, rgb(0, 255, 50) 45%, rgb(0, 200, 200) 100%);
        width: 50%;
    }

    span div {
        /* transition: height 0.05s ease 0s; */
        transition: height 0.05s ease 0s;
        /* background-color: transparent; */
        background-color: var(--primary-darker);
        width: 100%;
    }
</style>
