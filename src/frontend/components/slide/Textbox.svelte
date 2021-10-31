<script lang="ts">
  import type { Item } from "../../../types/Show"

  export let item: Item
</script>

<div class="item" style={item.style}>
  {#if item.text}
    {#each item.text as text}
      <p style={text.style}>{text.value}</p>
    {/each}
  {/if}
</div>

<style>
  .item {
    /* border: 1px dashed var(--secondary-opacity); */

    /* display: inline-flex; */
    position: absolute;
    overflow: hidden;
  }

  p {
    display: inline;
    white-space: initial;
    color: white;
  }
</style>
