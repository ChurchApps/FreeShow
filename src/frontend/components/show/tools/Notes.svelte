<script lang="ts">
  import { createEventDispatcher } from "svelte"

  export let value: string
  let time = 100

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
    box-shadow: inset 0 0 10px 0px rgb(0 0 0 / 30%);
  }

  .edit {
    height: 100%;
    padding: 10px;
    outline: none;
  }
</style>
