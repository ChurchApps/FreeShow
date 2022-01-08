<script lang="ts">
  import type { SelectIds } from "../../../types/Main"

  import { drag, selected } from "../../stores"

  export let id: SelectIds
  export let index: null | number = null
  // export let data: string = ""
  export let type: "copy" | "move" | "link" = "move"
  export let direction: "row" | "column" = "row"
  export let fill: boolean = false
  // export let side: "left" | "right" = "left" // "top" | "bottom"
  $: side = $drag.side
  $: hover = $drag.index === null ? false : $selected.id === id && $drag.index === index

  // TODO: acting weird without ctrlKey

  const dragstart = (e: any) => {
    e.dataTransfer.effectAllowed = type
    e.dataTransfer.dropEffect = type
    // e.dataTransfer.setData("text", data)

    // if ($selected.id !== id) {
    //   // selected.set({ id, elems: [] })
    //   drag.set({ id: null, index: null, side: "left" })
    //   // selected.set({ id, data })
    // } else drag.set({ id: $selected.id, index: null, side: "left" })
  }

  // TODO: change side based on current side onmousemove
  const dragenter = (e: any) => {
    if (direction === "row") {
      if (e.offsetX < e.target.offsetWidth / 2) side = "right"
      else side = "left"
    } else {
      if (e.offsetY < e.target.offsetHeight / 2) side = "right"
      else side = "left"
    }

    // TODO: ONLY projects not drawer for show, not slide groups
    // AND slides
    // if ($drag.id === "slide" || $drag.id === "slideGroup")
    if ($selected.id === "slide" || $selected.id === "show") {
      // project
      drag.update((d) => {
        d.id = id
        d.index = index
        return d
      })
    }
  }

  // TODO: get media (files)
  // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop

  // const mousedown = (e: any) => {
  //   if ($selected.id === null) {
  //     selected.update((s) => {
  //       s.id = id
  //       return s
  //     })
  //   }
  //   if (index !== null) {
  //     if (e.ctrlKey && $selected.id === id) {
  //       if ($selected.elems.includes(index)) {
  //         selected.update((s) => {
  //           s.elems = removeData(s.elems, index)
  //           return s
  //         })
  //       } else {
  //         selected.update((s) => {
  //           s.elems = [...s.elems, index]
  //           return s
  //         })
  //       }
  //     } else {
  //       selected.update((s) => {
  //         s.elems = [index]
  //         return s
  //       })
  //     }
  //   }
  // }
  // $: console.log($selected.id, id, $selected.elems, index)
</script>

<div
  {id}
  style={$$props.style}
  class="draggable"
  data-index={index}
  draggable={true}
  on:dragstart={dragstart}
  on:dragenter={dragenter}
  class:fill
  class:hovering={hover}
  class:left={hover && side === "left"}
  class:right={hover && side === "right"}
  class:column={direction === "column"}
  class:selected={index === null ? false : $selected.id === id && $selected.elems?.includes(index)}
>
  <slot />
</div>

<style>
  .hovering {
    filter: contrast(0.8);
  }

  .hovering::after {
    content: "";
    position: absolute;
    top: 0;
    width: 4px;
    height: 100%;
    margin: 0 3px;
    pointer-events: none;
    background-color: var(--secondary);
  }

  .hovering.right::after {
    right: -10px;
  }
  .hovering.left::after {
    left: -10px;
  }

  /* TODO: no line on selected slide hover */
  .column.hovering::after {
    left: 0;
    width: 100%;
    height: 4px;
    margin: 3px 0;
  }

  .column.hovering.right::after {
    top: -10px;
  }
  .column.hovering.left::after {
    top: unset;
    bottom: -10px;
  }

  .fill {
    width: 100%;
    height: 100%;
  }
</style>
