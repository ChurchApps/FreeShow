<script lang="ts">
  export let active: boolean = false
  export let center: boolean = false
  export let border: boolean = false
  export let dark: boolean = false
  export let bold: boolean = true
  export let red: boolean = false
  export let redHover: boolean = false
  export let brighterHover: boolean = false
</script>

<button
  id={$$props.id}
  style={$$props.style}
  class:active
  class:center
  class:border
  class:bold
  class:dark
  class:red
  class:redHover
  class:brighterHover
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
    font-family: inherit;
    /* font-size: inherit; */
    font-size: 0.9em;
    border: none;
    display: flex;
    align-items: center;
    padding: 0.2em 0.8em;

    transition: background-color 0.2s;
  }
  button.dark {
    background-color: var(--primary-darker);
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

  /* red */
  button.red:not(:disabled) {
    background-color: rgb(255 0 0 / 0.25);
  }
  button.red:hover:not(:disabled):not(.active) {
    background-color: rgb(255 0 0 / 0.35);
  }
  button.red:active:not(:disabled):not(.active),
  button.red:focus:not(:disabled):not(.active) {
    background-color: rgb(255 0 0 / 0.3);
  }
  button.red:not(:disabled) :global(svg) {
    fill: white;
  }

  button:not(:disabled):not(.active) {
    cursor: pointer;
  }
  button:hover:not(:disabled):not(.active) {
    background-color: var(--hover);
  }
  button:hover.brighterHover:not(:disabled):not(.active) {
    background-color: rgb(255 255 255 / 0.3);
  }
  button:hover.redHover:not(:disabled):not(.active) {
    background-color: rgb(255 0 0 / 0.3);
  }
  button:active:not(:disabled):not(.active),
  button:focus:not(.active) {
    background-color: var(--focus);
  }
  button.active {
    /* background-color: var(--secondary-opacity); */
    /* background-color: var(--primary-darkest); */
    background-color: var(--primary-darker);
    color: var(--secondary-text);
    outline: none;
  }
  button.dark.active {
    background-color: var(--primary-darkest);
  }
  button.active.border {
    outline-offset: -2px;
    /* outline: 2px solid var(--secondary); */
    outline: 2px solid var(--primary-lighter);
  }

  button :global(div) {
    padding-left: 0.8em;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow-x: hidden;
    line-height: 150%;
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
