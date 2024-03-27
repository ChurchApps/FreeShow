<script lang="ts">
    import { activeStage, outputs, stageShows, timers, variables } from "../../../stores"
    import { keysToID } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { getActiveOutputs, getResolution } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Center from "../../system/Center.svelte"
    import Panel from "../../system/Panel.svelte"
    import { updateStageShow } from "../stage"

    // TODO: more stage features
    const titles = {
        // slide_background ++
        slide: ["current_slide_text", "current_slide", "current_slide_notes", "next_slide_text", "next_slide", "next_slide_notes"],
        output: ["current_output"],
        time: ["system_clock", "video_time", "video_countdown"],
        global_timers: ["{timers}"],
        variables: ["{variables}"],
        // other: ["chords", "message"],
    }
    const customIcons = {
        current_output: "screen",
        video_time: "clock",
        video_countdown: "clock",
    }

    $: stageShow = $stageShows[$activeStage.id || ""] || {}
    $: stageOutputId = stageShow?.settings?.output || getActiveOutputs($outputs, true, true)[0]

    let enabledItems: any
    $: enabledItems = stageShow.items || []
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

    let timersList: any[] = keysToID($timers).sort((a, b) => a.name?.localeCompare(b.name))
    let variablesList: any[] = keysToID($variables).sort((a, b) => a.name?.localeCompare(b.name))
</script>

<div class="main">
    <Panel>
        {#each Object.entries(titles) as [title, items], i}
            {#if title === "global_timers"}
                <h6><T id="tabs.timers" /></h6>
                {#if timersList.length}
                    {#each timersList as timer}
                        <Button on:click={() => click(title + "#" + timer.id)} active={enabledItems[title + "#" + timer.id]?.enabled} style="width: 100%;" bold={false}>
                            <Icon id="timer" right />
                            <span class="overflow">{timer.name}</span>
                        </Button>
                    {/each}
                {:else}
                    <Center faded>
                        <T id="empty.general" />
                    </Center>
                {/if}
            {:else if title === "variables"}
                <h6><T id="tabs.variables" /></h6>
                {#if variablesList.length}
                    {#each variablesList as variable}
                        <Button on:click={() => click(title + "#" + variable.id)} active={enabledItems[title + "#" + variable.id]?.enabled} style="width: 100%;" bold={false}>
                            <Icon id="variable" right />
                            <span class="overflow">{variable.name}</span>
                        </Button>
                    {/each}
                {:else}
                    <Center faded>
                        <T id="empty.general" />
                    </Center>
                {/if}
            {:else}
                {#if i > 0}<h6><T id="stage.{title}" /></h6>{/if}

                {#each items as item}
                    <Button on:click={() => click(title + "#" + item)} active={enabledItems[title + "#" + item]?.enabled} style="width: 100%;" bold={false}>
                        <Icon id={customIcons[item] || item.split("_")[item.split("_").length - 1]} right />
                        <span class="overflow"><T id="stage.{item}" /></span>
                    </Button>

                    <!-- alpha key output -->
                    {#if item === "current_output" && $outputs[stageOutputId]?.keyOutput}
                        <Button on:click={() => click(title + "#current_output_alpha")} active={enabledItems[title + "#current_output_alpha"]?.enabled} style="width: 100%;" bold={false}>
                            <Icon id={"screen"} right />
                            <span class="overflow"><T id="settings.enable_key_output" /></span>
                        </Button>
                    {/if}
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
