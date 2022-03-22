<script lang="ts">
  import type { SelectIds } from "../../../types/Main"
  import { selected } from "../../stores"
  import { arrayHasData } from "../helpers/array"

  export let id: SelectIds
  export let data: any
  export let fill: boolean = false
  export let draggable: boolean = false
  export let trigger: null | "row" | "column" = null
  export let fileOver: boolean = false
  export let borders: "all" | "center" | "edges" = "all"

  function enter(e: any) {
    if (e.buttons && !dragActive) {
      if ((id === "project" || id === "folder") && data.index && $selected.data[0]?.index && data.index < $selected.data[0].index) return
      if ($selected.id !== id) selected.set({ id, data: [data] })
      else if (!arrayHasData($selected.data, data)) {
        selected.update((s) => {
          s.data = [...s.data, data]
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

    if ((id === "project" || id === "folder") && data.index && $selected.data[0]?.index && data.index < $selected.data[0].index) return

    let newData: any

    if ((dragged || e.buttons === 2) && ($selected.id !== id || !arrayHasData($selected.data, data))) {
      newData = [data]
    } else if (!dragged && (e.ctrlKey || e.metaKey)) {
      if ($selected.id === id && arrayHasData($selected.data, data)) newData = $selected.data.filter((a: any) => JSON.stringify(a) !== JSON.stringify(data))
      else if ($selected.id === id) newData = [...$selected.data, data]
      else newData = [data]
    }

    if (newData) selected.set({ id, data: newData })
  }

  function deselect(e: any) {
    if (
      !e.ctrlKey &&
      !e.metaKey &&
      $selected.id === id &&
      !e.target.closest(".selectElem") &&
      !e.target.closest(".popup") &&
      !e.target.closest(".edit") &&
      !e.target.closest(".contextMenu")
    )
      selected.set({ id: null, data: [] })
  }

  let dragover: null | "start" | "center" | "end" = null
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
    if ($selected.id !== id) selected.set({ id, data: [] })
  }}
/>

<div
  data={JSON.stringify(data)}
  {draggable}
  style={$$props.style}
  class="selectElem"
  class:fill
  class:isSelected={$selected.id === id && arrayHasData($selected.data, data)}
  on:mouseenter={enter}
  on:mousedown={mousedown}
  on:dragstart={(e) => mousedown(e, true)}
>
  <!-- TODO: validateDrop(id, $selected.id, true) -->
  {#if trigger && (dragActive || fileOver)}
    <div class="trigger {trigger} {dragover ? dragover : ''}" style="flex-direction: {trigger};" on:dragleave={() => (dragover = null)}>
      {#if borders === "all" || borders === "edges"}
        <span id="start" class="TriggerBlock" on:dragover={() => (dragover = "start")} />
      {/if}
      {#if borders === "all" || borders === "center"}
        <span id="start_center" class="TriggerBlock" on:dragover={() => (dragover = "center")} />
        <span id="end_center" class="TriggerBlock" on:dragover={() => (dragover = "center")} />
      {/if}
      {#if borders === "all" || borders === "edges"}
        <span id="end" class="TriggerBlock" on:dragover={() => (dragover = "end")} />
      {/if}
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
    filter: contrast(0.7);
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
  .trigger.center {
    border-width: 2px;
  }

  .trigger span {
    width: 100%;
    height: 100%;
  }
</style>
