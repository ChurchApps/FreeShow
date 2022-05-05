<script lang="ts">
  import { createEventDispatcher } from "svelte"
  import { activeRename, dictionary } from "../../stores"

  export let value: string = ""
  export let id: string
  export let allowEmpty: boolean = true

  $: value = edit ? (value.endsWith(" ") ? removeWhitespace(value) + " " : removeWhitespace(value)) : value.trim()

  $: console.log(edit, value, value.endsWith(" "), removeWhitespace(value))

  const removeWhitespace = (v: string) =>
    v
      .split(" ")
      .filter((n) => n)
      .join(" ")

  let nameElem: HTMLParagraphElement, inputElem: HTMLInputElement
  export let edit: boolean = false
  let prevVal: string = ""
  $: if (!edit && !value.length && prevVal.length) value = prevVal
  const click = (e: any) => {
    if (e.target === nameElem) {
      //  || e.target.closest(".contextMenu")
      edit = true
      prevVal = value
      setTimeout(() => inputElem?.focus(), 10)
    } else if (e.target !== inputElem) {
      edit = false
      activeRename.set(null)
    }
  }

  $: if ($activeRename === id) {
    edit = true
    setTimeout(() => inputElem?.focus(), 10)
    // prevVal = value
  }

  let timeout: any
  function mousedown(e: any) {
    if (e.target === nameElem) {
      timeout = setTimeout(() => {
        click(e)
      }, 500)
    } else if (e.target !== inputElem) {
      edit = false
      activeRename.set(null)
    }
  }

  const dispatch = createEventDispatcher()
  function change(e: any) {
    let value = e.target.value
    if (allowEmpty || value.length) dispatch("edit", { value })
  }
</script>

<svelte:window
  on:mousedown={mousedown}
  on:mouseup={() => clearTimeout(timeout)}
  on:dragstart={() => clearTimeout(timeout)}
  on:keydown={(e) => {
    if (e.key === "Enter" || e.key === "Tab") {
      edit = false
      activeRename.set(null)
    }
  }}
/>
<!-- on:contextmenu={click} -->

{#if edit}
  <input bind:this={inputElem} on:change={change} class="edit nocontext _rename name" bind:value />
{:else}
  <p bind:this={nameElem} class="_rename">
    {#if value.length}
      {value}
    {:else}
      <span style="opacity: 0.5; pointer-events: none;">{$dictionary.main?.unnamed}</span>
    {/if}
  </p>
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
