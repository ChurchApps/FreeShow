<script lang="ts">
  import { createEventDispatcher } from "svelte"
  import T from "../../helpers/T.svelte"

  export let value: string
  // convert from old value
  value = value.replaceAll("<br>", "\n")

  const TIME = 100
  let dispatch = createEventDispatcher()
  let timeout: any = null

  function input() {
    if (timeout !== null) return
    timeout = setTimeout(() => {
      dispatch("edit", value)
      timeout = null
    }, TIME)
  }

  function change() {
    dispatch("change", value)
  }
</script>

<div class="paper">
  {#if !value.length}
    <div class="empty">
      <T id="empty.text" />...
    </div>
  {/if}
  <textarea class="edit" name="" id="" cols="1" rows="4" style={$$props.style || ""} bind:value on:input={input} on:change={change} />
</div>

<style>
  .paper {
    /* background-color: white;
    color: black; */
    /* overflow-y: auto; */
    /* display: flex; */
    flex: 1;
    height: 100%;
    overflow: hidden;
    /* box-shadow: inset 0 0 10px 0px rgb(0 0 0 / 30%); */
  }

  .edit {
    height: 100%;
    width: 100%;
    padding: 10px;
    outline: none;
    border: none;
    color: inherit;
    font-size: inherit;
    font-family: inherit;
    background-color: inherit;
    resize: none;
  }

  .empty {
    position: absolute;
    pointer-events: none;
    padding: 10px;
    opacity: 0.5;
  }
</style>
