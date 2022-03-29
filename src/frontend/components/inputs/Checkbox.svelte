<input id={$$props.id} type="checkbox" disabled={$$props.disabled} style={$$props.style} checked={$$props.checked || false} on:change />

<style>
  input {
    padding: 10px;
    /* cursor: pointer; */
    background-color: var(--primary-lighter);

    -webkit-appearance: none;
    -moz-appearance: none;
    -o-appearance: none;
    appearance: none;
    /* outline: 2px solid lightblue; */
    /* box-shadow: none; */
  }
  input:not(:disabled) {
    cursor: pointer;
  }
  input:focus,
  input:active {
    background-color: var(--focus);
  }
  input:hover {
    background-color: var(--hover);
  }
  input:checked {
    background-color: var(--secondary);
  }
  input:disabled {
    opacity: 0.3;
  }
</style>
