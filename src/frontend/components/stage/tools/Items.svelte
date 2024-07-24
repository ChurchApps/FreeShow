<script lang="ts">
    import type { Popups } from "../../../../types/Main"
    import type { DrawerTabIds } from "../../../../types/Tabs"
    import { activeDrawerTab, activePage, activePopup, activeStage, drawer, drawerTabsData, outputs, stageShows, timers, variables } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { keysToID } from "../../helpers/array"
    import { checkWindowCapture, getActiveOutputs, getResolution } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import Center from "../../system/Center.svelte"
    import Panel from "../../system/Panel.svelte"
    import { updateStageShow } from "../stage"

    // TODO: more stage features
    const titles = {
        // slide_background ++
        slide: ["current_slide_text", "current_slide", "current_slide_notes", "next_slide_text", "next_slide", "next_slide_notes"],
        output: ["current_output", "slide_tracker"],
        time: ["system_clock", "video_time", "video_countdown"],
        global_timers: ["{timers}"],
        variables: ["{variables}"],
        // other: ["chords", "message"],
    }
    const customIcons = {
        current_output: "screen",
        slide_tracker: "percentage",
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

        if (item === "output#current_output") checkWindowCapture()

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

    const drawerPages: { [key: string]: DrawerTabIds } = {
        timer: "calendar",
        variables: "overlays",
    }
    function openDrawer(id: string) {
        activePage.set("show")

        // set sub tab
        let drawerPageId = drawerPages[id]
        if (!drawerPageId) return

        drawerTabsData.update((a) => {
            if (!a[drawerPageId]) a[drawerPageId] = { enabled: true, activeSubTab: null }
            a[drawerPageId].activeSubTab = id

            return a
        })

        activeDrawerTab.set(drawerPageId)

        // open drawer
        if ($drawer.height <= 40) {
            drawer.set({ height: 300, stored: $drawer.height })
        }

        // create new popup
        let popupId = id
        if (popupId === "variables") popupId = "variable"
        activePopup.set(popupId as Popups)
    }
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
                    <Center>
                        <span style="opacity: 0.5;"><T id="empty.general" /></span>

                        <Button on:click={() => openDrawer("timer")} style="width: 100%;margin-top: 5px;" center>
                            <Icon id="add" right />
                            <T id="new.timer" />
                        </Button>
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
                    <Center>
                        <span style="opacity: 0.5;"><T id="empty.general" /></span>

                        <Button on:click={() => openDrawer("variables")} style="width: 100%;margin-top: 5px;" center>
                            <Icon id="add" right />
                            <T id="new.variable" />
                        </Button>
                    </Center>
                {/if}
            {:else}
                {#if i > 0}<h6><T id="stage.{title}" /></h6>{/if}

                {#each items as item}
                    <Button on:click={() => click(title + "#" + item)} active={enabledItems[title + "#" + item]?.enabled} style="width: 100%;" bold={false}>
                        <span style="font-size: 0;position: absolute;">{console.log(item, customIcons[item], item.split("_")[item.split("_").length - 1])}</span>
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
        font-weight: 600;
    }

    .overflow {
        text-overflow: ellipsis;
        overflow: hidden;
        /* white-space: nowrap; */
    }
</style>
