<input id={$$props.id} type="checkbox" style={$$props.style} checked={$$props.checked || false} on:change />

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
</style>
