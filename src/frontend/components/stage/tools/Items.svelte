<script lang="ts">
    import { uid } from "uid"
    import { Item } from "../../../../types/Show"
    import type { StageItem } from "../../../../types/Stage"
    import { activeStage, dictionary, labelsDisabled, selected, stageShows, timers } from "../../../stores"
    import { getSortedStageItems, rearrangeStageItems, updateSortedStageItems } from "../../edit/scripts/itemHelpers"
    import { getItemText } from "../../edit/scripts/textStyle"
    import { boxes } from "../../edit/values/boxes"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { getFileName } from "../../helpers/media"
    import { checkWindowCapture, sortItemsByType } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import IconButton from "../../inputs/IconButton.svelte"
    import Center from "../../system/Center.svelte"
    import Panel from "../../system/Panel.svelte"
    import { getCustomStageLabel, updateStageShow } from "../stage"
    import { clone } from "../../helpers/array"

    type ItemRef = { id: string; icon?: string; name?: string; maxAmount?: number }
    const dynamicItems: ItemRef[] = [
        { id: "slide_text", icon: "text" },
        // { id: "slide_notes", icon: "notes" }, // added as dynamic value in textbox
        { id: "current_output", icon: "screen", maxAmount: 1 }
    ]

    const normalItems: ItemRef[] = [
        { id: "text" }, // video time/countdown ... (preset with dynamic values)
        // { id: "variable" }, // added as dynamic value in textbox
        { id: "slide_tracker", icon: "percentage" },
        { id: "media", icon: "image" },
        { id: "camera" },
        { id: "timer" },
        { id: "clock" }
    ]

    $: stageId = $activeStage.id || ""
    $: stageShow = $stageShows[stageId] || {}
    $: sortedItems = sortItemsByType(Object.values(stageShow.items || {}) as any)

    // check slide text state
    $: slideTextItems = Object.values(stageShow.items || {}).filter((a) => a.type === "slide_text")

    const resolution = { width: 1920, height: 1080 }
    const DEFAULT_STYLE = `width: ${resolution.width / 2}px;height: ${resolution.height / 2}px;inset-inline-start: ${resolution.width / 4}px;top: ${resolution.height / 4}px;`

    let timeout: NodeJS.Timeout | null = null
    function addItem(itemType: string) {
        if (!stageId) return

        let itemId = uid(5)
        stageShows.update((a) => {
            let item: StageItem = { type: itemType, style: DEFAULT_STYLE, align: "" }

            if (itemType === "text") item.lines = [{ align: "", text: [{ style: "", value: "" }] }]
            else if (itemType === "slide_text") {
                item.slideOffset = slideTextItems.length
            }

            a[stageId].items[itemId] = item
            return a
        })

        updateSortedStageItems()

        // select item
        if (Object.keys($stageShows[stageId]?.items).length > 1) {
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

    // ARRANGE

    const getIdentifier = {
        text: (item: StageItem) => {
            let text = getItemText(item as Item)
            return text.slice(0, 10)
        },
        media: (item: StageItem) => {
            let path = item.src
            return getFileName(path || "")
        },
        timer: (item: StageItem) => {
            if (!item.timer?.id) return ""
            let timerName = $timers[item.timer.id]?.name || ""
            return timerName
        },
        clock: () => ""
    }

    $: allItems = getSortedStageItems(stageId, $stageShows)
    $: invertedItemList = Array.isArray(allItems) ? clone(allItems).reverse() : []
</script>

<div class="main">
    <Panel>
        <h6 style="margin-top: 10px;"><T id="stage.output" /></h6>

        <div class="grid">
            {#each dynamicItems as item}
                {@const title = item.id === "slide_text" && slideTextItems.length === 1 ? $dictionary.stage?.next_slide_text : $dictionary.items?.[item.name || item.id]}
                {@const icon = item.icon || item.id}
                {@const disabled = item.maxAmount && sortedItems[item.id]?.length >= item.maxAmount}

                {#if item.id === "current_output"}
                    <hr class="divider" />
                {/if}

                <IconButton style="min-width: 100%;" name title="{title}{item.id === 'slide_text' && slideTextItems.length > 1 ? ` (+${slideTextItems.length})` : ''}" {icon} {disabled} on:click={() => addItem(item.id)} />
            {/each}
        </div>

        <hr class="divider" />
        <!-- <h6><T id="edit.add_items" /></h6> -->
        <h6><T id="tools.items" /></h6>

        <div class="grid normal">
            {#each normalItems as item}
                <!-- i === 0 ? "min-width: 100%;" :  -->
                <IconButton
                    style={$labelsDisabled ? "" : "justify-content: start;padding-inline-start: 15px;"}
                    name
                    title={$dictionary.items?.[item.name || item.id]}
                    icon={item.icon || item.id}
                    disabled={item.maxAmount && sortedItems[item.id]?.length >= item.maxAmount}
                    on:click={() => addItem(item.id)}
                />

                <!-- {#if i === 0}<hr class="divider" />{/if} -->
            {/each}
        </div>

        <h6><T id="edit.arrange_items" /></h6>
        <div
            class="items {invertedItemList.length > 1 ? 'context #items_list_item_stage' : ''}"
            style="display: flex;flex-direction: column;"
            on:mousedown={(e) => {
                if (e.button !== 2) return
                // select on right click for context menu
                const itemId = (e.target?.closest(".item_button")?.id || "").slice(1)
                activeStage.set({ ...$activeStage, items: [itemId] })
            }}
        >
            {#if invertedItemList.length}
                {#each invertedItemList as currentItem, i}
                    {@const id = currentItem.id}
                    {@const type = currentItem.type || "text"}
                    <Button
                        id="#{id}"
                        class="item_button"
                        style="width: 100%;justify-content: space-between;"
                        active={$activeStage.items.includes(id)}
                        dark
                        on:click={(e) => {
                            if (!e.target?.closest(".up")) {
                                selected.set({ id: null, data: [] })
                                activeStage.update((ae) => {
                                    if (e.ctrlKey || e.metaKey) {
                                        if (ae.items.includes(id)) ae.items.splice(ae.items.indexOf(id), 1)
                                        else ae.items.push(id)
                                    } else if (!ae.items.includes(id)) ae.items = [id]
                                    else ae.items = []
                                    return ae
                                })
                            }
                        }}
                    >
                        <span style="display: flex;flex: 1;">
                            <p style="margin-inline-end: 10px;">{i + 1}</p>
                            <Icon id={type === "icon" ? id || "" : boxes[type]?.icon || "text"} custom={type === "icon"} />
                            <p style="margin-inline-start: 10px;">{getCustomStageLabel(currentItem.type || id, currentItem, $dictionary) || $dictionary.items?.[type]}</p>
                            {#if getIdentifier[type]}<p style="margin-inline-start: 10px;max-width: 120px;opacity: 0.5;">{getIdentifier[type](currentItem)}</p>{/if}
                        </span>
                        {#if i > 0}
                            <Button class="up" on:click={() => rearrangeStageItems("forward", id)}>
                                <Icon id="up" />
                            </Button>
                        {/if}
                    </Button>
                {/each}
            {:else}
                <Center faded>
                    <T id="empty.general" />
                </Center>
            {/if}
        </div>
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

    .items p {
        width: auto;
    }

    /*  */

    .main :global(button.active) {
        font-weight: 600;
    }
</style>
