<script lang="ts">
  import { selected, drag } from "../../stores"
  import { arrayHasData, removeData } from "../helpers/array"

  // import type SelectIds from "./SelectIds.svelte"

  export let id: any // WIP SelectIds
  export let data: any
  export let fill: boolean = false
  // let isSelected: boolean = false
  function enter(e: any) {
    if (e.buttons) {
      // isSelected = true
      console.log($selected.id, id)

      if ($selected.id !== id) selected.set({ id, elems: [data] })
      else {
        selected.update((s) => {
          s.elems = [...s.elems, data]
          return s
        })
      }
    }
  }

  // TODO: select mousedown.....
  function mousedown(e: any, dragged: boolean = false) {
    let elems: any

    if (dragged && ($selected.id !== id || !arrayHasData($selected.elems, data))) {
      elems = [data]
      console.log(elems)
    } else if (!dragged && e.ctrlKey) {
      if ($selected.id === id && arrayHasData($selected.elems, data)) {
        elems = removeData($selected.elems, data)
      } else if ($selected.id === id) {
        elems = [...$selected.elems, data]
      } else elems = [data]
    }

    if (elems) selected.set({ id, elems })
    if (dragged && $selected.elems.length) drag.set({ id, index: null, side: "left" })
  }

  function deselect(e: any) {
    // console.log(e.target.closest(".selectElem"))

    if (!e.ctrlKey && $selected.id === id && e.target.closest(".selectElem") === null) {
      selected.set({ id: null, elems: [] })
    }
  }
</script>

<svelte:window on:mousedown={deselect} />
<!-- on:dragend={() => {
    if ($selected.id !== id) selected.set({ id, elems: [] })
  }} -->

<div
  class:isSelected={$selected.id === id && arrayHasData($selected.elems, data)}
  style={$$props.style}
  class:fill
  class="selectElem"
  on:mouseenter={enter}
  on:mousedown={mousedown}
  on:dragstart={(e) => mousedown(e, true)}
>
  <slot />
</div>

<style>
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
</style>
