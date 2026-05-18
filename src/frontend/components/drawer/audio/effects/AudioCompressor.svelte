<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { AudioAnalyser } from "../../../../audio/audioAnalyser"
    import { getCompressorReduction, setCompressorEnabled, updateCompressorConfig, type CompressorConfig } from "../../../../audio/effects/audioCompressor"
    import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
    import InputRow from "../../../input/InputRow.svelte"
    import MaterialNumberInput from "../../../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../../../inputs/MaterialToggleSwitch.svelte"

    export let disabled: boolean = false

    let config: CompressorConfig = {
        enabled: false,
        threshold: -24,
        knee: 30,
        ratio: 12,
        attack: 0.003,
        release: 0.25
    }

    let grValue = 0 // gain reduction in dB (read-only from compressor, <= 0)
    let inputLevelDb = -80 // current audio input level in dB
    let grInterval: ReturnType<typeof setInterval> | null = null

    let unsubscribe: (() => void) | null = null

    onMount(() => {
        unsubscribe = subscribeEffect("compressor", (c: CompressorConfig) => {
            config = { ...c }
        })

        // Poll gain reduction and audio level every 50 ms
        grInterval = setInterval(() => {
            grValue = getCompressorReduction()

            const channels = AudioAnalyser.getChannelsVolume()
            if (channels.length > 0) {
                // Average across all channels
                const avg = channels.reduce((sum, ch) => sum + ch.dB.value, 0) / channels.length
                inputLevelDb = Math.max(dbMin, Math.min(dbMax, avg))
            }
        }, 50)
    })

    onDestroy(() => {
        unsubscribe?.()
        if (grInterval !== null) clearInterval(grInterval)
    })

    // ---- handlers ----

    function handleEnable(e: any) {
        setCompressorEnabled(e.detail)
    }

    function handleChange(key: keyof CompressorConfig, raw: number) {
        updateCompressorConfig({ [key]: raw })
    }

    // ---- transfer-curve visualisation ----

    let canvasW = 200 // updated dynamically via bind:clientWidth
    const canvasH = 200
    const dbMin = -60
    const dbMax = 0

    function dbToX(db: number, w: number): number {
        return ((db - dbMin) / (dbMax - dbMin)) * w
    }

    function dbToY(db: number): number {
        return canvasH - ((db - dbMin) / (dbMax - dbMin)) * canvasH
    }

    /** Compute output dB given input dB using the soft-knee transfer function. */
    function transferOutput(inputDb: number, threshold: number, knee: number, ratio: number): number {
        const halfKnee = knee / 2
        const lowerThresh = threshold - halfKnee
        const upperThresh = threshold + halfKnee

        if (inputDb <= lowerThresh || knee === 0) {
            // below knee: unity gain
            if (inputDb <= threshold) return inputDb
            // above threshold, no knee: apply ratio
            return threshold + (inputDb - threshold) / ratio
        } else if (inputDb >= upperThresh) {
            // above knee
            return threshold + (inputDb - threshold) / ratio
        } else {
            // within soft knee: W3C Web Audio API spec quadratic formula
            // y = x + (1/R - 1) * (x - T + W/2)^2 / (2*W)
            return inputDb + ((1 / ratio - 1) * Math.pow(inputDb - threshold + halfKnee, 2)) / (2 * knee)
        }
    }

    function buildTransferPath(threshold: number, knee: number, ratio: number, w: number): string {
        const steps = 120
        const points: string[] = []
        for (let i = 0; i <= steps; i++) {
            const inputDb = dbMin + (i / steps) * (dbMax - dbMin)
            const outputDb = transferOutput(inputDb, threshold, knee, ratio)
            const x = dbToX(inputDb, w)
            const y = dbToY(Math.max(dbMin, Math.min(dbMax, outputDb)))
            points.push(i === 0 ? `M ${x},${y}` : `L ${x},${y}`)
        }
        return points.join(" ")
    }

    $: transferPath = buildTransferPath(config.threshold, config.knee, config.ratio, canvasW)

    // knee region shade
    $: kneeX1 = dbToX(config.threshold - config.knee / 2, canvasW)
    $: kneeX2 = dbToX(config.threshold + config.knee / 2, canvasW)
    $: threshX = dbToX(config.threshold, canvasW)

    // GR meter bar height (grValue is <= 0)
    $: grBarHeight = Math.min(canvasH, Math.abs(grValue) * (canvasH / 60))
    $: grDisplay = grValue.toFixed(1)

    // live signal position on the transfer curve
    $: signalX = dbToX(inputLevelDb, canvasW)
    $: signalY = dbToY(Math.max(dbMin, Math.min(dbMax, transferOutput(inputLevelDb, config.threshold, config.knee, config.ratio))))

    // attack / release in ms for display
    $: attackMs = Math.round(config.attack * 1000)
    $: releaseMs = Math.round(config.release * 1000)
</script>

