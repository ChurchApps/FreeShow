<script lang="ts">
    import type { Item, ItemType } from "../../../../types/Show"
    import { activeEdit, activePopup, labelsDisabled, selected, showsCache, timers, variables } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { clone } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { getFileName } from "../../helpers/media"
    import { sortItemsByType } from "../../helpers/output"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { addItem, rearrangeItems } from "../scripts/itemHelpers"
    import { getItemText } from "../scripts/textStyle"
    import { itemBoxes } from "../values/boxes"

    type ItemRef = { id: ItemType; icon?: string; name?: string; maxAmount?: number }

    const commonItems: ItemRef[] = [{ id: "media", icon: "image" }, { id: "web" }, { id: "timer" }, { id: "clock" }]

    const specialItems: ItemRef[] = [
        // { id: "table" },
        { id: "camera" },
        { id: "slide_tracker", icon: "percentage" },
        { id: "events", icon: "calendar" },
        { id: "weather", icon: "cloud" },
        // mirror item is probably never used anymore, as we have a dedicated stage output, and dynamic values for next/previous slide
        // we could have a way to show the capture of an output screen.., but again, might be useless.
        // { id: "mirror" },
        { id: "visualizer", maxAmount: 1 },
        { id: "captions", maxAmount: 1 } // max one because there can't be multiple translations at this point
    ]

    const getIdentifier = {
        text: (item: Item) => {
            let text = getItemText(item)
            return text.slice(0, 10)
        },
        list: (item: Item) => {
            let text = item.list?.items?.[0]?.text || ""
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
        mirror: (item: Item) => {
            let showName = $showsCache[item.mirror?.show || ""]?.name || ""
            return showName
        },
        variable: (item: Item) => {
            let name = $variables[item.variable?.id]?.name || ""
            return name
        }
    }

    export let allSlideItems: Item[]
    $: invertedItemList = Array.isArray(allSlideItems) ? clone(allSlideItems).reverse() : []

    const getType = (item: Item) => (item.type as ItemType) || "text"

    $: sortedItems = sortItemsByType(invertedItemList)
</script>

<div class="tools">
    <div class="section">
        <MaterialButton variant="outlined" icon="text" title="settings.add: <b>items.text</b>" style="width: 100%;" on:click={() => addItem("text", null, {}, $activeEdit.type === "template" ? translateText("example.text") : "")}>
            {#if !$labelsDisabled}{translateText("items.text")}{/if}
        </MaterialButton>
    </div>

    <div class="section">
        {#each commonItems as item}
            <MaterialButton variant="outlined" title="settings.add: <b>items.{item.id}</b>" style="justify-content: left;width: 50%;padding: 12px 14px;" on:click={() => addItem(item.id)}>
                <Icon id={item.icon || item.id} size={0.9} />
                {#if !$labelsDisabled}{translateText("items." + item.id)}{/if}
            </MaterialButton>
        {/each}
    </div>

    <div class="section">
        {#each specialItems as item}
            {@const disabled = !!(item.maxAmount && sortedItems[item.id]?.length >= item.maxAmount)}

            <MaterialButton variant="outlined" {disabled} title="settings.add: <b>items.{item.id}</b>" style="justify-content: left;width: 50%;padding: 12px 14px;" on:click={() => addItem(item.id)}>
                <Icon id={item.icon || item.id} size={0.9} />
                {#if !$labelsDisabled}{translateText("items." + item.id)}{/if}
            </MaterialButton>
        {/each}
    </div>

    <div>
        <!-- square, circle, triangle, star, heart, ... -->
        <MaterialButton
            variant="outlined"
            style="width: 100%;padding: 5px;"
            title="edit.add_icons"
            on:click={() => {
                selected.set({ id: "slide_icon", data: [{ ...$activeEdit }] })
                activePopup.set("icon")
            }}
        >
            <Icon id="star" size={0.9} />
            {#if !$labelsDisabled}{translateText("items.icon")}{/if}
        </MaterialButton>
    </div>

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
                on:mousedown={e => {
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
                        on:click={e => {
                            selected.set({ id: null, data: [] })
                            activeEdit.update(ae => {
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
                            <MaterialButton disabled={i === allSlideItems.length - 1} icon="down" style="padding: 8px;" on:click={() => rearrangeItems("backward", index)} />
                            <MaterialButton disabled={i === 0} icon="up" style="padding: 8px;" on:click={() => rearrangeItems("forward", index)} />
                        </span>
                    </MaterialButton>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .tools {
        padding: 8px 5px;

        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    /* .section {
        border-radius: 8px;
        border: 1px solid var(--primary-lighter);
        overflow: hidden;
    } */
    /* .section :global(button) {
        border: none;
    } */

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
