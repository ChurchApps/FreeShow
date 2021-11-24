<script lang="ts">
  export let value: string
  // let updated: string = value
</script>

<div class="paper">
  <div class="edit" contenteditable="true" on:keydown bind:innerHTML={value} />
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
