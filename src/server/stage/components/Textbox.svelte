<script lang="ts">
  import type { Item } from "../../../types/Show"

  export let item: Item
  export let style: boolean = true

  let height: number = 0
  $: autoSize = item.lines ? height / (item.lines.length + 3) : 0
</script>

<div class="item" style={style ? item.style : null} bind:offsetHeight={height}>
  {#if item.lines}
    <div class="align" style={style ? item.align : null}>
      <div class="lines">
        {#each item.lines as line}
          <div class="break" style={style ? line.align : null} class:height={!line.text[0]?.value.length}>
            {#each line.text as text}
              <span style={style ? text.style : "font-size: " + autoSize + "px;"}>{@html text.value}</span>
            {/each}
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

    /* height: 100%; */
    user-select: text;

    overflow-wrap: break-word;
    /* line-break: after-white-space;
    -webkit-line-break: after-white-space; */
  }

  /* span {
    display: inline;
    white-space: initial;
    color: white;
  } */

  .break :global(span) {
    font-size: 100px;
  }

  .height {
    height: 1em;
  }
</style>
