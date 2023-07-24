<script lang="ts">
    import type { DrawTools } from "../../../types/Draw"
    import { drawTool } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"

    const tools: DrawTools[] = ["focus", "pointer", "particles", "fill", "paint"]
    // TODO: zoom tool
</script>

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
