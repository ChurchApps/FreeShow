<script lang="ts">
    import { openToolsTab } from "../../stores"
    import { getStyles } from "../helpers/style"
    import { radiusSliderOffset, radiusSliderRatio } from "./textbox"

    export let ratio = 1
    export let itemStyle = ""
    export let active: boolean
    export let onlyCorners = false

    let corners = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]
    let sides = ["n", "e", "s", "w"]

    $: styles = getStyles(itemStyle, true)

    // WIP radius icon should be max styles.width and relative to height (max possible radius)
</script>

<section class="hideFromAutosize">
    {#each sides as line}
        <div class="line {line}l" class:active style="{line === 'n' || line === 's' ? 'height' : 'width'}: {active ? 25 : 50}px;" />
    {/each}
    {#each corners as square}
        {#if !onlyCorners || square.length > 1}
            <div on:mousedown={() => openToolsTab.set("item")} class="square {square}" class:active style="width: {10 / ratio}px; cursor: {square}-resize;" />
        {/if}
    {/each}
    <div class="rotate" style="width: {8 / ratio}px;--line-width: {3 / ratio}px;" class:active></div>
    <div class="radius" style="width: {6 / ratio}px;left: {(Number(styles['border-radius']) || 0) * radiusSliderRatio + radiusSliderOffset}px;" class:active></div>
</section>

<style>
    /* stylelint-disable csstools/use-logical */
    .square {
        position: absolute;
        transform: translate(-50%, -50%);
        /* width: 15px;
    height: 15px; */
        aspect-ratio: 1/1;
        background-color: transparent;
        z-index: 3;

        /* border: 5px solid transparent; */
        /* outline: 1px solid white; */
        /* border-radius: 50%; */
    }
    .square.active {
        background-color: rgb(255 255 255 / 0.8);
        border: 0.5px solid rgb(0 0 0 / 0.8);
    }
    .nw,
    .n,
    .ne {
        top: 0;
    }
    .e,
    .w {
        top: 50%;
    }
    .se,
    .s,
    .sw {
        top: 100%;
    }
    .nw,
    .sw,
    .w {
        left: 0;
    }
    .n,
    .s {
        left: 50%;
    }
    .ne,
    .e,
    .se {
        left: 100%;
    }

    .line {
        position: absolute;
        background-color: transparent;
        cursor: move;
        z-index: 1;
    }
    /* .line.invisible {
    background-color: transparent;
    cursor: move;
  } */
    /* .line::after {
    content: "";
    background-color: red;
    position: absolute;
    left: 0;
    width: 100%;
    height: 100%;
    cursor: move;
  } */

    .nl {
        top: 0;
        left: 0;
        width: 100%;
        /* height: lineWidth; */
        transform: translateY(-50%);
    }
    .el {
        top: 0;
        left: 100%;
        /* width: lineWidth; */
        height: 100%;
        transform: translateX(-50%);
    }
    .sl {
        top: 100%;
        left: 0;
        /* height: lineWidth; */
        width: 100%;
        transform: translateY(-50%);
    }
    .wl {
        top: 0;
        left: 0;
        /* width: lineWidth; */
        height: 100%;
        transform: translateX(-50%);
    }

    .active.nl {
        transform: translateY(-100%);
    }
    .active.el {
        transform: none;
    }
    .active.sl {
        transform: none;
    }
    .active.wl {
        transform: translateX(-100%);
    }

    .rotate {
        position: absolute;
        left: 50%;
        top: -45px;
        transform: translate(-50%, -50%);

        background-color: rgb(255 255 255 / 0.8);
        border: 0.5px solid rgb(0 0 0 / 0.8);
        aspect-ratio: 1/1;
        border-radius: 50%;
        z-index: 2;

        cursor: crosshair;
        /* cursor: pointer; */

        opacity: 0;
    }
    .rotate.active {
        opacity: 1;
    }
    .rotate::after {
        content: "";

        position: absolute;
        left: 50%;
        bottom: 0;
        transform: translate(-50%, 100%);

        height: 45px;
        width: var(--line-width);

        background-color: var(--secondary-opacity);
        /* border-right: 4px solid var(--secondary);
        border-right-style: dashed; */
    }

    .radius {
        position: absolute;
        left: 20px;
        top: 0;

        background-color: rgb(255 255 255 / 0.8);
        border: 0.5px solid rgb(0 0 0 / 0.8);
        aspect-ratio: 1/1;
        transform: translateY(-50%) rotate(45deg);
        z-index: 2;

        cursor: pointer;

        opacity: 0;
    }
    .radius.active {
        opacity: 1;
    }
    /* stylelint-enable csstools/use-logical */
</style>
