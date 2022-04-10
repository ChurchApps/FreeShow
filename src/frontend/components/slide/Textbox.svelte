<script lang="ts">
  import type { Item } from "../../../types/Show"
  import Icon from "../helpers/Icon.svelte"
  import Timer from "./views/Timer.svelte"

  export let item: Item
  export let ratio: number = 1
  export let smallFontSize: boolean = false
  export let ref: { type?: "show" | "stage" | "overlay" | "template"; showId?: string; id: string }
  export let style: boolean = true
</script>

<div class="item" style={style ? item?.style : null}>
  {#if item?.lines}
    <div class="align" style={style ? item.align : null}>
      <div class="lines">
        {#each item.lines as line}
          <div class="break" class:smallFontSize style={style ? line.align : null} class:height={!line.text[0].value.length}>
            {#each line.text as text}
              <span style={style ? text.style : null}>{@html text.value}</span>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  {:else if item?.type === "timer"}
    <Timer {item} {ref} />
  {:else if item?.type === "icon"}
    <Icon style="zoom: {1 / ratio};" id={item.id || ""} fill white custom />
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
    /* line-height: normal; */

    font-size: 0;
    /* height: 100%; */

    overflow-wrap: break-word;
    /* line-break: after-white-space;
    -webkit-line-break: after-white-space; */
  }

  .item :global(.wj) {
    color: #ff5050;
  }

  /* span {
    display: inline;
    white-space: initial;
    color: white;
  } */

  .break :global(span) {
    font-size: 100px;
  }
  .break.smallFontSize :global(span) {
    font-size: 30px;
  }

  .height {
    height: 1em;
  }
</style>
