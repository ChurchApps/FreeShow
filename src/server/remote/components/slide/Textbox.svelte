<script lang="ts">
    import type { Item } from "../../../../types/Show"

    export let item: Item

    $: lineGap = item?.specialStyle?.lineGap
    $: lineBg = item?.specialStyle?.lineBg
</script>

<div class="item" style={item.style}>
    {#if item.lines}
        <div class="align" style={item.align}>
            <div class="lines" style={lineGap ? `gap: ${lineGap}px;` : ""}>
                {#each item.lines as line}
                    <div class="break" style="{lineBg ? `background-color: ${lineBg};` : ''}{line.align}">
                        {#each line.text || [] as text}
                            <span style={text.style}>{@html text.value.replaceAll("\n", "<br>") || "<br>"}</span>
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

        display: flex;
        flex-direction: column;
        text-align: center;
        justify-content: center;
    }

    .break {
        width: 100%;

        /* height: 100%; */

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
</style>
