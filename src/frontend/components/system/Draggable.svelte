<script lang="ts">
  export let hovering: null | number
  export let index: number

  const dragstart = (event: any, _i: number) => {
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.dropEffect = "move"
    // event.dataTransfer.setData("text/plain", i)
    // console.log(event)
  }
  // $: console.log(hovering, index)
</script>

<div
  draggable={true}
  on:dragstart={(event) => dragstart(event, index)}
  on:drop|preventDefault
  on:dragover|preventDefault
  on:dragenter={(e) => {
    hovering = index
    console.log(e)
  }}
>
  <slot />
</div>
