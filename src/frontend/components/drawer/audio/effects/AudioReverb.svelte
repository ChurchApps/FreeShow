<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
    import { type ReverbConfig, setReverbEnabled, updateReverbConfig } from "../../../../audio/effects/audioReverb"
    import InputRow from "../../../input/InputRow.svelte"
    import MaterialNumberInput from "../../../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../../../inputs/MaterialToggleSwitch.svelte"

    export let disabled: boolean = false

    let config: ReverbConfig = {
        enabled: false,
        roomSize: 0.5,
        dampening: 0.5,
        wet: 0.25
    }

    let unsubscribe: (() => void) | null = null

    onMount(() => {
        unsubscribe = subscribeEffect("reverb", (c: ReverbConfig) => {
            config = { ...c }
        })
    })

    onDestroy(() => {
        unsubscribe?.()
    })

    function handleEnable(e: any) {
        setReverbEnabled(e.detail)
    }

    function handleChange(key: keyof ReverbConfig, raw: number) {
        updateReverbConfig({ [key]: raw })
    }

    // ---- decay envelope visualisation ----

    let canvasW = 200
    const canvasH = 100

    /** Build an SVG path for the exponential decay envelope matching the IR. */
    function buildDecayPath(roomSize: number, dampening: number, w: number): string {
        const duration = 0.1 + roomSize * 3.9 // same formula as generateIR
        const maxDuration = 4.0 // seconds represented by full width
        const decay = 1 + dampening * 7
        const steps = 100
        const points: string[] = []
        for (let i = 0; i <= steps; i++) {
            const t = i / steps
            const amp = Math.pow(1 - t, decay)
            const x = t * (duration / maxDuration) * w
            const y = canvasH - amp * (canvasH - 8)
            points.push(i === 0 ? `M ${x},${y}` : `L ${x},${y}`)
        }
        // Close to bottom-right of the decay region
        const endX = (duration / maxDuration) * w
        points.push(`L ${endX},${canvasH} L 0,${canvasH} Z`)
        return points.join(" ")
    }

    $: durationSec = (0.1 + config.roomSize * 3.9).toFixed(1)
    $: decayPath = buildDecayPath(config.roomSize, config.dampening, canvasW)
    $: wetPct = Math.round(config.wet * 100)
</script>

<div class="reverb-container" style="--accent: #9952ad;" class:disabled>
    <MaterialToggleSwitch label="settings.enabled" checked={config.enabled} on:change={handleEnable} />

    <div style="height: 5px;"></div>

    <!-- Decay envelope visualisation -->
    <div class="viz-wrap" class:viz-disabled={!config.enabled}>
        <div class="viz-svg-wrap" bind:clientWidth={canvasW}>
            <svg width={canvasW} height={canvasH} class="viz-svg">
                <!-- Filled decay envelope -->
                <path d={decayPath} fill="var(--accent)" opacity="0.18" />
                <!-- Envelope outline -->
                <path
                    d={buildDecayPath(config.roomSize, config.dampening, canvasW).split(" L")[0] +
                        buildDecayPath(config.roomSize, config.dampening, canvasW)
                            .split(" L")
                            .slice(1, -2)
                            .map((s) => " L" + s)
                            .join("")}
                    fill="none"
                    stroke="var(--accent)"
                    stroke-width="1.5"
                    opacity="0.7"
                />

                <!-- Duration label -->
                <text x={canvasW - 4} y="12" fill="var(--accent)" font-size="9" text-anchor="end" opacity="0.85">{durationSec}s</text>
                <text x="4" y="12" fill="var(--text)" font-size="8" opacity="0.4">Decay</text>

                <!-- Wet level bar on right edge -->
                <rect x={canvasW - 6} y={canvasH - config.wet * canvasH} width="4" height={config.wet * canvasH} fill="var(--accent)" opacity="0.5" rx="2" />
                <text x={canvasW - 10} y={canvasH - 4} fill="var(--accent)" font-size="8" text-anchor="end" opacity="0.7">{wetPct}%</text>
            </svg>
        </div>
    </div>

    <div style="height: 8px;"></div>

    <InputRow>
        <MaterialNumberInput label="audio.room_size" value={Math.round(config.roomSize * 100)} min={0} max={100} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 100, step: 1 }} {disabled} on:change={(e) => handleChange("roomSize", e.detail / 100)} />
    </InputRow>

    <InputRow>
        <MaterialNumberInput label="audio.dampening" value={Math.round(config.dampening * 100)} min={0} max={100} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 100, step: 1 }} {disabled} on:change={(e) => handleChange("dampening", e.detail / 100)} />
    </InputRow>

    <InputRow>
        <MaterialNumberInput label="audio.wet" value={wetPct} min={0} max={100} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 100, step: 1 }} {disabled} on:change={(e) => handleChange("wet", e.detail / 100)} />
    </InputRow>
</div>

<style>
    .reverb-container {
        border-radius: 8px;
        user-select: none;
    }

    .reverb-container.disabled {
        opacity: 0.5;
        pointer-events: none;
    }

    .viz-wrap {
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
        width: 100%;
    }

    .viz-svg {
        display: block;
    }
</style>
