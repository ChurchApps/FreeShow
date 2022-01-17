<script lang="ts">
  import type { Item } from "../../../types/Show"

  export let item: Item
</script>

<div class="item" style={item.style}>
  {#if item.text}
    <div class="align" style={item.align}>
      <div class="text">
        {#each item.text as text}
          <span style={text.style}>{@html text.value}</span>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .align {
    height: 100%;
    display: flex;
    text-align: center;
    align-items: center;
  }

  /* span {
    display: inline;
    white-space: initial;
    color: white;
  } */

  .text {
    width: 100%;
    /* height: 100%; */

    overflow-wrap: break-word;
    /* line-break: after-white-space;
    -webkit-line-break: after-white-space; */
  }
</style>
