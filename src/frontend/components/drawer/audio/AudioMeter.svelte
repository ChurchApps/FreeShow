<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { AudioInputCapture } from "../../../audio/routing/audioInputCapture"
    import { audioChannels, audioChannelsData } from "../../../stores"

    export let channelId: string = ""

    $: isMuted = !!$audioChannelsData[channelId]?.isMuted

    const numbers: number[] = [-60, -54, -48, -42, -36, -30, -24, -18, -12, -6, 0]

    let highestDB: { timeout: NodeJS.Timeout; value: number }[] = []
    let smoothedDB: number[] = [0, 0]
    let tick = 0
    let animationFrame: number

    onMount(() => {
        function loop() {
            tick++
            animationFrame = requestAnimationFrame(loop)
        }
        loop()
    })

    onDestroy(() => {
        if (animationFrame) cancelAnimationFrame(animationFrame)
    })

    const minDB = -60
    const maxDB = 0

    // Linear proportional dB scaling formula: (db + 60) / 60
    function dbToPos(db: number): number {
        if (db <= -60) return 0
        if (db >= 0) return 1
        return (db + 60) / 60
    }

    function getRawDBValue(channelIndex: number, _updater: any): number {
        const captured = AudioInputCapture.getInstance().getVisualizerData(channelId)
        if (captured && captured.channels && captured.channels[channelIndex] !== undefined) {
            return captured.channels[channelIndex].db
        } else if (captured && typeof captured.db === "number") {
            return captured.db
        } else if (channelId === "main") {
            return $audioChannels[channelIndex]?.dB?.value ?? -60
        } else {
            const nodeData = $audioChannelsData[channelId] as any
            return nodeData?.dB ?? -60
        }
    }

    function getDBValue(channelIndex: number, _updater: any) {
        if (isMuted) {
            if (highestDB[channelIndex]) highestDB[channelIndex].value = 0
            smoothedDB[channelIndex] = 0
            return 0
        }

        let db = getRawDBValue(channelIndex, _updater)

        // Apply channel volume fader adjustment (dB = rawDB + 20 * log10(volume))
        const channelVolume = Number($audioChannelsData[channelId]?.volume ?? 1)
        if (channelVolume > 0 && channelVolume < 1) {
            db += 20 * Math.log10(channelVolume)
        } else if (channelVolume === 0) {
            db = -60
        }

        const target = dbToPos(db)

        // Smooth attack / decay
        if (smoothedDB[channelIndex] === undefined) smoothedDB[channelIndex] = 0
        if (target > smoothedDB[channelIndex]) {
            smoothedDB[channelIndex] = target
        } else {
            smoothedDB[channelIndex] += (target - smoothedDB[channelIndex]) * 0.2
        }

        const dBPercentage = smoothedDB[channelIndex] * 100

        if (dBPercentage > (highestDB[channelIndex]?.value || 0)) {
            if (highestDB[channelIndex]?.timeout) clearTimeout(highestDB[channelIndex].timeout)
            highestDB[channelIndex] = {
                timeout: setTimeout(() => (highestDB[channelIndex].value = 0), 1000),
                value: dBPercentage
            }
        }

        return dBPercentage
    }

    function getPercentageFromDB(dB: number) {
        return dbToPos(dB) * 100
    }
</script>

<div class="background">
    <div class="main">
        <!-- WIP volume dots!!! instead of transition.. -->
        <div class="channel-row">
            <span class="signal-dot" class:active={getRawDBValue(0, tick) > -60 && !isMuted}></span>
            <span class="meter left" class:isMuted style="height: 6px;">
                <div style="right: 0;position: absolute;height: inherit;width: {100 - getDBValue(0, tick)}%" />
                <span class="meter left" style="right: 0;position: absolute;height: inherit;width: 100%;opacity: 0.08;" />
                <div class="highest" style="right: {100 - (highestDB[0]?.value || 0)}%;" />
            </span>
        </div>
        <div style="height: 1px;width: 100%;"></div>
        <div class="channel-row">
            <span class="signal-dot" class:active={getRawDBValue(1, tick) > -60 && !isMuted}></span>
            <span class="meter right" class:isMuted style="height: 6px;">
                <div style="right: 0;position: absolute;height: inherit;width: {100 - getDBValue(1, tick)}%" />
                <span class="meter right" style="right: 0;position: absolute;height: inherit;width: 100%;opacity: 0.08;" />
                <div class="highest" style="right: {100 - (highestDB[1]?.value || 0)}%;" />
            </span>
        </div>

        <div class="lines-container">
            <div class="lines" style="padding: 3px 0;">
                {#each Array.from({ length: maxDB - minDB + 1 }) as _, i}
                    {@const dB = minDB + i}

                    {#if numbers.includes(dB)}
                        <span class="line major" style="left: {getPercentageFromDB(dB)}%;"></span>
                    {:else if dB % 2 === 0}
                        <span class="line sub" style="left: {getPercentageFromDB(dB)}%;"></span>
                    {:else}
                        <span class="line micro" style="left: {getPercentageFromDB(dB)}%;"></span>
                    {/if}
                {/each}
            </div>

            <div class="lines" style="padding: 4px 0;">
                <p class="absolute" style="position: initial;opacity: 0;">.</p>
                <!-- <p class="absolute inf-dot">-∞</p> -->

                {#each numbers as i}
                    <p class="absolute" style="left: {getPercentageFromDB(i)}%;" class:end={i === numbers[numbers.length - 1]}>{i}</p>
                {/each}
            </div>
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
        background-color: var(--text);
        transform: translateX(-50%);
    }
    .line.major {
        height: 7px;
        width: 1.5px;
        opacity: 0.8;
    }
    .line.sub {
        height: 4px;
        opacity: 0.4;
    }
    .line.micro {
        height: 2px;
        opacity: 0.2;
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

    .lines-container {
        position: relative;
        margin-left: 5px;
        width: calc(100% - 5px);
    }

    /* .lines p.inf-dot {
        left: -8.5px !important;
        transform: translate(-50%, 50%);
    } */

    .lines p.end {
        transform: translate(-4px, 50%);
    }

    .channel-row {
        display: flex;
        align-items: center;
        gap: 2px;
        width: 100%;
    }

    .signal-dot {
        width: 3px;
        height: 6px;
        border-radius: 2px;
        background-color: rgba(255, 255, 255, 0.2);
        transition:
            background-color 0.1s ease,
            box-shadow 0.1s ease;
        flex-shrink: 0;
    }

    .signal-dot.active {
        background-color: rgb(0, 200, 200);
    }

    span.meter {
        background-image: linear-gradient(90deg, rgb(0, 200, 200) 0%, rgb(0, 255, 50) 55%, rgb(255, 200, 0) 84%, rgb(200, 0, 0) 100%);
        height: 50%;

        position: relative;
        border-radius: 1px;
        flex: 1;
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
