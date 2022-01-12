<script lang="ts">
  import { selected } from "../../stores"
  import { ondrop, validateDrop } from "../helpers/drop"

  export let id: "slides" | "slide" | "shows" | "project" | "projects" | "drawer"
  export let selectChildren: boolean = false
  export let hoverTimeout: number = 500
  let active: boolean = false
  let hover: boolean = false

  $: active = validateDrop(id, $selected.id)

  let count: number = 0
  function enter() {
    if (active && selectChildren) {
      count++
      setTimeout(() => {
        if (count > 0) hover = false
      }, hoverTimeout)
    }
  }

  function leave(_e: any) {
    if (active && selectChildren) {
      count--
      setTimeout(() => {
        if (count === 0) hover = true
      }, 10)
    }
  }
</script>

<svelte:window
  on:dragend={() => {
    selected.set({ id: null, elems: [] })
    hover = false
  }}
  on:dragstart={() => (hover = active)}
/>

<div
  class="droparea"
  class:hover
  on:drop={(e) => {
    if (validateDrop(id, $selected.id, true)) ondrop(e, id)
  }}
  on:dragover|preventDefault
  on:dragenter={enter}
  on:dragleave={leave}
>
  <span class="ParentBlock">
    <slot />
  </span>
</div>
{#if hover}
  <span class="text">Drop here</span>
{/if}

<style>
  .droparea {
    flex: 1;
    height: 100%;
    width: 100%;
    align-self: flex-start;
    transition: 0.3s opacity;
  }
  .droparea.hover {
    opacity: 0.3;
    background-color: rgb(0 0 0 / 0.4);
  }
  .droparea.hover span {
    pointer-events: none;
  }

  .text {
    pointer-events: none;
    height: 100%;
    width: 100%;
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
