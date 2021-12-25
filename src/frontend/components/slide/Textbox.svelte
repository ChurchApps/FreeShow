<script lang="ts">
  import type { Item } from "../../../types/Show"

  export let item: Item
</script>

<div class="item" style={item.style}>
  {#if item.text}
    <div class="align" style={item.align}>
      <div style="width: 100%;">
        {#each item.text as text}
          <p style={text.style}>{text.value}</p>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .item {
    /* border: 1px dashed var(--secondary-opacity); */

    /* display: inline-flex; */
    position: absolute;
    overflow: hidden;
    display: flex;

    font-family: "CMGSans";
    line-height: 1;
    -webkit-text-stroke-color: #000000;
    text-shadow: 2px 2px 10px #000000;
  }

  .align {
    height: 100%;
    display: flex;
    text-align: center;
    align-items: center;
  }

  p {
    display: inline;
    white-space: initial;
    color: white;
  }
</style>
