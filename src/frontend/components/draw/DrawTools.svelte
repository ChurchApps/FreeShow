<script lang="ts">
    import type { DrawTools } from "../../../types/Draw"
    import { drawTool } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"

    const tools: DrawTools[] = ["focus", "pointer", "particles", "fill", "paint"]
    // TODO: zoom tool

    function keydown(e: any) {
        if (e.ctrlKey || e.metaKey) return

        let nextTab = -1
        let currentTabIndex = tools.findIndex((tab) => tab === $drawTool)

        if (e.key === "ArrowDown") {
            nextTab = Math.min(tools.length - 1, currentTabIndex + 1)
        } else if (e.key === "ArrowUp") {
            nextTab = Math.max(0, currentTabIndex - 1)
        }

        if (nextTab < 0) return
        drawTool.set(tools[nextTab])
    }
</script>

<svelte:window on:keydown={keydown} />

<div class="main">
    {#each tools as tool}
        <Button id="button" on:click={() => drawTool.set(tool)} active={$drawTool === tool} bold={false}>
            <Icon id={tool} right />
            <p style="margin: 5px;"><T id="draw.{tool}" /></p>
        </Button>
    {/each}
</div>

<style>
    .main :global(#button) {
        padding: 0.3em 0.8em;
        width: 100%;
    }

    .main :global(button:nth-child(even)) {
        background-color: rgb(0 0 20 / 0.08);
    }
</style>
