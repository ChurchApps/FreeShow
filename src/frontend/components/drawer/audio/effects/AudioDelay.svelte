<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { type DelayConfig, setDelayEnabled, updateDelayConfig } from "../../../../audio/effects/audioDelay"
    import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
    import InputRow from "../../../input/InputRow.svelte"
    import MaterialNumberInput from "../../../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../../../inputs/MaterialToggleSwitch.svelte"

    export let disabled: boolean = false

    let config: DelayConfig = {
        enabled: false,
        delayTime: 0.5,
        feedback: 0.3,
        wet: 0.3
    }

    let unsubscribe: (() => void) | null = null

    onMount(() => {
        unsubscribe = subscribeEffect("delay", (c: DelayConfig) => {
            config = { ...c }
        })
    })

    onDestroy(() => {
        unsubscribe?.()
    })

    function handleEnable(e: any) {
        setDelayEnabled(e.detail)
    }

    function handleChange(key: keyof DelayConfig, raw: number) {
        updateDelayConfig({ [key]: raw })
    }

    // ---- echo pulse visualisation ----

    let canvasW = 200
    const canvasH = 100
    const MAX_ECHOES = 8
    const WINDOW_SEC = 2 // seconds shown in view

    interface EchoBar {
        x: number
        h: number
        opacity: number
    }

    function buildEchoBars(delayTime: number, feedback: number, wet: number, w: number): EchoBar[] {
        const bars: EchoBar[] = []
        // Direct pulse at time 0
        bars.push({ x: 0, h: (canvasH - 8) * 0.9, opacity: 1 - wet * 0.2 })
        // Echo taps
        let amp = wet
        for (let i = 1; i <= MAX_ECHOES; i++) {
            const t = delayTime * i
            if (t > WINDOW_SEC) break
            const x = (t / WINDOW_SEC) * w
            const h = (canvasH - 8) * Math.min(1, amp)
            bars.push({ x, h, opacity: 0.85 })
            amp *= feedback
            if (amp < 0.01) break
        }
        return bars
    }

    $: echoBars = buildEchoBars(config.delayTime, config.feedback, config.wet, canvasW)
    $: delayMs = Math.round(config.delayTime * 1000)
    $: feedbackPct = Math.round(config.feedback * 100)
    $: wetPct = Math.round(config.wet * 100)
</script>

<div class="delay-container" style="--accent: #adad52;" class:disabled>
    <MaterialToggleSwitch label="settings.enabled" checked={config.enabled} on:change={handleEnable} />

    <div style="height: 5px;"></div>

    <!-- Echo pulse visualisation -->
    <div class="viz-wrap" class:viz-disabled={!config.enabled}>
        <div class="viz-svg-wrap" bind:clientWidth={canvasW}>
            <svg width={canvasW} height={canvasH} class="viz-svg">
                <!-- Time grid -->
                {#each [0, 0.5, 1, 1.5, 2] as sec}
                    <line x1={(sec / 2) * canvasW} y1="0" x2={(sec / 2) * canvasW} y2={canvasH} stroke="var(--primary-lighter)" stroke-width="1" opacity="0.2" />
                    <text x={(sec / 2) * canvasW + 2} y={canvasH - 3} fill="var(--text)" font-size="8" opacity="0.35">{sec}s</text>
                {/each}

                <!-- Echo bars -->
                {#each echoBars as bar, i}
                    <rect x={bar.x - 3} y={canvasH - bar.h - 4} width="6" height={bar.h} fill="var(--accent)" opacity={bar.opacity * (i === 0 ? 0.9 : 0.7)} rx="2" />
                {/each}

                <!-- Labels -->
                <text x="4" y="12" fill="var(--text)" font-size="8" opacity="0.4">Echo</text>
                <text x={canvasW - 4} y="12" fill="var(--accent)" font-size="9" text-anchor="end" opacity="0.85">{delayMs}ms</text>
            </svg>
        </div>
    </div>

    <div style="height: 8px;"></div>

    <InputRow>
        <MaterialNumberInput label="audio.delay" value={delayMs} min={10} max={2000} step={1} maxDecimals={0} showSlider sliderValues={{ min: 10, max: 2000, step: 1 }} {disabled} on:change={(e) => handleChange("delayTime", e.detail / 1000)} />
    </InputRow>

    <InputRow>
        <MaterialNumberInput label="audio.feedback" value={feedbackPct} min={0} max={95} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 95, step: 1 }} {disabled} on:change={(e) => handleChange("feedback", e.detail / 100)} />
    </InputRow>

    <InputRow>
        <MaterialNumberInput label="audio.wet" value={wetPct} min={0} max={100} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 100, step: 1 }} {disabled} on:change={(e) => handleChange("wet", e.detail / 100)} />
    </InputRow>
</div>

<style>
    .delay-container {
        border-radius: 8px;
        user-select: none;
    }

    .delay-container.disabled {
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
