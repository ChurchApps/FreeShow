<script lang="ts">
  import type { Item } from "../../../types/Show"

  export let item: Item
</script>

<div class="item" style={item.style}>
  {#if item.lines}
    <div class="align" style={item.align}>
      <div class="lines">
        {#each item.lines as line}
          <div class="break" style={line.align} class:height={!line.text[0].value.length}>
            <div class="text">
              {#each line.text as text}
                <span style={text.style}>{@html text.value}</span>
              {/each}
            </div>
          </div>
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

  .lines {
    /* overflow-wrap: break-word;
  font-size: 0; */
    width: 100%;
  }

  .break {
    width: 100%;
  }

  /* span {
    display: inline;
    white-space: initial;
    color: white;
  } */

  .text {
    width: 100%;
    font-size: 0;
    /* height: 100%; */

    overflow-wrap: break-word;
    /* line-break: after-white-space;
    -webkit-line-break: after-white-space; */
  }

  .text :global(span) {
    font-size: 100px;
  }

  .height {
    height: 1em;
  }
</style>
