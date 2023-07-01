<script lang="ts">
    import type { Item, ItemType } from "../../../../types/Show"
    import { activeEdit, activePopup, activeShow, dictionary, overlays, refreshEditSlide, selected, showsCache, templates, timers } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { getFileName } from "../../helpers/media"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import IconButton from "../../inputs/IconButton.svelte"
    import Center from "../../system/Center.svelte"
    import Panel from "../../system/Panel.svelte"
    import { addItem } from "../scripts/addItem"
    import { getItemText } from "../scripts/textStyle"
    import { boxes } from "../values/boxes"

    const items: { id: ItemType; icon?: string; name?: string }[] = [
        { id: "text" },
        { id: "list" },
        // { id: "table" },
        { id: "media", icon: "image" },
        { id: "timer" },
        { id: "clock" },
        { id: "events", icon: "calendar" },
        { id: "mirror" },
        { id: "visualizer" },
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
    }

    export let allSlideItems: Item[]
    $: invertedItemList = clone(allSlideItems)?.reverse() || []

    function move(index: number) {
        let items = []
        let slideID: null | string = null
        if ($activeEdit.type === "overlay") items = clone($overlays[$activeEdit.id!]?.items)
        else if ($activeEdit.type === "template") items = clone($templates[$activeEdit.id!]?.items)
        else {
            let slides = $showsCache[$activeShow?.id!]?.slides
            slideID = _show("active").layouts("active").ref()[0][$activeEdit.slide!].id as string
            items = clone(slides[slideID].items)
        }

        // let oldItems = items

        // move in array (to, from)
        // items.splice(index, 0, items.splice(index + 1, 1)[0])
        items = clone(moveItem(items, index, index + 1))

        // update
        if ($activeEdit.type === "overlay" || $activeEdit.type === "template") {
            // previousData: oldItems
            history({
                id: "UPDATE",
                oldData: { id: $activeEdit.id },
                newData: { key: "items", data: items },
                location: { page: "edit", id: $activeEdit.type + "_items", override: true },
            })
        } else {
            _show("active").slides([slideID!]).set({ key: "items", value: items })
        }

        refreshEditSlide.set(true)
    }

    function moveItem(items, fromIndex, toIndex) {
        let item = items[fromIndex]
        items.splice(fromIndex, 1)
        items.splice(toIndex, 0, item)

        return items
    }

    const getType = (item: any) => (item.type as ItemType) || "text"
</script>

<Panel>
    <h6><T id="edit.add_items" /></h6>
    <div class="grid">
        {#each items as item}
            <IconButton name title={$dictionary.items?.[item.name || item.id]} icon={item.icon || item.id} on:click={() => addItem(item.id)} />
        {/each}
    </div>
    <div>
        <!-- square, circle, triangle, star, heart, ... -->
        <Button
            id="button"
            style="width: 100%;"
            title={$dictionary.items?.icon}
            on:click={() => {
                selected.set({ id: "slide", data: [{ ...$activeEdit }] })
                activePopup.set("icon")
            }}
            dark
            center
        >
            <Icon id={"noIcon"} right />
            <T id="edit.add_icons" />
        </Button>
    </div>
    <hr />
    <h6><T id="edit.arrange_items" /></h6>
    <div class="items" style="display: flex;flex-direction: column;">
        {#if invertedItemList.length}
            {#each invertedItemList as currentItem, i}
                {@const index = invertedItemList.length - i - 1}
                {@const type = getType(currentItem)}
                <Button
                    style="width: 100%;justify-content: space-between;"
                    active={$activeEdit.items.includes(index)}
                    dark
                    on:click={(e) => {
                        if (!e.target?.closest(".up")) {
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
                        <Icon id={type === "icon" ? currentItem.id : boxes[type]?.icon || "text"} custom={type === "icon"} />
                        <p style="margin-left: 10px;">{$dictionary.items?.[type]}</p>
                        {#if getIdentifier[type]}<p style="margin-left: 10px;max-width: 120px;opacity: 0.5;">{getIdentifier[type](currentItem)}</p>{/if}
                    </span>
                    <!-- {#if i < allSlideItems.length - 1}
          <Icon id="down" />
        {/if} -->
                    {#if i > 0}
                        <Button class="up" on:click={() => move(index)}>
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

<!-- <section>Items order layers / add new items (text/shapes/image?/video/music...)</section> -->

<!-- new from template.. ? -->
<!-- grid view add new items... -->

<!-- TODO: select item / bring to center / delete ...  -->
<style>
    .grid {
        display: flex;
        /* gap: 10px; */
        flex-wrap: wrap;
    }

    .grid :global(#icon) {
        /* min-width: 32%; */
        flex: 1;
        background-color: var(--primary-darker);
        padding: 10px;
    }
    .grid :global(#icon:hover) {
        background-color: var(--primary-lighter);
    }

    .items p {
        width: auto;
    }
</style>
