<script lang="ts">
    import type { Item, ItemType } from "../../../../types/Show"
    import { activeEdit, selected, timers, variables } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import DragItemWrapper from "../../helpers/DragItemWrapper.svelte"
    import { createDragReorder } from "../../helpers/dragReorder"
    import Icon from "../../helpers/Icon.svelte"
    import { getFileName } from "../../helpers/media"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { moveInvertedItems } from "../scripts/itemHelpers"
    import { getItemText } from "../scripts/textStyle"
    import { itemBoxes } from "../values/boxes"

    const dragReorder = createDragReorder((fromIndices, toIndex) => {
        const reordered = dragReorder.getReorderedList(invertedItemList, fromIndices, toIndex)
        moveInvertedItems(reordered, fromIndices)
    })
    const { dragOverIndex, draggedIndices } = dragReorder

    const getIdentifier = {
        text: (item: Item) => {
            let text = getItemText(item)
            return text.slice(0, 10)
        },
        media: (item: Item) => {
            let path = item.src
            return getFileName(path || "")
        },
        timer: (item: Item) => {
            const timerId = item.timer?.id || item.timerId
            if (!timerId) return ""
            let timerName = $timers[timerId]?.name || ""
            return timerName
        },
        clock: () => "",

        variable: (item: Item) => {
            let name = $variables[item.variable?.id]?.name || ""
            return name
        },
        chart: (item: Item) => {
            return item.chart?.type || ""
        },
        table: () => ""
    }

    export let allSlideItems: Item[]
    $: invertedItemList = Array.isArray(allSlideItems) ? allSlideItems.map((_, i) => allSlideItems[allSlideItems.length - 1 - i]) : []
    $: selectedIndices = ($activeEdit.items || []).map((idx) => invertedItemList.length - idx - 1)
    $: displayList = dragReorder.getReorderedList(invertedItemList, $draggedIndices, $dragOverIndex)
    $: isPlaceholderActive = $dragOverIndex !== null

    const getType = (item: Item) => (item?.type as ItemType) || "text"
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
                {@const originalIndex = allSlideItems.indexOf(currentItem)}
                {@const index = originalIndex >= 0 ? originalIndex : allSlideItems.length - i - 1}
                {@const type = getType(currentItem)}
                {@const isPlaceholder = isPlaceholderActive && $draggedIndices.some((dIdx) => currentItem === invertedItemList[dIdx])}
                <!-- TODO: context menu (delete / move to top/bottom / etc.) -->

                <DragItemWrapper index={i} controller={dragReorder} {isPlaceholder} {selectedIndices}>
                    <MaterialButton
                        id="#{index}"
                        variant="outlined"
                        class="item_button"
                        style="width: 100%;justify-content: space-between;padding: 6px 8px;cursor: grab;"
                        isActive={$activeEdit.items.includes(index)}
                        tab
                        on:click={(e) => {
                            selected.set({ id: null, data: [] })
                            activeEdit.update((ae) => {
                                if (e.detail.ctrl) {
                                    if (ae.items.includes(index)) ae.items.splice(ae.items.indexOf(index), 1)
                                    else ae.items.push(index)
                                } else if (!ae.items.includes(index)) ae.items = [index]
                                else ae.items = []
                                return ae
                            })
                        }}
                    >
                        <span style="display: flex;align-items: center;width: 100%;gap: 8px;pointer-events: none;">
                            {#if displayList.length > 1}
                                <Icon id="drag" style="opacity: 0.5;" white />
                            {/if}

                            <Icon id={type === "icon" ? currentItem.id || "" : itemBoxes[type]?.icon || "text"} custom={type === "icon"} size={0.8} />
                            <p style="opacity: 0.9;">{translateText("items." + type)}</p>
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
