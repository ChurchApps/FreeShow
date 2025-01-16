<script lang="ts">
    export let value: number
    export let min: number = 0
    export let max: number = 100
    export let invert: boolean = false // flip slider if max < min
</script>

<input type="range" bind:value style={$$props.style} {min} {max} step={$$props.step || 1} title={$$props.title} disabled={$$props.disabled} class:invert on:mouseenter on:mouseleave on:mousedown on:mousemove on:input on:change />

<style>
    input {
        /* padding: 2px; */
        -webkit-appearance: none;
        width: 100%;
        height: 10px;
        background: var(--primary-darker);
        outline: none;
        -webkit-transition: 0.2s;
        transition: opacity 0.2s;
    }

    input.invert {
        transform: rotate(180deg);
    }

    input:disabled {
        opacity: 0.5;
    }

    input::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;

        width: 10px;
        height: 10px;

        background: var(--secondary);
        cursor: pointer;
        pointer-events: none;
        opacity: 0.8;

        border-radius: var(--border-radius);

        -webkit-transition: 0.2s;
        transition:
            opacity 0.2s,
            width 0.1s,
            height 0.1s;
    }

    input::-webkit-slider-thumb:hover {
        opacity: 1;
        width: 12px;
        height: 12px;
    }

    /* input:hover ~ input::-webkit-slider-thumb {
    opacity: 1;
  } */
</style>
