<script lang="ts">
    import { uid } from "uid"
    import type { Popups } from "../../../../types/Main"
    import type { StageItem } from "../../../../types/Stage"
    import type { DrawerTabIds } from "../../../../types/Tabs"
    import { activeDrawerTab, activePage, activePopup, activeStage, dictionary, drawer, drawerTabsData, labelsDisabled, outputs, stageShows, timers, variables } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { checkWindowCapture, getActiveOutputs } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import IconButton from "../../inputs/IconButton.svelte"
    import Center from "../../system/Center.svelte"
    import Panel from "../../system/Panel.svelte"
    import { updateStageShow } from "../stage"

    type ItemRef = { id: string; icon?: string; name?: string; maxAmount?: number }
    const dynamicItems: ItemRef[] = [
        { id: "slide_text", icon: "text" },
        { id: "slide_notes", icon: "notes" },
        { id: "current_output", icon: "screen", maxAmount: 1 }, // TODO: max one!
        // { id: "video_time", icon: "clock" },
    ]

    const normalItems: ItemRef[] = [
        { id: "text" }, // video time/countdown ... (preset with dynamic values)
        { id: "variable" },
        { id: "slide_tracker", icon: "percentage" },
        { id: "media", icon: "image" },
        { id: "camera" },
        { id: "timer" },
        { id: "clock" },
    ]

    const resolution = { width: 1920, height: 1080 }
    const DEFAULT_STYLE = `width: ${resolution.width / 2}px;height: ${resolution.height / 2}px;left: ${resolution.width / 4}px;top: ${resolution.height / 4}px;`

    let timeout: NodeJS.Timeout | null = null
    function addItem(itemType: string) {
        const stageId = $activeStage.id
        if (!stageId) return

        let itemId = uid(5)
        stageShows.update((a) => {
            a[stageId].items[itemId] = { type: itemType, style: DEFAULT_STYLE, align: "" }
            return a
        })

        // select item
        if ($activeStage.items.length) {
            activeStage.update((a) => {
                a.items = [itemId]
                return a
            })
        }

        if (itemType === "current_output") checkWindowCapture()

        // WIP:
        if (!timeout) {
            updateStageShow()
            timeout = setTimeout(() => {
                updateStageShow()
                timeout = null
            }, 500)
        }
    }

    ////////////////////

    const titles = {
        slide: ["current_slide_text", "current_slide", "current_slide_notes", "next_slide_text", "next_slide", "next_slide_notes"],
        output: ["current_output", "slide_tracker"],
        time: ["system_clock", "video_time", "video_countdown"],
        global_timers: ["first_active_timer", "{timers}"],
        variables: ["{variables}"],
    }
    const customIcons = {
        current_output: "screen",
        slide_tracker: "percentage",
        video_time: "clock",
        video_countdown: "clock",
    }

    $: stageShow = $stageShows[$activeStage.id || ""] || {}
    $: stageOutputId = stageShow?.settings?.output || getActiveOutputs($outputs, true, true)[0]

    let enabledItems: { [key: string]: StageItem }
    $: enabledItems = stageShow.items || {}
    function click(item: string) {
        if (!$activeStage.id) return

        let resolution = { width: 1920, height: 1080 }
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

        // select item
        if (enabledItems[item]?.enabled === true && $activeStage.items.length) {
            activeStage.update((a) => {
                a.items = [item]
                return a
            })
        }

        if (item === "output#current_output") checkWindowCapture()

        if (!timeout2) {
            updateStageShow()
            timeout2 = setTimeout(() => {
                updateStageShow()
                timeout2 = null
            }, 500)
        }
    }

    let timeout2: NodeJS.Timeout | null = null

    const typeOrder = { counter: 1, clock: 2, event: 3 }
    let timersList = sortByName(keysToID(clone($timers)), "name", true).sort((a, b) => typeOrder[a.type] - typeOrder[b.type])
    let variablesList = sortByName(keysToID($variables))

    const drawerPages: { [key: string]: DrawerTabIds } = {
        timer: "functions",
        variables: "functions",
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

    // WIP:
    // $: sortedItems = sortItemsByType(stageShow.items)
    $: sortedItems = {}
</script>

<div class="main">
    <Panel>
        <h6 style="margin-top: 10px;"><T id="stage.output" /></h6>

        <div class="grid">
            {#each dynamicItems as item}
                <IconButton style="min-width: 100%;" name title={$dictionary.items?.[item.name || item.id]} icon={item.icon || item.id} disabled={item.maxAmount && sortedItems[item.id]?.length >= item.maxAmount} on:click={() => addItem(item.id)} />
            {/each}
        </div>

        <hr class="divider" />
        <!-- <h6><T id="edit.add_items" /></h6> -->
        <h6><T id="tools.items" /></h6>

        <div class="grid normal">
            {#each normalItems as item, i}
                <IconButton
                    style={i === 0 ? "min-width: 100%;" : $labelsDisabled ? "" : "justify-content: start;padding-left: 15px;"}
                    name
                    title={$dictionary.items?.[item.name || item.id]}
                    icon={item.icon || item.id}
                    disabled={item.maxAmount && sortedItems[item.id]?.length >= item.maxAmount}
                    on:click={() => addItem(item.id)}
                />

                {#if i === 0}
                    <hr class="divider" />
                {/if}
            {/each}
        </div>

        <!-- //////////////////// -->

        <hr class="divider" />
        <br />
        <br />
        <br />
        <br />

        {#each Object.entries(titles) as [title, items], i}
            {#if title === "global_timers"}
                <h6><T id="tabs.timers" /></h6>
                {#if timersList.length}
                    <Button on:click={() => click(title + "#first_active_timer")} active={enabledItems[title + "#first_active_timer"]?.enabled} style="width: 100%;" bold={false}>
                        <Icon id="timer" right />
                        <span class="overflow"><T id="stage.first_active_timer" /></span>
                    </Button>
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
    .grid {
        display: flex;
        /* gap: 10px; */
        flex-wrap: wrap;
    }

    .grid :global(#icon) {
        flex: 1;
        background-color: var(--primary-darker);
        padding: 9px;

        /* min-width: 100%; */
    }
    .grid :global(#icon:hover) {
        background-color: var(--primary-lighter);
    }

    /* .normal */
    .grid :global(#icon) {
        min-width: 49%;
    }

    .divider {
        height: 2px;
        width: 100%;
        background-color: var(--primary);
        margin: 0;
    }

    /*  */

    .main :global(button.active) {
        font-weight: 600;
    }

    .overflow {
        text-overflow: ellipsis;
        overflow: hidden;
        /* white-space: nowrap; */
    }
</style>
