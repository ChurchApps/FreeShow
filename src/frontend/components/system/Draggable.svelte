<script lang="ts">
  import { dragged } from "../../stores"

  export let id: string
  export let data: string = ""
  export let type: "copy" | "move" | "link" = "move"

  const dragstart = (e: any) => {
    e.dataTransfer.effectAllowed = type
    e.dataTransfer.dropEffect = type
    e.dataTransfer.setData("text", data)
    dragged.set(id)
  }
</script>

<div {id} draggable={true} on:dragstart={dragstart} on:drop|preventDefault on:dragover|preventDefault on:dragenter>
  <slot />
</div>
