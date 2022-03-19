<script lang="ts">
  import { createEventDispatcher } from "svelte"
  import T from "../../helpers/T.svelte"

  export let value: string

  const TIME = 100
  let dispatch = createEventDispatcher()
  let timeout: any = null

  let content: any
  let updatedValue: string = value

  function keydown(e: any) {
    if (timeout !== null) return

    timeout = setTimeout(() => {
      dispatch("edit", e.target.innerHTML)
      timeout = null
    }, TIME)
  }
</script>

<!-- bind:innerHTML={value} -->
<div class="paper">
  {#if !updatedValue.length}
    <div class="empty">
      <T id="empty.text" />...
    </div>
  {/if}
  <div bind:this={content} class="edit" contenteditable="true" on:keydown={keydown} on:keyup={() => (updatedValue = content.innerText)}>
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
    /* box-shadow: inset 0 0 10px 0px rgb(0 0 0 / 30%); */
  }

  .edit {
    height: 100%;
    padding: 10px;
    outline: none;
  }

  .empty {
    position: absolute;
    pointer-events: none;
    padding: 10px;
    opacity: 0.5;
  }
</style>