<div class="compressor-container" style="--accent: #ad6852;" class:disabled>
    <MaterialToggleSwitch label="settings.enabled" checked={config.enabled} on:change={handleEnable} />

    <div style="height: 5px;" />

    <!-- Transfer curve visualisation -->
    <div class="curve-wrap" class:curve-disabled={!config.enabled}>
        <div class="curve-svg-wrap" bind:clientWidth={canvasW}>
            <svg width={canvasW} height={canvasH} class="curve-svg">
                <!-- Grid dB lines -->
                {#each [-60, -48, -36, -24, -12, 0] as db}
                    <line x1={dbToX(db, canvasW)} y1="0" x2={dbToX(db, canvasW)} y2={canvasH} stroke="var(--primary-lighter)" stroke-width="1" opacity="0.25" />
                    <line x1="0" y1={dbToY(db)} x2={canvasW} y2={dbToY(db)} stroke="var(--primary-lighter)" stroke-width="1" opacity="0.25" />
                    <text x={dbToX(db, canvasW) + 2} y={canvasH - 3} fill="var(--text)" font-size="8" opacity="0.45">{db}</text>
                    <text x="2" y={dbToY(db) - 2} fill="var(--text)" font-size="8" opacity="0.45">{db}</text>
                {/each}

                <!-- 1:1 unity line -->
                <line x1={dbToX(dbMin, canvasW)} y1={dbToY(dbMin)} x2={dbToX(dbMax, canvasW)} y2={dbToY(dbMax)} stroke="var(--primary-lighter)" stroke-width="1" opacity="0.35" stroke-dasharray="4,4" />

                <!-- Soft knee region -->
                {#if config.knee > 0}
                    <rect x={kneeX1} y="0" width={Math.max(0, kneeX2 - kneeX1)} height={canvasH} fill="var(--accent)" opacity="0.07" />
                {/if}

                <!-- Threshold marker -->
                <line x1={threshX} y1="0" x2={threshX} y2={canvasH} stroke="var(--accent)" stroke-width="1" opacity="0.5" stroke-dasharray="4,3" />
                <text x={threshX + 3} y="10" fill="var(--accent)" font-size="9" opacity="0.85">{config.threshold}dB</text>

                <!-- Transfer curve -->
                <path d={transferPath} fill="none" stroke="var(--accent)" stroke-width="2" opacity="0.9" />

                <!-- Live signal: vertical hairline + dot on the curve -->
                <line x1={signalX} y1="0" x2={signalX} y2={canvasH} stroke="#ffffff" stroke-width="1" opacity="0.2" />
                <circle cx={signalX} cy={signalY} r="4" fill="#ffffff" opacity="0.85" />
                <circle cx={signalX} cy={signalY} r="7" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.3" />
            </svg>
        </div>

        <!-- GR meter -->
        <div class="gr-meter" title="Gain Reduction">
            <div class="gr-bar" style="height: {grBarHeight}px;" />
            <span class="gr-label">{grDisplay} dB</span>
            <span class="gr-title">GR</span>
        </div>
    </div>

    <div style="height: 8px;" />

    <!-- Parameter inputs -->
    <InputRow>
        <MaterialNumberInput label="audio.threshold" value={config.threshold} min={-100} max={0} step={1} maxDecimals={0} showSlider sliderValues={{ min: -60, max: 0, step: 1 }} {disabled} on:change={(e) => handleChange("threshold", e.detail)} />
    </InputRow>

    <InputRow>
        <MaterialNumberInput label="audio.ratio" value={config.ratio} min={1} max={20} step={0.5} maxDecimals={1} showSlider sliderValues={{ min: 1, max: 20, step: 0.5 }} {disabled} on:change={(e) => handleChange("ratio", e.detail)} />
    </InputRow>

    <InputRow>
        <MaterialNumberInput label="audio.knee" value={config.knee} min={0} max={40} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 40, step: 1 }} {disabled} on:change={(e) => handleChange("knee", e.detail)} />
    </InputRow>

    <InputRow>
        <MaterialNumberInput label="audio.attack" value={attackMs} min={0} max={1000} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 500, step: 1 }} {disabled} on:change={(e) => handleChange("attack", e.detail / 1000)} />
    </InputRow>

    <InputRow>
        <MaterialNumberInput label="audio.release" value={releaseMs} min={1} max={1000} step={1} maxDecimals={0} showSlider sliderValues={{ min: 1, max: 1000, step: 1 }} {disabled} on:change={(e) => handleChange("release", e.detail / 1000)} />
    </InputRow>
</div>

<style>
    .compressor-container {
        border-radius: 8px;
        user-select: none;
    }

    .compressor-container.disabled {
        opacity: 0.5;
        pointer-events: none;
    }

    .curve-wrap {
        display: flex;
        gap: 6px;
        align-items: flex-start;
        background: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 4px;
        overflow: hidden;
        transition: opacity 0.2s ease;
        font-family: monospace;
    }

    .curve-wrap.curve-disabled {
        opacity: 0.4;
    }

    .curve-svg-wrap {
        flex: 1;
        min-width: 0;
    }

    .curve-svg {
        display: block;
    }

    /* GR meter — vertical bar on the right */
    .gr-meter {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        width: 32px;
        height: 200px; /* fixed: matches SVG canvasH so bar never stretches parent */
        flex-shrink: 0;
        padding: 4px 0;
        gap: 2px;
        background: var(--primary-darkest, var(--primary-darker));
        border-left: 1px solid var(--primary-lighter);
        position: relative;
        overflow: hidden;
    }

    .gr-bar {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 14px;
        background: linear-gradient(to top, #ad6852, #e8a87c);
        border-radius: 2px 2px 0 0;
        transition: height 0.05s linear;
    }

    .gr-label {
        font-size: 8px;
        color: var(--text);
        opacity: 0.7;
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        white-space: nowrap;
    }

    .gr-title {
        font-size: 9px;
        font-weight: bold;
        color: var(--accent);
        opacity: 0.8;
        margin-bottom: 2px;
    }
</style>
