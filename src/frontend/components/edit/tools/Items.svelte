<script lang="ts">
    import type { Item, ItemType } from "../../../../types/Show"
    import { activeEdit, activePopup, dictionary, labelsDisabled, selected, showsCache, timers, variables } from "../../../stores"
    import { clone } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { getFileName } from "../../helpers/media"
    import { sortItemsByType } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import IconButton from "../../inputs/IconButton.svelte"
    import Center from "../../system/Center.svelte"
    import Panel from "../../system/Panel.svelte"
    import { addItem, rearrangeItems } from "../scripts/itemHelpers"
    import { getItemText } from "../scripts/textStyle"
    import { boxes } from "../values/boxes"

    type ItemRef = { id: ItemType; icon?: string; name?: string; maxAmount?: number }

    const items: ItemRef[] = [
        { id: "text" },
        { id: "media", icon: "image" },
        { id: "web" },
        { id: "timer" },
        { id: "clock" },
        // { id: "variable" },
    ]

    const specialItems: ItemRef[] = [
        // { id: "table" },
        { id: "camera" },
        { id: "slide_tracker", icon: "percentage" },
        { id: "events", icon: "calendar" },
        { id: "mirror" },
        { id: "visualizer", maxAmount: 1 },
        { id: "captions", maxAmount: 1 }, // max one because there can't be multiple translations at this point
    ]

    const getIdentifier = {
        text: (item: any) => {
            let text = getItemText(item)
            return text.slice(0, 10)
        },
        list: (item: any) => {
            let text = item.list.items?.[0]?.text || ""
            return text.slice(0, 10)
        },
        media: (item: any) => {
            let path = item.src
            return getFileName(path)
        },
        timer: (item: any) => {
            if (!item.timerId) return ""
            let timerName = $timers[item.timerId]?.name || ""
            return timerName
        },
        clock: () => "",
        mirror: (item: any) => {
            let showName = $showsCache[item.mirror.show]?.name || ""
            return showName
        },
        variable: (item: any) => {
            let name = $variables[item.variable?.id]?.name || ""
            return name
        },
    }

    export let allSlideItems: Item[]
    $: invertedItemList = Array.isArray(allSlideItems) ? clone(allSlideItems).reverse() : []

    const getType = (item: any) => (item.type as ItemType) || "text"

    $: sortedItems = sortItemsByType(invertedItemList)
</script>

<Panel>
    <h6 style="margin-top: 10px;"><T id="edit.add_items" /></h6>

    <div class="grid">
        {#each items as item, i}
            <IconButton
                style={i === 0 ? "min-width: 100%;" : $labelsDisabled ? "" : "justify-content: start;padding-left: 15px;"}
                name
                title={$dictionary.items?.[item.name || item.id]}
                icon={item.icon || item.id}
                disabled={item.maxAmount && sortedItems[item.id]?.length >= item.maxAmount}
                on:click={() => addItem(item.id, null, {}, $activeEdit.type === "template" ? $dictionary.example?.text || "" : "")}
            />

            {#if i === 0}
                <hr class="divider" />
            {/if}
        {/each}
    </div>

    <hr class="divider" />

    <div class="grid special">
        {#each specialItems as item}
            <IconButton
                style={$labelsDisabled ? "" : "justify-content: start;padding-left: 15px;"}
                name
                title={$dictionary.items?.[item.name || item.id]}
                icon={item.icon || item.id}
                disabled={item.maxAmount && sortedItems[item.id]?.length >= item.maxAmount}
                on:click={() => addItem(item.id)}
            />
        {/each}
    </div>

    <hr class="divider" />

    <div>
        <!-- square, circle, triangle, star, heart, ... -->
        <Button
            id="button"
            style="width: 100%;"
            title={$dictionary.edit?.add_icons}
            on:click={() => {
                selected.set({ id: "slide_icon", data: [{ ...$activeEdit }] })
                activePopup.set("icon")
            }}
            dark
            center
        >
            <Icon id="star" right={!$labelsDisabled} />
            {#if !$labelsDisabled}<T id="items.icon" />{/if}
        </Button>
    </div>

    <h6><T id="edit.arrange_items" /></h6>
    <div class="items" style="display: flex;flex-direction: column;">
        {#if invertedItemList.length}
            {#each invertedItemList as currentItem, i}
                {@const index = invertedItemList.length - i - 1}
                {@const type = getType(currentItem)}
                <!-- TODO: context menu (delete / move to top/bottom / etc.) -->
                <Button
                    style="width: 100%;justify-content: space-between;"
                    active={$activeEdit.items.includes(index)}
                    dark
                    on:click={(e) => {
                        if (!e.target?.closest(".up")) {
                            selected.set({ id: null, data: [] })
                            activeEdit.update((ae) => {
                                if (e.ctrlKey || e.metaKey) {
                                    if (ae.items.includes(index)) ae.items.splice(ae.items.indexOf(index), 1)
                                    else ae.items.push(index)
                                } else if (!ae.items.includes(index)) ae.items = [index]
                                else ae.items = []
                                return ae
                            })
                        }
                    }}
                >
                    <span style="display: flex;">
                        <p style="margin-right: 10px;">{i + 1}</p>
                        <Icon id={type === "icon" ? currentItem.id || "" : boxes[type]?.icon || "text"} custom={type === "icon"} />
                        <p style="margin-left: 10px;">{$dictionary.items?.[type]}</p>
                        {#if getIdentifier[type]}<p style="margin-left: 10px;max-width: 120px;opacity: 0.5;">{getIdentifier[type](currentItem)}</p>{/if}
                    </span>
                    <!-- {#if i < allSlideItems.length - 1}
                        <Icon id="down" />
                    {/if} -->
                    {#if i > 0}
                        <Button class="up" on:click={() => rearrangeItems("forward", index)}>
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

    /* .special */
    .grid :global(#icon) {
        /* min-width: 32%; */
        min-width: 49%;
    }

    /* p.divider {
        background-color: var(--primary-darkest);
        text-align: center;
        padding: 2px;
        font-size: 0.8em;
        / * font-weight: 600;
        text-transform: uppercase; * /
    } */
    .divider {
        height: 2px;
        width: 100%;
        background-color: var(--primary);
        margin: 0;
    }

    .items p {
        width: auto;
    }
</style>
