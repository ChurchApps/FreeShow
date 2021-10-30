<script lang="ts">
  export let value: string
  $: value = edit ? (value.endsWith(" ") ? removeWhitespace(value) + " " : removeWhitespace(value)) : value.trim()

  const removeWhitespace = (v: string) =>
    v
      .split(" ")
      .filter((n) => n)
      .join(" ")

  let nameElem: HTMLParagraphElement, inputElem: HTMLInputElement
  let edit: boolean = false
  let prevVal: string = ""
  $: {
    if (!edit && !value.length && prevVal.length) value = prevVal
  }
  const click = (e: any) => {
    if (e.target === nameElem) {
      //  || e.target.closest(".contextMenu")
      edit = true
      prevVal = value
      setTimeout(() => inputElem?.focus(), 10)
    } else if (e.target !== inputElem) edit = false
  }

  let timeout: any
  function mousedown(e: any) {
    if (e.target === nameElem) {
      timeout = setTimeout(() => {
        click(e)
      }, 500)
    } else if (e.target !== inputElem) edit = false
  }
</script>

<svelte:window
  on:mousedown={mousedown}
  on:mouseup={() => clearTimeout(timeout)}
  on:contextmenu={click}
  on:keydown={(e) => {
    if (e.key === "Enter" || e.key === "Tab") edit = false
  }}
/>

{#if edit}
  <input bind:this={inputElem} class="name _context_rename" bind:value />
{:else}
  <p bind:this={nameElem} class="name _context_rename">{value}</p>
{/if}

<style>
  p {
    margin: 5px;
    /* cursor: text; */
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
