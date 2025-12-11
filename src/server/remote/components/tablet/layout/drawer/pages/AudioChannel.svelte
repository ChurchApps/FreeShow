<script lang="ts">
    import MaterialButton from "../../../../MaterialButton.svelte"
    import { createEventDispatcher } from "svelte"
    import { translate } from "../../../../../util/helpers"
    import { dictionary } from "../../../../../util/stores"

    export let label: string
    export let volume: number = 1
    export let isMuted: boolean = false
    export let disabled: boolean = false

    const dispatch = createEventDispatcher()

    function onVolumeInput(e: any) {
        dispatch("input", parseFloat(e.target.value))
    }

    function onVolumeChange(e: any) {
        dispatch("change", parseFloat(e.target.value))
    }

    function onNumberChange(e: any) {
        const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
        dispatch("change", val / 100)
    }

    function toggleMute() {
        dispatch("mute")
    }
</script>

<div class="mixer-section">
    <div class="output">
        <div class="label">
            <p>{label}</p>

            <input type="range" class="volume-slider" min="0" max="1" step="0.01" value={volume} disabled={disabled || isMuted} on:input={onVolumeInput} on:change={onVolumeChange} />
        </div>

        <div class="input">
            <input type="number" min="0" max="100" step="1" value={Math.round(volume * 100)} disabled={disabled || isMuted} on:change={onNumberChange} />
            <span class="unit">%</span>
        </div>

        <MaterialButton variant="outlined" style="padding: 8px; height: 36px; width: 36px;" icon={isMuted ? "muted" : "volume"} title={translate(`actions.${isMuted ? "unmute" : "mute"}`, $dictionary)} red={isMuted} on:click={toggleMute} />
    </div>
</div>

<style>
    .mixer-section {
        padding: 10px;
        background-color: rgb(0 0 0 / 0.15);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        margin-bottom: 10px;
    }

    .output {
        display: flex;
        align-items: center;
        gap: 3px;
        /* margin-bottom: 10px; removed since meter is gone */
    }

    .label {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 5px;
        font-size: 0.7em;
        flex: 1;
        margin-right: 7px;
    }

    .label p {
        opacity: 0.9;
        margin: 0;
    }

    .volume-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 10px;
        background: var(--primary-darkest);
        outline: none;
        border-radius: 10px;
        transition: opacity 0.2s;
    }

    .volume-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        background: var(--secondary);
        cursor: pointer;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        transition:
            width 0.15s ease,
            height 0.15s ease,
            box-shadow 0.15s ease;
    }

    .volume-slider::-webkit-slider-thumb:active {
        width: 24px;
        height: 24px;
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
    }

    .volume-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        background: var(--secondary);
        cursor: pointer;
        border-radius: 50%;
        border: none;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        transition:
            width 0.15s ease,
            height 0.15s ease,
            box-shadow 0.15s ease;
    }

    .volume-slider::-moz-range-thumb:active {
        width: 24px;
        height: 24px;
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
    }

    .volume-slider:disabled {
        opacity: 0.5;
    }

    .volume-slider:disabled::-webkit-slider-thumb {
        cursor: not-allowed;
    }

    .volume-slider:disabled::-moz-range-thumb {
        cursor: not-allowed;
    }

    .input {
        position: relative;
    }

    .input input[type="number"] {
        width: 60px;
        padding: 5px;
        padding-right: 18px;
        box-sizing: border-box;
        background-color: var(--primary-darkest);
        color: var(--text);
        border: none;
        border-radius: 4px;
        font-family: inherit;
        font-size: inherit;
        text-align: center;
        -moz-appearance: textfield;
        appearance: textfield;
    }

    .input input[type="number"]::-webkit-outer-spin-button,
    .input input[type="number"]::-webkit-inner-spin-button {
        -webkit-appearance: none;
        appearance: none;
        margin: 0;
    }

    .input input[type="number"]:disabled {
        opacity: 0.5;
    }

    .input .unit {
        position: absolute;
        right: 0;
        bottom: 5px;
        transform: translateX(-7px);
        pointer-events: none;
        font-size: 0.7em;
        color: var(--secondary);
        font-weight: bold;
    }
</style>
