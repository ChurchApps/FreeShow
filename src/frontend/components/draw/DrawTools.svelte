<script lang="ts">
  import type { DrawTools } from "../../../types/Draw"
  import { drawTool } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"

  const tools: DrawTools[] = ["focus", "pointer", "fill", "paint"]
</script>

<div class="main">
  {#each tools as tool}
    <Button on:click={() => drawTool.set(tool)} active={$drawTool === tool} bold={false}>
      <Icon id={tool} />
      <T id="draw.{tool}" />
    </Button>
  {/each}
</div>

<style>
  .main :global(button) {
    padding: 20px;
    width: 100%;
  }
</style>
