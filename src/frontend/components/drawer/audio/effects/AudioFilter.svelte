<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { subscribeEffect } from "../../../../audio/effects/audioEffectsHelpers"
    import { GAIN_FILTER_TYPES, type FilterConfig, type FilterType, setFilterEnabled, updateFilterConfig } from "../../../../audio/effects/audioFilter"
    import { translateText } from "../../../../utils/language"
    import InputRow from "../../../input/InputRow.svelte"
    import MaterialDropdown from "../../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../../../inputs/MaterialToggleSwitch.svelte"

    export let disabled: boolean = false

    let config: FilterConfig = {
        enabled: false,
        type: "lowpass",
        frequency: 1000,
        q: 1.0,
        gain: 0
    }

    let unsubscribe: (() => void) | null = null

    onMount(() => {
        unsubscribe = subscribeEffect("filter", (c: FilterConfig) => {
            config = { ...c }
        })
    })

    onDestroy(() => {
        unsubscribe?.()
    })

    function handleEnable(e: any) {
        setFilterEnabled(e.detail)
    }

    function handleTypeChange(e: any) {
        updateFilterConfig({ type: e.detail as FilterType })
    }

    function handleChange(key: keyof FilterConfig, raw: number) {
        updateFilterConfig({ [key]: raw })
    }

    // ---- filter type options ----
    const filterTypeOptions = [
        { label: "Low Pass", value: "lowpass" },
        { label: "High Pass", value: "highpass" },
        { label: "Band Pass", value: "bandpass" },
        { label: "Notch", value: "notch" },
        { label: "Peaking", value: "peaking" },
        { label: "Low Shelf", value: "lowshelf" },
        { label: "High Shelf", value: "highshelf" }
    ]

    $: showGain = GAIN_FILTER_TYPES.includes(config.type)

    // ---- frequency response visualisation ----

    let canvasW = 300
    const canvasH = 100
    const F_MIN = 20
    const F_MAX = 20000
    const DB_MIN = -24
    const DB_MAX = 24

    function freqToX(f: number, w: number): number {
        return (Math.log10(f / F_MIN) / Math.log10(F_MAX / F_MIN)) * w
    }

    function dbToY(db: number): number {
        return canvasH - ((Math.max(DB_MIN, Math.min(DB_MAX, db)) - DB_MIN) / (DB_MAX - DB_MIN)) * canvasH
    }

    /** Compute approximate frequency response for a biquad filter using an OfflineAudioContext */
    function buildResponsePath(type: FilterType, frequency: number, q: number, gain: number, w: number): string {
        try {
            const ac = new OfflineAudioContext(1, 128, 48000)
            const node = ac.createBiquadFilter()
            node.type = type
            node.frequency.value = Math.max(20, Math.min(20000, frequency))
            node.Q.value = Math.max(0.0001, q)
            node.gain.value = gain

            const N = 200
            const freqs = new Float32Array(N)
            for (let i = 0; i < N; i++) {
                freqs[i] = F_MIN * Math.pow(F_MAX / F_MIN, i / (N - 1))
            }
            const magResp = new Float32Array(N)
            const phaseResp = new Float32Array(N)
            node.getFrequencyResponse(freqs, magResp, phaseResp)

            return magResp
                .map((mag, i) => {
                    const db = 20 * Math.log10(Math.max(0.00001, mag))
                    const x = (i / (N - 1)) * w
                    const y = dbToY(db)
                    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`
                })
                .join(" ")
        } catch {
            return `M 0,${canvasH / 2} L ${w},${canvasH / 2}`
        }
    }

    $: responsePath = buildResponsePath(config.type, config.frequency, config.q, config.gain, canvasW)
    $: freqX = freqToX(config.frequency, canvasW)
    $: zeroY = dbToY(0)
    $: freqDisplay = config.frequency >= 1000 ? `${(config.frequency / 1000).toFixed(1)}kHz` : `${Math.round(config.frequency)}Hz`
</script>

<div class="filter-container" style="--accent: #ad8652;" class:disabled>
    <MaterialToggleSwitch label="settings.enabled" checked={config.enabled} on:change={handleEnable} />

    <div style="height: 5px;"></div>

    <!-- Frequency response visualisation -->
    <div class="viz-wrap" class:viz-disabled={!config.enabled}>
        <div class="viz-svg-wrap" bind:clientWidth={canvasW}>
            <svg width={canvasW} height={canvasH} class="viz-svg">
                <!-- dB grid lines -->
                {#each [-24, -12, 0, 12, 24] as db}
                    <line x1="0" y1={dbToY(db)} x2={canvasW} y2={dbToY(db)} stroke="var(--primary-lighter)" stroke-width="1" opacity="0.2" />
                    <text x="3" y={dbToY(db) - 2} fill="var(--text)" font-size="8" opacity="0.4">{db}dB</text>
                {/each}

                <!-- Frequency grid -->
                {#each [100, 1000, 10000] as f}
                    <line x1={freqToX(f, canvasW)} y1="0" x2={freqToX(f, canvasW)} y2={canvasH} stroke="var(--primary-lighter)" stroke-width="1" opacity="0.2" />
                    <text x={freqToX(f, canvasW) + 2} y={canvasH - 3} fill="var(--text)" font-size="8" opacity="0.35">{f >= 1000 ? `${f / 1000}k` : f}</text>
                {/each}

                <!-- Zero-dB line -->
                <line x1="0" y1={zeroY} x2={canvasW} y2={zeroY} stroke="var(--primary-lighter)" stroke-width="1" opacity="0.4" stroke-dasharray="4,4" />

                <!-- Response curve -->
                <path d={responsePath} fill="none" stroke="var(--accent)" stroke-width="2" opacity="0.9" />

                <!-- Frequency marker -->
                <line x1={freqX} y1="0" x2={freqX} y2={canvasH} stroke="var(--accent)" stroke-width="1" opacity="0.5" stroke-dasharray="3,3" />
                <text x={freqX + 3} y="12" fill="var(--accent)" font-size="9" opacity="0.9">{freqDisplay}</text>
            </svg>
        </div>
    </div>

    <div style="height: 8px;"></div>

    <InputRow>
        <MaterialDropdown label="audio.filter_type" value={config.type} options={filterTypeOptions} on:change={handleTypeChange} {disabled} />
    </InputRow>

    <InputRow>
        <MaterialNumberInput label="audio.frequency" value={config.frequency} min={20} max={20000} step={1} maxDecimals={0} showSlider sliderValues={{ min: 20, max: 20000, step: 1 }} {disabled} on:change={(e) => handleChange("frequency", e.detail)} />
    </InputRow>

    <InputRow>
        <MaterialNumberInput label="audio.q_factor" value={config.q} min={0.1} max={30} step={0.1} maxDecimals={1} showSlider sliderValues={{ min: 0.1, max: 30, step: 0.1 }} {disabled} on:change={(e) => handleChange("q", e.detail)} />
    </InputRow>

    {#if showGain}
        <InputRow>
            <MaterialNumberInput label="audio.gain" value={config.gain} min={-24} max={24} step={0.5} maxDecimals={1} showSlider sliderValues={{ min: -24, max: 24, step: 0.5 }} {disabled} on:change={(e) => handleChange("gain", e.detail)} />
        </InputRow>
    {/if}
</div>

<style>
    .filter-container {
        border-radius: 8px;
        user-select: none;
    }

    .filter-container.disabled {
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
