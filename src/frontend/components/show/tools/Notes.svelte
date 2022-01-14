<script lang="ts">
  import { createEventDispatcher } from "svelte"

  export let value: string
  let time = 1000

  let dispatch = createEventDispatcher()
  let timeout: any = null
  function keydown(e: any) {
    if (timeout === null) {
      timeout = setTimeout(() => {
        dispatch("edit", e.target.innerHTML)
        timeout = null
      }, time)
    }
  }
</script>

<!-- bind:innerHTML={value} -->
<div class="paper">
  <div class="edit" contenteditable="true" on:keydown={keydown}>
    {@html value}
  </div>
</div>

<style>
  .paper {
    /* background-color: white;
    color: black; */
    /* overflow-y: auto; */
    /* display: flex; */
    flex: 1;
    height: 100%;
  }

  .edit {
    height: 100%;
    padding: 10px;
    outline: none;
  }
</style>
