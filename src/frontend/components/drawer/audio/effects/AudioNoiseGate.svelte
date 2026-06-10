<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { AudioAnalyser } from "../../../../audio/audioAnalyser"
    import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
    import { type NoiseGateConfig, setNoiseGateEnabled, updateNoiseGateConfig } from "../../../../audio/effects/audioNoiseGate"
    import InputRow from "../../../input/InputRow.svelte"
    import MaterialNumberInput from "../../../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../../../inputs/MaterialToggleSwitch.svelte"

    export let disabled: boolean = false

    let config: NoiseGateConfig = {
        enabled: false,
        threshold: -40,
        attack: 0.003,
        release: 0.1,
        hysteresis: 6
    }

    let inputLevelDb = -80
    let pollInterval: ReturnType<typeof setInterval> | null = null
    let unsubscribe: (() => void) | null = null

    onMount(() => {
        unsubscribe = subscribeEffect("noiseGate", (c: NoiseGateConfig) => {
            config = { ...c }
        })

        pollInterval = setInterval(() => {
            const channels = AudioAnalyser.getChannelsVolume()
            if (channels.length > 0) {
                const avg = channels.reduce((sum, ch) => sum + ch.dB.value, 0) / channels.length
                inputLevelDb = Math.max(dbMin, Math.min(dbMax, avg))
            }
        }, 50)
    })

    onDestroy(() => {
        unsubscribe?.()
        if (pollInterval !== null) clearInterval(pollInterval)
    })

    function handleEnable(e: any) {
        setNoiseGateEnabled(e.detail)
    }

    function handleChange(key: keyof NoiseGateConfig, raw: number) {
        updateNoiseGateConfig({ [key]: raw })
    }

    // ---- visualisation ----

    let canvasW = 200
    const canvasH = 100
    const dbMin = -80
    const dbMax = 0

    function dbToX(db: number, w: number): number {
        return ((db - dbMin) / (dbMax - dbMin)) * w
    }

    // Gate indicator: is current level above threshold?
    $: gateOpen = inputLevelDb > config.threshold
    $: signalX = dbToX(inputLevelDb, canvasW)
    $: threshX = dbToX(config.threshold, canvasW)
    $: hystX = dbToX(config.threshold - config.hysteresis, canvasW)

    $: attackMs = Math.round(config.attack * 1000)
    $: releaseMs = Math.round(config.release * 1000)
</script>

<div class="gate-container" style="--accent: #52ad7a;" class:disabled>
    <MaterialToggleSwitch label="settings.enabled" checked={config.enabled} on:change={handleEnable} />

    <div style="height: 5px;"></div>

    <!-- Gate visualisation -->
    <div class="viz-wrap" class:viz-disabled={!config.enabled}>
        <div class="viz-svg-wrap" bind:clientWidth={canvasW}>
            <svg width={canvasW} height={canvasH} class="viz-svg">
                <!-- Blocked region (below hysteresis) -->
                <rect x="0" y="0" width={Math.max(0, hystX)} height={canvasH} fill="#cc4444" opacity="0.08" />
                <!-- Transition region (hysteresis zone) -->
                <rect x={hystX} y="0" width={Math.max(0, threshX - hystX)} height={canvasH} fill="var(--accent)" opacity="0.06" />
                <!-- Pass region (above threshold) -->
                <rect x={threshX} y="0" width={Math.max(0, canvasW - threshX)} height={canvasH} fill="var(--accent)" opacity="0.1" />

                <!-- dB grid -->
                {#each [-80, -60, -40, -20, 0] as db}
                    <line x1={dbToX(db, canvasW)} y1="0" x2={dbToX(db, canvasW)} y2={canvasH} stroke="var(--primary-lighter)" stroke-width="1" opacity="0.2" />
                    <text x={dbToX(db, canvasW) + 2} y={canvasH - 3} fill="var(--text)" font-size="8" opacity="0.4">{db}</text>
                {/each}

                <!-- Hysteresis lower bound -->
                <line x1={hystX} y1="0" x2={hystX} y2={canvasH} stroke="var(--accent)" stroke-width="1" opacity="0.3" stroke-dasharray="3,3" />

                <!-- Threshold marker -->
                <line x1={threshX} y1="0" x2={threshX} y2={canvasH} stroke="var(--accent)" stroke-width="1.5" opacity="0.7" stroke-dasharray="4,3" />
                <text x={threshX + 3} y="10" fill="var(--accent)" font-size="9" opacity="0.9">{config.threshold}dB</text>

                <!-- Signal level hairline + dot -->
                <line x1={signalX} y1="0" x2={signalX} y2={canvasH} stroke="#ffffff" stroke-width="1" opacity="0.2" />
                <circle cx={signalX} cy={canvasH / 2} r="4" fill={gateOpen ? "var(--accent)" : "#cc4444"} opacity="0.9" />
                <circle cx={signalX} cy={canvasH / 2} r="7" fill="none" stroke={gateOpen ? "var(--accent)" : "#cc4444"} stroke-width="1" opacity="0.35" />
            </svg>
        </div>

        <!-- Gate status badge -->
        <div class="gate-status" class:open={gateOpen}>
            <span>{gateOpen ? "OPEN" : "CLOSED"}</span>
        </div>
    </div>

    <div style="height: 8px;"></div>

    <InputRow>
        <MaterialNumberInput label="audio.threshold" value={config.threshold} min={-100} max={0} step={1} maxDecimals={0} showSlider sliderValues={{ min: -80, max: 0, step: 1 }} {disabled} on:change={(e) => handleChange("threshold", e.detail)} />
    </InputRow>

    <InputRow>
        <MaterialNumberInput label="audio.hysteresis" value={config.hysteresis} min={0} max={24} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 24, step: 1 }} {disabled} on:change={(e) => handleChange("hysteresis", e.detail)} />
    </InputRow>

    <InputRow>
        <MaterialNumberInput label="audio.attack" value={attackMs} min={0} max={500} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 200, step: 1 }} {disabled} on:change={(e) => handleChange("attack", e.detail / 1000)} />
    </InputRow>

    <InputRow>
        <MaterialNumberInput label="audio.release" value={releaseMs} min={1} max={2000} step={1} maxDecimals={0} showSlider sliderValues={{ min: 1, max: 1000, step: 1 }} {disabled} on:change={(e) => handleChange("release", e.detail / 1000)} />
    </InputRow>
</div>

<style>
    .gate-container {
        border-radius: 8px;
        user-select: none;
    }

    .gate-container.disabled {
        opacity: 0.5;
        pointer-events: none;
    }

    .viz-wrap {
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

    .viz-wrap.viz-disabled {
        opacity: 0.4;
    }

    .viz-svg-wrap {
        flex: 1;
        min-width: 0;
    }

    .viz-svg {
        display: block;
    }

    .gate-status {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 100px;
        flex-shrink: 0;
        background: var(--primary-darkest, var(--primary-darker));
        border-left: 1px solid var(--primary-lighter);
        font-size: 9px;
        font-weight: bold;
        font-family: monospace;
        color: #cc4444;
        writing-mode: vertical-rl;
        text-orientation: mixed;
        transform: rotate(180deg);
        transition: color 0.1s ease;
    }

    .gate-status.open {
        color: var(--accent);
    }
</style>
