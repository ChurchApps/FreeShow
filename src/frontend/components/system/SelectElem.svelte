<script lang="ts">
  import type { SelectIds } from "../../../types/Main"
  import { selected } from "../../stores"
  import { arrayHasData } from "../helpers/array"

  export let id: SelectIds
  export let data: any
  export let fill: boolean = false
  export let draggable: boolean = false
  export let trigger: null | "row" | "column" = null

  function enter(e: any) {
    if (e.buttons && !dragActive) {
      if ($selected.id !== id) selected.set({ id, elems: [data] })
      else if (!arrayHasData($selected.elems, data)) {
        selected.update((s) => {
          s.elems = [...s.elems, data]
          return s
        })
      }
    }
  }

  function mousedown(e: any, dragged: boolean = false) {
    // let type: "copy" | "move" | "link" = "move"
    // e.dataTransfer.effectAllowed = type
    // e.dataTransfer.dropEffect = type
    // e.dataTransfer.setData("text", data)

    let elems: any

    if (dragged && ($selected.id !== id || !arrayHasData($selected.elems, data))) {
      elems = [data]
    } else if (!dragged && e.ctrlKey) {
      if ($selected.id === id && arrayHasData($selected.elems, data)) elems = elems.filter((a: any) => JSON.stringify(a) !== JSON.stringify(data))
      else if ($selected.id === id) elems = [...$selected.elems, data]
      else elems = [data]
    }

    if (elems) selected.set({ id, elems })
  }

  function deselect(e: any) {
    if (!e.ctrlKey && $selected.id === id && e.target.closest(".selectElem") === null) selected.set({ id: null, elems: [] })
  }

  let dragover: null | "start" | "end" = null
  let dragActive: boolean = false
</script>

<svelte:window
  on:mousedown={deselect}
  on:dragstart={() => {
    dragActive = true
  }}
  on:dragend={() => {
    dragActive = false
    dragover = null
    if ($selected.id !== id) selected.set({ id, elems: [] })
  }}
/>

<div
  data={JSON.stringify(data)}
  {draggable}
  style={$$props.style}
  class="selectElem"
  class:fill
  class:isSelected={$selected.id === id && arrayHasData($selected.elems, data)}
  on:mouseenter={enter}
  on:mousedown={mousedown}
  on:dragstart={(e) => mousedown(e, true)}
>
  <!-- TODO: validateDrop(id, $selected.id, true) -->
  {#if trigger && dragActive}
    <div class="trigger {trigger} {dragover ? dragover : ''}" style="flex-direction: {trigger};" on:dragleave={() => (dragover = null)}>
      <span id="start" class="TriggerBlock" on:dragover={() => (dragover = "start")} />
      <span id="end" class="TriggerBlock" on:dragover={() => (dragover = "end")} />
    </div>
  {/if}
  <slot />
</div>

<style>
  .selectElem {
    position: relative;
  }

  .isSelected {
    /* outline: 2px solid red;
    outline-offset: 2px; */
    filter: contrast(0.8);
    background-color: var(--focus);
  }

  .fill {
    width: 100%;
    height: 100%;
  }

  .trigger {
    display: flex;
    height: 100%;
    width: 100%;
    position: absolute;
    z-index: 1;
    border-style: solid;
    border-color: var(--secondary);
    border-width: 0px;
  }
  .trigger.column.start {
    border-top-width: 2px;
  }
  .trigger.column.end {
    border-bottom-width: 2px;
  }
  .trigger.row.start {
    border-left-width: 2px;
  }
  .trigger.row.end {
    border-right-width: 2px;
  }

  .trigger span {
    width: 100%;
    height: 100%;
  }
</style>
