<script lang="ts">
  export let value: number
</script>

<input
  type="range"
  bind:value
  style={$$props.style}
  min={$$props.min || 0}
  max={$$props.max || 100}
  step={$$props.step}
  title={$$props.title}
  disabled={$$props.disabled}
  on:mouseenter
  on:mouseleave
  on:mousedown
  on:mousemove
  on:change
/>

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
    -webkit-transition: 0.2s;
    transition: opacity 0.2s, width 0.1s, height 0.1s;
  }

  input::-webkit-slider-thumb:hover {
    opacity: 1;
    width: 12px;
    height: 12px;
  }

  /* input:hover ~ input::-webkit-slider-thumb {
    opacity: 1;
  } */

  input::-moz-range-thumb {
    width: 10px;
    height: 10px;
    background: var(--secondary);
    cursor: pointer;
    pointer-events: none;
  }
</style>
