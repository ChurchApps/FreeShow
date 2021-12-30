<script lang="ts">
  import { activeStage, stageShows } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Panel from "../../system/Panel.svelte"

  const titles = {
    slide: ["current_slide_text", "current_slide", "current_slide_notes", "next_slide_text", "next_slide", "next_slide_notes"],
    timers: ["system_clock", "video_time", "video_countdown"],
    countdowns: ["{countdowns}"],
    other: ["chords", "message"],
  }

  $: enabledItems = $stageShows[$activeStage.id!].items
  function click(item: string) {
    stageShows.update((ss) => {
      if (!enabledItems[item]) enabledItems[item] = { enabled: true, style: "", align: "" }
      else if (enabledItems[item].enabled) enabledItems[item].enabled = false
      else enabledItems[item].enabled = true
      return ss
    })
  }

  $: countdowns = ["test"]
</script>

<div class="main">
  <Panel>
    {#each Object.entries(titles) as [title, items], i}
      {#if i > 0}<hr />{/if}
      <h6><T id="stage.{title}" /></h6>

      {#if title === "countdowns"}
        {#each countdowns as item}
          <Button on:click={() => click(title + "#" + item)} active={enabledItems[title + "#" + item]?.enabled} style="width: 100%;">
            <Icon id="countdown" />
            <span class="overflow">{item}</span>
          </Button>
        {/each}
      {:else}
        {#each items as item}
          <Button on:click={() => click(title + "#" + item)} active={enabledItems[title + "#" + item]?.enabled} style="width: 100%;">
            <Icon id={item.split("_")[item.split("_").length - 1]} />
            <span class="overflow"><T id="stage.{item}" /></span>
          </Button>
        {/each}
      {/if}
    {/each}
  </Panel>
</div>

<style>
  .main :global(button.active) {
    color: var(--secondary);
  }

  .overflow {
    text-overflow: ellipsis;
    overflow: hidden;
    /* white-space: nowrap; */
  }
</style>
