<script lang="ts">
  export let active: boolean = false
  export let center: boolean = false
  export let border: boolean = false
  export let bold: boolean = true
</script>

<button
  style={$$props.style}
  class:active
  class:center
  class:border
  class:bold
  class={$$props.class}
  on:click
  on:dblclick
  disabled={$$props.disabled}
  tabindex={active ? -1 : 0}
  title={$$props.title}
>
  <slot />
</button>

<style>
  button {
    background-color: inherit;
    color: inherit;
    /* font-size: inherit; */
    font-size: 0.9em;
    border: none;
    display: flex;
    align-items: center;
    padding: 0.2em 0.8em;
  }
  button.center {
    justify-content: center;
  }
  button.bold {
    font-weight: bold;
    letter-spacing: 0.5px;
    padding: 0.3em 0.8em;
    /* text-transform: uppercase; */
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
    color: var(--secondary-text);
    outline: none;
  }
  button.active.border {
    outline-offset: -2px;
    outline: 2px solid var(--secondary);
  }

  button :global(div) {
    padding-left: 0.8em;
  }

  button :global(svg) {
    /* padding: 0 0.5em; */
    /* padding-left: 0.2em; */
    box-sizing: content-box;
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
