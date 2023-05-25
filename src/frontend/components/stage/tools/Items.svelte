<script lang="ts">
    import { activeStage, stageShows, timers } from "../../../stores"
    import { keysToID } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { getResolution } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Panel from "../../system/Panel.svelte"
    import { updateStageShow } from "../stage"

    // TODO: more stage features
    const titles = {
        // slide_background ++
        slide: ["current_slide_text", "current_slide", "current_slide_notes", "next_slide_text", "next_slide", "next_slide_notes"],
        time: ["system_clock"], // , "video_time", "video_countdown"
        global_timers: ["{timers}"],
        // other: ["chords", "message"],
    }

    let enabledItems: any
    $: enabledItems = $activeStage.id ? $stageShows[$activeStage.id].items : []
    function click(item: string) {
        if (!$activeStage.id) return

        let resolution = getResolution()
        let style = `
      width: ${resolution.width / 2}px;
      height: ${resolution.height / 2}px;
      left: ${resolution.width / 4}px;
      top: ${resolution.height / 4}px;
    `

        stageShows.update((ss) => {
            if (!enabledItems[item]) enabledItems[item] = { enabled: true, style, align: "" }
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

            {#if title === "global_timers"}
                <h6><T id="tabs.timers" /></h6>
                {#each timersList as timer}
                    <Button on:click={() => click(title + "#" + timer.id)} active={enabledItems[title + "#" + timer.id]?.enabled} style="width: 100%;" bold={false}>
                        <Icon id="timer" right />
                        <span class="overflow">{timer.name}</span>
                    </Button>
                {/each}
            {:else}
                <h6><T id="stage.{title}" /></h6>
                {#each items as item}
                    <Button on:click={() => click(title + "#" + item)} active={enabledItems[title + "#" + item]?.enabled} style="width: 100%;" bold={false}>
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
        font-weight: bold;
    }

    .overflow {
        text-overflow: ellipsis;
        overflow: hidden;
        /* white-space: nowrap; */
    }
</style>
