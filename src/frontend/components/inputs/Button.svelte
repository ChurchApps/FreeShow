<script lang="ts">
  export let active: boolean = false
</script>

<button style={$$props.style} class:active class={$$props.class} on:click disabled={$$props.disabled} tabindex={active ? -1 : 0} title={$$props.title}>
  <slot />
</button>

<style>
  button {
    background-color: inherit;
    color: inherit;
    font-weight: bold;
    /* text-transform: uppercase; */
    letter-spacing: 0.5px;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5px 15px;
  }
  button:not(:disabled):not(.active) {
    cursor: pointer;
  }
  button:hover:not(:disabled):not(.active) {
    background-color: var(--hover);
  }
  button:active:not(:disabled):not(.active),
  button:focus:not(.active) {
    background-color: var(--focus);
  }
  button.active {
    background-color: var(--secondary-opacity);
    outline: none;
  }
  button.active :global(svg) {
    fill: var(--text);
  }

  button:disabled {
    opacity: 0.5;
    /* this is to prevent interfearing with mouse event listeners */
    pointer-events: none;
  }
</style>
