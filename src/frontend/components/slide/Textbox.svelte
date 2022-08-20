<script lang="ts">
  import { onMount } from "svelte"
  import type { Item } from "../../../types/Show"
  import Icon from "../helpers/Icon.svelte"
  import Timer from "./views/Timer.svelte"

  export let item: Item
  export let ratio: number = 1
  export let smallFontSize: boolean = false
  export let ref: { type?: "show" | "stage" | "overlay" | "template"; showId?: string; slideId?: string; id: string }
  export let style: boolean = true
  export let linesStart: null | number = null
  export let linesEnd: null | number = null

  let height: number = 0
  let width: number = 0
  $: autoSize = item.lines ? Math.min(height, width) / (item.lines.length + 3) : Math.min(height, width) / 2

  $: lines = item?.lines
  $: if (linesStart !== null && linesEnd !== null && lines?.length) lines = lines.filter((a) => a.text.filter((a) => a.value.length)?.length)

  // timer updater
  let today = new Date()
  onMount(() => {
    if (item.type !== "timer") return
    setInterval(() => (today = new Date()), 500)
  })

  $: if (item.type === "timer") ref.id = item.timer!.id!
</script>

<div class="item" style={style ? item?.style : null} bind:offsetHeight={height} bind:offsetWidth={width}>
  {#if lines}
    <div class="align" style={style ? item.align : null}>
      <div class="lines">
        {#each lines as line, i}
          {#if linesStart === null || linesEnd === null || (i >= linesStart && i < linesEnd)}
            <div class="break" class:smallFontSize style={style ? line.align : null} class:height={!line.text[0]?.value.length}>
              {#each line.text as text}
                <span style={style ? text.style : ref.type === "stage" ? "font-size: " + autoSize + "px;" : null}>{@html text.value}</span>
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {:else if item?.type === "timer"}
    {#key item.timer}
      <Timer {item} {ref} {today} style="font-size: {autoSize}px;" />
    {/key}
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
    min-height: 50px;
    /* display: inline-block; */
  }
  .break.smallFontSize :global(span) {
    font-size: 30px;
  }

  .height {
    height: 1em;
  }
</style>
