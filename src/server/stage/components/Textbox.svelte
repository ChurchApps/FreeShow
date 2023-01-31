<script lang="ts">
  import type { Item } from "../../../types/Show";
  import { getStyles } from "../helpers/style";
  import Chords from "./Chords.svelte";

  export let item: Item;
  export let style: boolean = true;
  export let chords: boolean = false;
  export let autoSize: number = 0;

  // dynamic resolution
  let resolution = { width: window.innerWidth, height: window.innerHeight };
  let itemStyle = item.style;
  let itemStyles: any = getStyles(item.style, true);
  // custom dynamic size
  let newSizes = `;
    top: ${Math.min(
      itemStyles.top,
      (itemStyles.top / 1080) * resolution.height
    )}px;
    left: ${Math.min(
      itemStyles.left,
      (itemStyles.left / 1920) * resolution.width
    )}px;
    width: ${Math.min(
      itemStyles.width,
      (itemStyles.width / 1920) * resolution.width
    )}px;
    height: ${Math.min(
      itemStyles.height,
      (itemStyles.height / 1080) * resolution.height
    )}px;
  `;
  itemStyle = itemStyle + newSizes;

  // TODO: use autoSize.ts
  // let height: number = 0
  // $: lineCount =
  //   item.lines?.reduce((count, line) => {
  //     let fullText = line.text.map((text) => text.value).join("")
  //     let lineBreaks = Math.ceil(fullText.length / 40)
  //     return count + lineBreaks
  //   }, 0) || 0
  // // $: autoSize = item.lines ? height / (item.lines.length + 3) : 0
  // $: autoSize = item.lines ? height / (lineCount + 3) : 0

  let textElem: any = null;
</script>

<!-- bind:offsetHeight={height} -->
<div class="item" style={style ? itemStyle : null}>
  {#if item.lines}
    <div class="align" style={style ? item.align : null}>
      {#if chords}
        <Chords {item} {textElem} />
      {/if}
      <div class="lines" bind:this={textElem}>
        {#each item.lines as line}
          <div
            class="break"
            style={style ? line.align : null}
            class:height={!line.text[0]?.value.length}
          >
            {#each line.text as text}
              <span
                style={style ? text.style : "font-size: " + autoSize + "px;"}
                >{@html text.value}</span
              >
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
