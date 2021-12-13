<input type="text" bind:value={$$props.value} style={$$props.style} class:center={$$props.center} on:input on:change />

<style>
  input {
    background-color: var(--primary-darker);
    color: var(--text);
    height: 100%;
    width: 100%;
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    border: 0;
    outline-offset: -2px;
  }
  input.center {
    text-align: center;
  }
  input:hover {
    background-color: var(--hover);
  }
</style>
