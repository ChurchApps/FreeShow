<script lang="ts">
    import { AudioAnalyserMerger } from "../../../audio/audioAnalyserMerger"
    import { audioChannels, audioChannelsData } from "../../../stores"

    export let channelId: string = ""

    $: isMuted = !!$audioChannelsData[channelId]?.isMuted

    const numbers: number[] = [-80, -64, -50, -35, -20, -15, -12, -9, -6, -3, 0]

    let highestDB: { timeout: NodeJS.Timeout; value: number }[] = []

    function getDBValue(channelIndex: number, _updater: any) {
        const dB = channelId === "main" ? $audioChannels[channelIndex]?.dB : AudioAnalyserMerger.getChannels()[channelId]?.[channelIndex]?.dB
        if (!dB) return AudioAnalyserMerger.dBmax

        let value: number = dB.value
        // const max: number = dB.max || AudioAnalyserMerger.dBmax
        // const min: number = dB.min || AudioAnalyserMerger.dBmin

        if (value > max) value = max
        if (value < min) value = min

        let percentage = (value - min) / range // (max - min)
        percentage = 1 - transformRange(1 - percentage)

        const dBPercentage = percentage * 100

        if (dBPercentage > (highestDB[channelIndex]?.value || 0)) {
            if (highestDB[channelIndex]?.timeout) clearTimeout(highestDB[channelIndex].timeout)
            highestDB[channelIndex] = {
                timeout: setTimeout(() => (highestDB[channelIndex].value = 0), 1000),
                value: dBPercentage
            }
        }

        return dBPercentage
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

    const max: number = $audioChannels[0]?.dB?.max ?? AudioAnalyserMerger.dBmax
    const min: number = $audioChannels[0]?.dB?.min ?? AudioAnalyserMerger.dBmin
    const range: number = max - min

    function getPercentageFromDB(dB: number) {
        // invert
        let percentage = (dB - min) / range
        percentage = 1 - percentage

        return transformRange(percentage) * 100
    }
</script>

<div class="background">
    <div class="main">
        <!-- WIP volume dots!!! instead of transition.. -->
        <span class="meter left" class:isMuted style="height: 6px;">
            <div style="right: 0;position: absolute;height: inherit;width: {100 - getDBValue(0, $audioChannels)}%" />
            <span class="meter left" style="right: 0;position: absolute;height: inherit;width: 100%;opacity: 0.08;" />
            <div class="highest" style="right: {100 - (highestDB[0]?.value || 0)}%;" />
        </span>
        <div style="height: 1px;width: 100%;"></div>
        <span class="meter right" class:isMuted style="height: 6px;">
            <div style="right: 0;position: absolute;height: inherit;width: {100 - getDBValue(1, $audioChannels)}%" />
            <span class="meter right" style="right: 0;position: absolute;height: inherit;width: 100%;opacity: 0.08;" />
            <div class="highest" style="right: {100 - (highestDB[1]?.value || 0)}%;" />
        </span>

        <div class="lines" style="padding: 3px 0;">
            {#each Array.from({ length: range + 1 }) as _, i}
                {@const dB = min + i}

                <!-- <span class="line" style="left: {((i + 1) / range) * 100}%;"></span> -->
                {#if dB > -20 || dB % 3 === 0 || numbers.includes(dB)}
                    <span class="line" class:bigger={numbers.includes(dB)} style="left: {100 - getPercentageFromDB(dB)}%;"></span>
                {/if}
            {/each}
        </div>

        <div class="lines" style="padding: 4px 0;">
            <p class="absolute" style="position: initial;opacity: 0;">.</p>

            {#each numbers as i}
                <!-- "-" + (i * -1).toString().padStart(2, "0") -->
                <p class="absolute" style="left: {100 - getPercentageFromDB(i)}%;" class:start={i === numbers[0]} class:end={i === numbers[numbers.length - 1]}>{i <= -80 ? "-∞" : i}</p>
            {/each}
        </div>
    </div>
</div>

<style>
    .background {
        background-color: var(--primary-darkest);
        border-radius: 5px;
        padding: 5px;
    }

    .main {
        width: 100%;
        display: flex;
        flex-direction: column;

        position: relative;
    }

    .lines {
        position: relative;
        opacity: 0.8;
    }

    .line {
        position: absolute;
        width: 1px;
        height: 5px;

        background-color: var(--text);
        opacity: 0.5;
    }
    .line.bigger {
        height: 8px;
        width: 2px;
        opacity: 0.7;
    }

    .lines p {
        display: flex;
        align-items: center;
        flex: 2;

        font-size: 0.7em;
    }

    .absolute {
        position: absolute;
        top: 0;
        inset-inline-start: 5px;
        transform: translate(-50%, 50%);
    }

    .highest {
        position: absolute;
        height: inherit;
        width: 2px;

        background-color: white !important;
        opacity: 0.2;

        transition: 0.2s right;
    }

    .lines p.start {
        transform: translate(-3px, 50%);
    }
    .lines p.end {
        transform: translate(-4px, 50%);
    }

    span.meter {
        background-image: linear-gradient(90deg, rgb(0, 200, 200) 0%, rgb(0, 255, 50) 55%, rgb(255, 200, 0) 84%, rgb(200, 0, 0) 100%);
        height: 50%;

        position: relative;
        border-radius: 1px;
    }
    span.meter.isMuted {
        filter: grayscale(1) brightness(0.7);
    }

    span.meter div {
        transition: width 0.05s ease 0s;
        background-color: var(--primary-darker);
        height: 100%;
    }
</style>
