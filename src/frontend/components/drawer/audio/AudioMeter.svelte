<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { AudioInputCapture } from "../../../audio/routing/audioInputCapture"
    import { activeDrawerTab, activePage, audioChannelsData, drawer } from "../../../stores"
    import { DEFAULT_DRAWER_HEIGHT } from "../../../utils/common"

    export let channelId: string = ""
    export let detailed: boolean = false
    export let preview: boolean = false

    $: channelVolume = Number($audioChannelsData[channelId]?.volume ?? 1)
    $: isMuted = !!$audioChannelsData[channelId]?.isMuted

    const numbers: number[] = [-60, -54, -48, -42, -36, -30, -24, -18, -12, -6, 0]

    let highestDB: { lastTime: number; value: number }[] = []
    let smoothedDB: number[] = []
    let animationFrame: number = 0
    let lastTickTime = 0

    // DOM Element references for direct style updates (bypassing Svelte template re-renders)
    let maskEls: (HTMLDivElement | null)[] = []
    let peakEls: (HTMLDivElement | null)[] = []
    let dotEls: (HTMLElement | null)[] = []

    let channelIndices: number[] = [0, 1]

    const minDB = -60
    const maxDB = 0

    // Linear proportional dB scaling formula: (db + 60) / 60
    function dbToPos(db: number): number {
        if (db <= -60) return 0
        if (db >= 0) return 1
        return (db + 60) / 60
    }

    function getChannelDbs(): number[] {
        const captured = AudioInputCapture.getInstance().getVisualizerData(channelId)
        if (captured && captured.channels?.length) {
            return captured.channels.map((c) => c.db)
        } else if (captured && typeof captured.db === "number") {
            return [captured.db]
        } else {
            const data = ($audioChannelsData || {})[channelId] as any
            if (data && typeof data.dB === "number") {
                return [data.dB, data.dB]
            }
            return [-60, -60]
        }
    }

    function updateMeterChannel(rawDb: number, channelIndex: number) {
        if (typeof channelIndex !== "number" || isNaN(channelIndex) || channelIndex < 0) {
            return { dbValue: 0, highestDb: 100 }
        }

        let db = rawDb

        // Apply channel volume fader adjustment (dB = rawDB + 20 * log10(volume))
        if (channelVolume > 0 && channelVolume !== 1) {
            db += 20 * Math.log10(channelVolume)
        } else if (channelVolume === 0) {
            db = -60
        }

        const target = dbToPos(db)

        // Smooth attack / decay in JS
        const prevSmoothed = smoothedDB[channelIndex] ?? 0
        const newSmoothed = target > prevSmoothed ? target : prevSmoothed + (target - prevSmoothed) * 0.2
        smoothedDB[channelIndex] = newSmoothed

        const dBPercentage = newSmoothed * 100
        const now = Date.now()

        let highest = highestDB[channelIndex]
        if (!highest) {
            highest = { lastTime: 0, value: 0 }
            highestDB[channelIndex] = highest
        }

        if (dBPercentage >= highest.value) {
            highest.value = dBPercentage
            highest.lastTime = now
        } else if (now - highest.lastTime > 1000) {
            highest.value = Math.max(dBPercentage, highest.value - 2)
        }

        return {
            dbValue: dBPercentage,
            highestDb: 100 - highest.value
        }
    }

    function updateDOM() {
        const rawDbs = getChannelDbs()

        if (rawDbs.length !== channelIndices.length) {
            channelIndices = Array.from({ length: Math.max(1, rawDbs.length) }, (_, i) => i)
        }

        for (let i = 0; i < rawDbs.length; i++) {
            const rawDb = rawDbs[i]
            const { dbValue, highestDb } = updateMeterChannel(rawDb, i)

            const maskEl = maskEls[i]
            if (maskEl) {
                const maskPct = 100 - dbValue
                if (vertical) {
                    maskEl.style.height = `${maskPct}%`
                } else {
                    maskEl.style.width = `${maskPct}%`
                }
            }

            const peakEl = peakEls[i]
            if (peakEl) {
                if (highestDb < 100) {
                    peakEl.style.display = "block"
                    if (vertical) {
                        peakEl.style.top = `${highestDb}%`
                    } else {
                        peakEl.style.right = `${highestDb}%`
                    }
                } else {
                    peakEl.style.display = "none"
                }
            }

            const dotEl = dotEls[i]
            if (dotEl) {
                if (rawDb > -60) {
                    dotEl.classList.add("active")
                } else {
                    dotEl.classList.remove("active")
                }
            }
        }
    }

    onMount(() => {
        function loop(timestamp: number) {
            animationFrame = requestAnimationFrame(loop)
            if (timestamp - lastTickTime < 33) return // Throttle to ~30fps
            lastTickTime = timestamp
            updateDOM()
        }
        animationFrame = requestAnimationFrame(loop)
    })

    onDestroy(() => {
        if (animationFrame) cancelAnimationFrame(animationFrame)
    })

    function getPercentageFromDB(dB: number) {
        return dbToPos(dB) * 100
    }

    function openAudioMix() {
        if (!preview) return
        activePage.set("show")
        activeDrawerTab.set("audio")

        const minHeight = 40
        if ($drawer.height <= minHeight) drawer.set({ height: $drawer.stored || DEFAULT_DRAWER_HEIGHT, stored: null })
    }

    const vertical = preview
