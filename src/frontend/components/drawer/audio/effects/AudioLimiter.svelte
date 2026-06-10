<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { AudioAnalyser } from "../../../../audio/audioAnalyser"
    import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
    import { type LimiterConfig, getLimiterReduction, setLimiterEnabled, updateLimiterConfig } from "../../../../audio/effects/audioLimiter"
    import InputRow from "../../../input/InputRow.svelte"
    import MaterialNumberInput from "../../../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../../../inputs/MaterialToggleSwitch.svelte"

    export let disabled: boolean = false

    let config: LimiterConfig = {
        enabled: false,
        ceiling: -3,
        release: 0.05
    }

    let grValue = 0
    let inputLevelDb = -80
    let grInterval: ReturnType<typeof setInterval> | null = null
    let unsubscribe: (() => void) | null = null

    onMount(() => {
        unsubscribe = subscribeEffect("limiter", (c: LimiterConfig) => {
            config = { ...c }
        })

        grInterval = setInterval(() => {
            grValue = getLimiterReduction()

            const channels = AudioAnalyser.getChannelsVolume()
            if (channels.length > 0) {
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
        setLimiterEnabled(e.detail)
    }

    function handleChange(key: keyof LimiterConfig, raw: number) {
        updateLimiterConfig({ [key]: raw })
    }

    // ---- transfer-curve visualisation ----

    let canvasW = 200
    const canvasH = 200
    const dbMin = -60
    const dbMax = 0

    // Limiter transfer: unity below ceiling, 20:1 above
    const RATIO = 20

    function dbToX(db: number, w: number): number {
        return ((db - dbMin) / (dbMax - dbMin)) * w
    }

    function dbToY(db: number): number {
        return canvasH - ((db - dbMin) / (dbMax - dbMin)) * canvasH
    }

    function transferOutput(inputDb: number, ceiling: number): number {
        if (inputDb <= ceiling) return inputDb
        return ceiling + (inputDb - ceiling) / RATIO
    }

    function buildTransferPath(ceiling: number, w: number): string {
        const steps = 120
        const points: string[] = []
        for (let i = 0; i <= steps; i++) {
            const inputDb = dbMin + (i / steps) * (dbMax - dbMin)
            const outputDb = transferOutput(inputDb, ceiling)
            const x = dbToX(inputDb, w)
            const y = dbToY(Math.max(dbMin, Math.min(dbMax, outputDb)))
            points.push(i === 0 ? `M ${x},${y}` : `L ${x},${y}`)
        }
        return points.join(" ")
    }

    $: transferPath = buildTransferPath(config.ceiling, canvasW)
    $: ceilX = dbToX(config.ceiling, canvasW)

    $: grBarHeight = Math.min(canvasH, Math.abs(grValue) * (canvasH / 60))
    $: grDisplay = grValue.toFixed(1)

    $: signalX = dbToX(inputLevelDb, canvasW)
    $: signalY = dbToY(Math.max(dbMin, Math.min(dbMax, transferOutput(inputLevelDb, config.ceiling))))

    $: releaseMs = Math.round(config.release * 1000)
</script>

<div class="limiter-container" style="--accent: #5284ad;" class:disabled>
    <MaterialToggleSwitch label="settings.enabled" checked={config.enabled} on:change={handleEnable} />

    <div style="height: 5px;"></div>

    <!-- Transfer curve visualisation -->
    <div class="curve-wrap" class:curve-disabled={!config.enabled}>
        <div class="curve-svg-wrap" bind:clientWidth={canvasW}>
            <svg width={canvasW} height={canvasH} class="curve-svg">
                <!-- Grid -->
                {#each [-60, -48, -36, -24, -12, 0] as db}
                    <line x1={dbToX(db, canvasW)} y1="0" x2={dbToX(db, canvasW)} y2={canvasH} stroke="var(--primary-lighter)" stroke-width="1" opacity="0.25" />
                    <line x1="0" y1={dbToY(db)} x2={canvasW} y2={dbToY(db)} stroke="var(--primary-lighter)" stroke-width="1" opacity="0.25" />
                    <text x={dbToX(db, canvasW) + 2} y={canvasH - 3} fill="var(--text)" font-size="8" opacity="0.45">{db}</text>
                    <text x="2" y={dbToY(db) - 2} fill="var(--text)" font-size="8" opacity="0.45">{db}</text>
                {/each}

                <!-- 1:1 unity line -->
                <line x1={dbToX(dbMin, canvasW)} y1={dbToY(dbMin)} x2={dbToX(dbMax, canvasW)} y2={dbToY(dbMax)} stroke="var(--primary-lighter)" stroke-width="1" opacity="0.35" stroke-dasharray="4,4" />

                <!-- Ceiling: shaded region above -->
                <rect x={ceilX} y="0" width={Math.max(0, canvasW - ceilX)} height={canvasH} fill="var(--accent)" opacity="0.08" />

                <!-- Ceiling marker -->
                <line x1={ceilX} y1="0" x2={ceilX} y2={canvasH} stroke="var(--accent)" stroke-width="1" opacity="0.6" stroke-dasharray="4,3" />
                <text x={ceilX + 3} y="10" fill="var(--accent)" font-size="9" opacity="0.9">{config.ceiling}dB</text>

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
            <div class="gr-bar" style="height: {grBarHeight}px;"></div>
            <span class="gr-label">{grDisplay} dB</span>
            <span class="gr-title">GR</span>
        </div>
    </div>

    <div style="height: 8px;"></div>

    <!-- Parameter inputs -->
    <InputRow>
        <MaterialNumberInput label="audio.ceiling" value={config.ceiling} min={-30} max={0} step={0.5} maxDecimals={1} showSlider sliderValues={{ min: -30, max: 0, step: 0.5 }} {disabled} on:change={(e) => handleChange("ceiling", e.detail)} />
    </InputRow>

    <InputRow>
        <MaterialNumberInput label="audio.release" value={releaseMs} min={1} max={500} step={1} maxDecimals={0} showSlider sliderValues={{ min: 1, max: 500, step: 1 }} {disabled} on:change={(e) => handleChange("release", e.detail / 1000)} />
    </InputRow>
</div>

<style>
    .limiter-container {
        border-radius: 8px;
        user-select: none;
    }

    .limiter-container.disabled {
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

    .gr-meter {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        width: 32px;
        height: 200px;
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
        background: var(--accent);
        opacity: 0.8;
        border-radius: 2px 2px 0 0;
        transition: height 0.05s linear;
    }

    .gr-label {
        position: absolute;
        bottom: 14px;
        font-size: 8px;
        color: var(--text);
        opacity: 0.7;
        white-space: nowrap;
        z-index: 1;
    }

    .gr-title {
        position: absolute;
        bottom: 4px;
        font-size: 8px;
        font-weight: bold;
        color: var(--accent);
        z-index: 1;
    }
</style>
