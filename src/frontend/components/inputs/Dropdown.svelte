<script lang="ts">
  import { slide } from "svelte/transition"
  import { createEventDispatcher } from "svelte"
  import T from "../helpers/T.svelte"
  import { translate } from "../../utils/language"
  import { language } from "../../stores"
  import type { Option } from "../../../types/Main"

  const dispatch = createEventDispatcher()
  export let options: Option[]
  let active: boolean = false
  export let value: string
  if (!value) value = options[0].name || "Select"
  $: updater = [value, $language]
  // TODO: disable active on click anywhere

  let self: HTMLDivElement
</script>

<svelte:window
  on:mousedown={(e) => {
    if (e.target?.closest(".dropdownElem") !== self && active) {
      active = false
    }
  }}
/>

<div bind:this={self} class="dropdownElem">
  <button on:click={() => (active = !active)}>
    {translate(updater[0], { parts: true })}
    <T id={value} />
  </button>
  {#if active}
    <div class="dropdown" transition:slide={{ duration: 200 }}>
      {#each options as option}
        <!-- {#if option.name !== value} -->
        <span
          on:click={() => {
            dispatch("click", option)
            active = false
          }}
          class={option.name === value ? "active" : ""}
        >
          {translate(option.name, { parts: true })}
          <!-- <T id={option.name} /> -->
        </span>
        <!-- {/if} -->
      {/each}
    </div>
  {/if}
</div>

<style>
  div {
    width: fit-content;
    min-width: 200px;
    background-color: var(--primary);
    color: var(--text);
  }

  .dropdown {
    position: absolute;
    display: flex;
    flex-direction: column;
    border: 2px solid var(--secondary);
    max-width: 400px;
    transform: translateY(-1px);
    /* transform: translateX(-25%); */
    z-index: 10;
  }

  button {
    width: 200px;
    color: var(--secondary);
    border: 2px solid var(--secondary);
    font-weight: bold;
    text-align: left;
  }

  button,
  span {
    padding: 8px 12px;
    background-color: transparent;
    /* text-transform: uppercase; */
    font-size: 1em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  button:hover,
  span:hover {
    background-color: var(--hover);
  }
  span.active {
    background-color: var(--active);
  }
</style>
