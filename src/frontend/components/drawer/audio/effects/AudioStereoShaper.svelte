<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
    import { type StereoShaperConfig, setStereoShaperEnabled, updateStereoShaperConfig } from "../../../../audio/effects/audioStereoShaper"
    import InputRow from "../../../input/InputRow.svelte"
    import MaterialNumberInput from "../../../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../../../inputs/MaterialToggleSwitch.svelte"

    export let disabled: boolean = false

    let config: StereoShaperConfig = {
        enabled: false,
        width: 100
    }

    let unsubscribe: (() => void) | null = null

    onMount(() => {
        unsubscribe = subscribeEffect("stereoShaper", (c: StereoShaperConfig) => {
            config = { ...c }
        })
    })

    onDestroy(() => {
        unsubscribe?.()
    })

    function handleEnable(e: any) {
        setStereoShaperEnabled(e.detail)
    }

    function handleChange(key: keyof StereoShaperConfig, raw: number) {
        updateStereoShaperConfig({ [key]: raw })
    }

    // ---- stereo field visualisation ----

    let canvasW = 300
    const canvasH = 110

    /**
     * Compute the stereo field paths for the visualisation.
     * Draws two overlapping ellipses (L and R) whose horizontal spread is
     * proportional to width/100. At width=0 they stack perfectly (mono).
     */
    function buildFieldPaths(width: number, w: number): { left: string; right: string; center: number } {
        const cx = w / 2
        const cy = canvasH / 2
        const maxRadius = (w / 2) * 0.42
        const spread = (width / 200) * maxRadius // 0 = no spread, full = maxRadius
        const rx = maxRadius * 0.55 + spread * 0.45
        const ry = canvasH * 0.38

        const lx = cx - spread
        const rx2 = cx + spread

        // SVG ellipse path approximation using bezier curves
        function ellipse(x: number, y: number, a: number, b: number): string {
            const k = 0.5523 * a
            const kv = 0.5523 * b
            return `M ${x},${y - b} C ${x + k},${y - b} ${x + a},${y - kv} ${x + a},${y} C ${x + a},${y + kv} ${x + k},${y + b} ${x},${y + b} C ${x - k},${y + b} ${x - a},${y + kv} ${x - a},${y} C ${x - a},${y - kv} ${x - k},${y - b} ${x},${y - b} Z`
        }

        return {
            left: ellipse(lx, cy, rx, ry),
            right: ellipse(rx2, cy, rx, ry),
            center: cx
        }
    }

    $: field = buildFieldPaths(config.width, canvasW)
    $: widthLabel = config.width === 0 ? "Mono" : config.width === 100 ? "Stereo" : config.width < 100 ? `${config.width}% (narrow)` : `${config.width}% (wide)`
</script>

<div class="shaper-container" style="--accent: #52adad;" class:disabled>
    <MaterialToggleSwitch label="settings.enabled" checked={config.enabled} on:change={handleEnable} />

    <div style="height: 5px;"></div>

    <!-- Stereo field visualisation -->
    <div class="viz-wrap" class:viz-disabled={!config.enabled}>
        <div class="viz-svg-wrap" bind:clientWidth={canvasW}>
            <svg width={canvasW} height={canvasH} class="viz-svg">
                <!-- Background -->
                <rect x="0" y="0" width={canvasW} height={canvasH} fill="transparent" />

                <!-- L ellipse -->
                <path d={field.left} fill="var(--accent)" opacity="0.18" />
                <path d={field.left} fill="none" stroke="var(--accent)" stroke-width="1.5" opacity="0.6" />

                <!-- R ellipse -->
                <path d={field.right} fill="var(--accent)" opacity="0.18" />
                <path d={field.right} fill="none" stroke="var(--accent)" stroke-width="1.5" opacity="0.6" />

                <!-- Center axis -->
                <line x1={field.center} y1="4" x2={field.center} y2={canvasH - 4} stroke="var(--primary-lighter)" stroke-width="1" opacity="0.3" stroke-dasharray="3,3" />

                <!-- Channel labels -->
                <text x="10" y={canvasH / 2 + 4} fill="var(--accent)" font-size="11" opacity="0.7" font-weight="bold">L</text>
                <text x={canvasW - 16} y={canvasH / 2 + 4} fill="var(--accent)" font-size="11" opacity="0.7" font-weight="bold">R</text>

                <!-- Width label -->
                <text x={field.center} y={canvasH - 6} fill="var(--accent)" font-size="9" text-anchor="middle" opacity="0.85">{widthLabel}</text>
            </svg>
        </div>
    </div>

    <div style="height: 8px;"></div>

    <InputRow>
        <MaterialNumberInput label="audio.width" value={config.width} min={0} max={200} step={1} maxDecimals={0} showSlider sliderValues={{ min: 0, max: 200, step: 1 }} {disabled} on:change={(e) => handleChange("width", e.detail)} />
    </InputRow>
</div>

<style>
    .shaper-container {
        border-radius: 8px;
        user-select: none;
    }

    .shaper-container.disabled {
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
