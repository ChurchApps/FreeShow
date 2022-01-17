<textarea class="edit" value={$$props.value} style={$$props.style} class:center={$$props.center} on:input />

<!-- <div class="edit" style={$$props.style} class:center={$$props.center} contenteditable>
  {$$props.value}
</div> -->
<style>
  textarea {
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
  textarea.center {
    text-align: center;
  }
  textarea:hover {
    background-color: var(--hover);
  }
</style>
