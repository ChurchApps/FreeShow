<script lang="ts">
  export let value: string
  let nameElem, inputElem
  let edit = false
  const click = (e) => {
    if (e.target === nameElem) {
      edit = true
      setTimeout(() => inputElem?.focus(), 10)
    } else if (e.target !== inputElem) edit = false
  }
</script>

<svelte:window
  on:mousedown={click}
  on:keydown={(e) => {
    if (e.key === "Enter" || e.key === "Tab") edit = false
  }}
/>

{#if edit}
  <input bind:this={inputElem} class="name" bind:value />
{:else}
  <p bind:this={nameElem} class="name">{value}</p>
{/if}

<style>
  p {
    margin: 5px;
    cursor: text;
  }
  input {
    padding: 5px;
    font-weight: inherit;
    font-size: inherit;
    background-color: var(--hover);
    color: inherit;
    border: none;
    width: 100%;
  }
</style>
