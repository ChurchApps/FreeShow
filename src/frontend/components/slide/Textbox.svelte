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
    border: 1px dashed var(--secondary-opacity); /* DEBUG */

    position: absolute;
    /* display: inline-flex; */
  }

  p {
    display: inline;
    color: white;
  }
</style>
