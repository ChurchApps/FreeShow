<script lang="ts">
    import { openToolsTab } from "../../stores"

    export let ratio: number = 1
    export let active: boolean

    let corners = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]
    let sides = ["n", "e", "s", "w"]
</script>

<section>
    {#each sides as line}
        <div on:mousedown={() => openToolsTab.set("item")} class="line {line}l" class:active style="{line === 'n' || line === 's' ? 'height' : 'width'}: {active ? 25 : 50}px;" />
    {/each}
    {#each corners as square}
        <div class="square {square}" class:active style="width: {10 / ratio}px; cursor: {square}-resize;" />
    {/each}
</section>

<style>
    .square {
        position: absolute;
        transform: translate(-50%, -50%);
        /* width: 15px;
    height: 15px; */
        aspect-ratio: 1/1;
        background-color: transparent;
        z-index: 2;
        /* border: 5px solid transparent; */
        /* outline: 1px solid white; */
        /* border-radius: 50%; */
    }
    .square.active {
        background-color: rgb(255 255 255 / 0.8);
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
</style>