</script>

<div class="background" class:preview class:vertical on:click={openAudioMix} role="none">
    <div class="main" class:vertical>
        {#each channelIndices as i}
            {#if i > 0 && !preview}
                <div style="height: 1px;width: 100%;"></div>
            {/if}
            <div class="channel-row" class:vertical>
                {#if !vertical}
                    <span bind:this={dotEls[i]} class="signal-dot" style="height: {detailed ? '6px' : '3px'};"></span>
                {/if}

                <span class="meter" class:isMuted class:vertical style={!vertical ? `height: ${detailed ? "6px" : "3px"};` : ""}>
                    <div bind:this={maskEls[i]} style={vertical ? "width: 100%; top: 0; position: absolute;" : "height: inherit; right: 0; position: absolute;"} />
                    <span class="meter" class:isMuted class:vertical style="position: absolute; opacity: 0.08; {vertical ? 'top: 0; width: 100%; height: 100%;' : 'right: 0; height: inherit; width: 100%;'}" />
                    <div bind:this={peakEls[i]} class="highest" class:vertical style="display: none;" />
                </span>

                {#if vertical}
                    <span bind:this={dotEls[i]} class="signal-dot vertical" />
                {/if}
            </div>
        {/each}

        {#if detailed}
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

                    {#each numbers as i}
                        <p class="absolute" style="left: {getPercentageFromDB(i)}%;" class:end={i === numbers[numbers.length - 1]}>{i}</p>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .background {
        background-color: var(--primary-darkest);
        border-radius: 5px;
        padding: 5px;
    }

    .background.preview {
        background-color: transparent !important;
        border-radius: 0;
        padding: 0;
        cursor: pointer;
        width: 4px;
        height: 100%;
    }
    .background.vertical {
        height: 100%;
    }

    .main {
        width: 100%;
        display: flex;
        flex-direction: column;

        position: relative;
    }

    .main.vertical {
        height: 100%;
        flex-direction: row;
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
    }

    .highest.vertical {
        height: 2px;
        width: 100%;
    }

    .lines-container {
        position: relative;
        margin-left: 5px;
        width: calc(100% - 5px);
    }

    .lines p.end {
        transform: translate(-4px, 50%);
    }

    .channel-row {
        display: flex;
        align-items: center;
        gap: 2px;
        width: 100%;
    }

    .channel-row.vertical {
        height: 100%;
        width: 100%;
        gap: 0;
        flex: 1;
        flex-direction: column;
    }

    .signal-dot {
        width: 3px;
        height: 3px;
        border-radius: 2px;
        /* background-color: rgba(255, 255, 255, 0.2); */
        background-color: rgb(0, 200, 200);
        opacity: 0.1;
        flex-shrink: 0;
    }

    .signal-dot.vertical {
        width: 100%;
        height: 2px;
    }

    .signal-dot:global(.active) {
        /* background-color: rgb(0, 200, 200); */
        opacity: 1;
    }

    span.meter {
        background-image: linear-gradient(90deg, rgb(0, 200, 200) 0%, rgb(0, 255, 50) 55%, rgb(255, 200, 0) 84%, rgb(200, 0, 0) 100%);
        height: 50%;

        position: relative;
        border-radius: 1px;
        flex: 1;
    }

    span.meter.vertical {
        background-image: linear-gradient(0deg, rgb(0, 200, 200) 0%, rgb(0, 255, 50) 55%, rgb(255, 200, 0) 84%, rgb(200, 0, 0) 100%);
        height: 100%;
        width: 100%;
        border-radius: 0;
    }

    span.meter.isMuted {
        filter: grayscale(1) brightness(0.7);
    }

    span.meter div {
        background-color: var(--primary-darker);
    }
</style>
