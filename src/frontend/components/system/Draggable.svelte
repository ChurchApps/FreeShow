<script lang="ts">
  import { dragged } from "../../stores"

  export let id: string
  export let data: string = ""
  export let type: "copy" | "move" | "link" = "move"
  export let hover: boolean = false
  export let side: "left" | "right" = "left" // "top" | "bottom"
  export let direction: "row" | "column" = "row"

  const dragstart = (e: any) => {
    e.dataTransfer.effectAllowed = type
    e.dataTransfer.dropEffect = type
    e.dataTransfer.setData("text", data)
    dragged.set(id)
  }
</script>

<div
  {id}
  draggable={true}
  on:dragstart={dragstart}
  on:drop|preventDefault
  on:dragover|preventDefault
  on:dragenter
  class:hovering={hover}
  class:left={hover && side === "left"}
  class:right={hover && side === "right"}
  class:column={direction === "column"}
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
</style>
