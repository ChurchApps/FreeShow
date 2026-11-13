<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import type { StageItem } from "../../../../types/Stage"
    import { activeStage, dictionary, selected, stageShows, timers } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getSortedStageItems, moveStageInvertedItems } from "../../edit/scripts/itemHelpers"
    import { getItemText } from "../../edit/scripts/textStyle"
    import { itemBoxes } from "../../edit/values/boxes"
    import DragItemWrapper from "../../helpers/DragItemWrapper.svelte"
    import Icon from "../../helpers/Icon.svelte"
    import { createDragReorder } from "../../helpers/dragReorder"
    import { getFileName } from "../../helpers/media"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { getCustomStageLabel } from "../stage"

    const dragReorder = createDragReorder((fromIndices, toIndex) => {
        const reordered = dragReorder.getReorderedList(invertedItemList, fromIndices, toIndex)
        moveStageInvertedItems(reordered)
    })
    const { dragOverIndex, draggedIndices } = dragReorder

    $: stageId = $activeStage.id || ""

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
    $: invertedItemList = Array.isArray(allItems) ? allItems.map((_, i) => allItems[allItems.length - 1 - i]) : []
    $: selectedIndices = ($activeStage.items || []).map((itemId) => invertedItemList.findIndex((it) => it.id === itemId)).filter((idx) => idx >= 0)
    $: displayList = dragReorder.getReorderedList(invertedItemList, $draggedIndices, $dragOverIndex)
    $: isPlaceholderActive = $dragOverIndex !== null

    const getType = (item: StageItem) => item?.type || "text"
</script>

{#if invertedItemList.length}
    <div style="margin-top: 10px;">
        <div class="title">
            <span style="display: flex;gap: 8px;align-items: center;padding: 8px 12px;">
                <Icon id="rearrange" white />
                <p>{translateText("edit.arrange_items")}</p>
            </span>
        </div>

        <div class="items" style="display: flex;flex-direction: column;">
            {#each displayList as currentItem, i}
                {@const id = currentItem.id}
                {@const type = getType(currentItem)}
                {@const isPlaceholder = isPlaceholderActive && $draggedIndices.some((dIdx) => currentItem === invertedItemList[dIdx])}

                <DragItemWrapper index={i} controller={dragReorder} {isPlaceholder} {selectedIndices}>
                    <MaterialButton
                        id="#{id}"
                        variant="outlined"
                        class="item_button"
                        style="width: 100%;justify-content: space-between;padding: 6px 8px;cursor: grab;"
                        isActive={$activeStage.items.includes(id)}
                        tab
                        on:click={(e) => {
                            selected.set({ id: null, data: [] })
                            activeStage.update((ae) => {
                                if (e.detail.ctrl) {
                                    if (ae.items.includes(id)) ae.items.splice(ae.items.indexOf(id), 1)
                                    else ae.items.push(id)
                                } else if (!ae.items.includes(id)) ae.items = [id]
                                else ae.items = []
                                return ae
                            })
                        }}
                    >
                        <span style="display: flex;align-items: center;width: 100%;gap: 8px;pointer-events: none;">
                            {#if displayList.length > 1}
                                <Icon id="drag" style="opacity: 0.5;" white />
                            {/if}

                            <Icon id={type === "icon" ? id || "" : itemBoxes[type]?.icon || "text"} custom={type === "icon"} size={0.8} />
                            <p style="opacity: 0.9;">{getCustomStageLabel(currentItem.type || id, currentItem, $dictionary) || translateText("items." + type)}</p>
                            {#if getIdentifier[type]}
                                <p style="flex: 1;text-align: left;opacity: 0.5;font-size: 0.8em;overflow: hidden;text-overflow: ellipsis;white-space: nowrap;">{getIdentifier[type](currentItem)}</p>
                            {/if}

                            <p style="opacity: 0.5;font-size: 0.75em;margin-inline-start: auto;">{i + 1}</p>
                        </span>
                    </MaterialButton>
                </DragItemWrapper>
            {/each}
        </div>
    </div>
{/if}

<style>
    /* title */

    .title {
        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);

        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        overflow: hidden;
    }
    .title p {
        font-weight: 500;
        font-size: 0.8rem;
        opacity: 0.8;
    }
</style>
