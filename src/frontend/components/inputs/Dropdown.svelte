<script lang="ts">
  import { slide } from "svelte/transition"
  import { createEventDispatcher } from "svelte"
  import { translate } from "../../utils/language"
  import { language } from "../../stores"
  import type { Option } from "../../../types/Main"

  const dispatch = createEventDispatcher()
  export let options: Option[]
  export let disabled: boolean = false
  let active: boolean = false
  export let value: any
  if (!value) value = options[0]?.name || "—"
  $: updater = [value, $language]
  // TODO: disable active on click anywhere

  let self: HTMLDivElement

  function wheel(e: any) {
    if (disabled) return
    e.preventDefault()
    let index = options.findIndex((a) => a.name === (value.name || value))
    if (e.deltaY > 0) index = Math.min(options.length - 1, index + 1)
    else index = Math.max(0, index - 1)
    dispatch("click", options[index])
  }
</script>

<svelte:window
  on:mousedown={(e) => {
    if (e.target?.closest(".dropdownElem") !== self && active) {
      active = false
    }
  }}
/>

<div class:disabled bind:this={self} class="dropdownElem" style="position: relative;{$$props.style || ''}">
  <button on:click={() => (disabled ? null : (active = !active))} on:wheel={wheel}>
    {translate(updater[0], { parts: true }) || value}
    <!-- <T id={value} /> -->
  </button>
  {#if active}
    <div class="dropdown" style={$$props.style || ""} transition:slide={{ duration: 200 }}>
      {#each options as option}
        <!-- {#if option.name !== value} -->
        <span
          on:click={() => {
            if (disabled) return
            dispatch("click", option)
            active = false
          }}
          class:active={option.name === value}
        >
          {translate(option.name, { parts: true }) || option.name}
          {#if option.extra}
            ({option.extra})
          {/if}
          <!-- <T id={option.name} /> -->
        </span>
        <!-- {/if} -->
      {/each}
    </div>
  {/if}
</div>

<style>
  div {
    /* width: fit-content;
    min-width: 200px; */
    background-color: var(--primary-darker);
    color: var(--text);
    /* position: relative; */
  }

  div.disabled {
    opacity: 0.5;
  }

  .dropdown {
    max-height: 300px;
    overflow: auto;
    /* position: absolute;
    width: 100%; */
    position: fixed;
    display: flex;
    flex-direction: column;
    border: 2px solid var(--primary-lighter);
    transform: translateY(-1px);
    /* transform: translateX(-25%); */
    z-index: 10;
  }

  button {
    /* width: 200px; */
    color: var(--text);
    border: 2px solid var(--primary-lighter);
    /* font-weight: bold; */
    text-align: left;
  }

  button,
  span {
    display: table;
    width: 100%;
    padding: 8px 12px;
    background-color: transparent;
    font-family: inherit;
    /* text-transform: uppercase; */
    font-size: 1em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  button:hover:not(.disabled button),
  span:hover:not(.disabled span) {
    background-color: var(--hover);
  }
  span.active {
    background-color: var(--focus);
    color: var(--secondary);
  }
</style>
