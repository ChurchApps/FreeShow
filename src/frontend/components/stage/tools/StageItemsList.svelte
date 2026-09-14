<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import type { StageItem } from "../../../../types/Stage"
    import { activeStage, dictionary, selected, stageShows, timers } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getSortedStageItems, rearrangeStageItems } from "../../edit/scripts/itemHelpers"
    import { getItemText } from "../../edit/scripts/textStyle"
    import { itemBoxes } from "../../edit/values/boxes"
    import Icon from "../../helpers/Icon.svelte"
    import { clone } from "../../helpers/array"
    import { getFileName } from "../../helpers/media"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { getCustomStageLabel } from "../stage"

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
    $: invertedItemList = Array.isArray(allItems) ? clone(allItems).reverse() : []
</script>

{#if invertedItemList.length}
    <div style="margin-top: 10px;">
        <div class="title">
            <span style="display: flex;gap: 8px;align-items: center;padding: 8px 12px;">
                <Icon id="rearrange" white />
                <p>{translateText("edit.arrange_items")}</p>
            </span>
        </div>

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
            {#each invertedItemList as currentItem, i}
                {@const id = currentItem.id}
                {@const type = currentItem.type || "text"}

                <MaterialButton
                    id="#{id}"
                    variant="outlined"
                    class="item_button"
                    style="width: 100%;justify-content: space-between;padding: 2px 8px;"
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
                    <span style="display: flex;align-items: center;max-width: 70%;">
                        <p style="opacity: 0.7;margin-inline-end: 10px;">{i + 1}</p>
                        <Icon id={type === "icon" ? id || "" : itemBoxes[type]?.icon || "text"} custom={type === "icon"} size={0.8} />
                        <p style="opacity: 0.9;margin-inline-start: 10px;;">{getCustomStageLabel(currentItem.type || id, currentItem, $dictionary) || translateText("items." + type)}</p>
                        {#if getIdentifier[type]}<p style="margin-inline-start: 10px;max-width: 120px;opacity: 0.5;font-size: 0.8em;max-width: 40%;">{getIdentifier[type](currentItem)}</p>{/if}
                    </span>
                    <span>
                        <MaterialButton disabled={i === allItems.length - 1} icon="down" title="actions.backward" style="padding: 8px;" on:click={() => rearrangeStageItems("backward", id)} />
                        <MaterialButton disabled={i === 0} icon="up" title="actions.forward" style="padding: 8px;" on:click={() => rearrangeStageItems("forward", id)} />
                    </span>
                </MaterialButton>
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
