<script lang="ts">
    import type { Item, ItemType } from "../../../../types/Show"
    import { activeEdit, selected, timers, variables } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { clone } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { getFileName } from "../../helpers/media"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { rearrangeItems } from "../scripts/itemHelpers"
    import { getItemText } from "../scripts/textStyle"
    import { itemBoxes } from "../values/boxes"

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
    $: invertedItemList = Array.isArray(allSlideItems) ? clone(allSlideItems).reverse() : []

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

        <div
            class="items {invertedItemList.length > 1 ? 'context #items_list_item' : ''}"
            style="display: flex;flex-direction: column;"
            on:mousedown={(e) => {
                if (e.button !== 2) return
                // select on right click for context menu
                const index = Number((e.target?.closest(".item_button")?.id || "").slice(1))
                activeEdit.set({ ...$activeEdit, items: [index] })
            }}
        >
            {#each invertedItemList as currentItem, i}
                {@const index = invertedItemList.length - i - 1}
                {@const type = getType(currentItem)}
                <!-- TODO: context menu (delete / move to top/bottom / etc.) -->

                <MaterialButton
                    id="#{index}"
                    variant="outlined"
                    class="item_button"
                    style="width: 100%;justify-content: space-between;padding: 2px 8px;"
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
                    <span style="display: flex;align-items: center;max-width: 70%;">
                        <p style="opacity: 0.7;margin-inline-end: 10px;">{i + 1}</p>
                        <Icon id={type === "icon" ? currentItem.id || "" : itemBoxes[type]?.icon || "text"} custom={type === "icon"} size={0.8} />
                        <p style="opacity: 0.9;margin-inline-start: 10px;">{translateText("items." + type)}</p>
                        {#if getIdentifier[type]}<p style="margin-inline-start: 10px;max-width: 120px;opacity: 0.5;font-size: 0.8em;max-width: 40%;">{getIdentifier[type](currentItem)}</p>{/if}
                    </span>
                    <span>
                        <MaterialButton disabled={i === allSlideItems.length - 1} icon="down" title="actions.backward" style="padding: 8px;" on:click={() => rearrangeItems("backward", index)} />
                        <MaterialButton disabled={i === 0} icon="up" title="actions.forward" style="padding: 8px;" on:click={() => rearrangeItems("forward", index)} />
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
