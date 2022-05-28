<script lang="ts">
  import { activeStage, stageShows, timers } from "../../../stores"
  import { keysToID } from "../../helpers/array"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Panel from "../../system/Panel.svelte"
  import { updateStageShow } from "../stage"

  const titles = {
    slide: ["current_slide_text", "current_slide", "current_slide_notes", "next_slide_text", "next_slide", "next_slide_notes"],
    time: ["system_clock", "video_time", "video_countdown"],
    global_timers: ["{timers}"],
    other: ["chords", "message"],
  }

  let enabledItems: any
  $: enabledItems = $activeStage.id ? $stageShows[$activeStage.id].items : []
  function click(item: string) {
    if (!$activeStage.id) return

    stageShows.update((ss) => {
      if (!enabledItems[item]) enabledItems[item] = { enabled: true, style: "width: 200px;height: 100px;", align: "" }
      else if (enabledItems[item].enabled) enabledItems[item].enabled = false
      else enabledItems[item].enabled = true
      return ss
    })

    if (!timeout) {
      updateStageShow()
      timeout = setTimeout(() => {
        updateStageShow()
        timeout = null
      }, 500)
    }
  }

  let timeout: any = null

  let timersList: any[] = []
  $: if (Object.keys($timers).length) timersList = keysToID($timers)
</script>

<div class="main">
  <Panel>
    {#each Object.entries(titles) as [title, items], i}
      {#if i > 0}<hr />{/if}
      <h6><T id="stage.{title}" /></h6>

      {#if title === "global_timers"}
        {#each timersList as timer}
          <Button on:click={() => click(title + "#" + timer.name)} active={enabledItems[title + "#" + timer.name]?.enabled} style="width: 100%;">
            <Icon id="timer" right />
            <span class="overflow">{timer.name}</span>
          </Button>
        {/each}
      {:else}
        {#each items as item}
          <Button on:click={() => click(title + "#" + item)} active={enabledItems[title + "#" + item]?.enabled} style="width: 100%;">
            <Icon id={item.split("_")[item.split("_").length - 1]} right />
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
