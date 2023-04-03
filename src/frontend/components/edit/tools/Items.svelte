<script lang="ts">
    import type { Item, ItemType } from "../../../../types/Show"
    import { activeEdit, activePopup, activeShow, dictionary, overlays, selected, showsCache, templates } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import IconButton from "../../inputs/IconButton.svelte"
    import Panel from "../../system/Panel.svelte"
    import { addItem } from "../scripts/addItem"
    import { boxes } from "../values/boxes"

    export let allSlideItems: Item[]
    $: invertedItemList = clone(allSlideItems)?.reverse() || []

    $: console.log(allSlideItems, invertedItemList)

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
        items = moveItem(items, index, index + 1)

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
        <IconButton title={$dictionary.items?.text} icon="text" on:click={() => addItem("text")} />
        <IconButton title={$dictionary.items?.image} icon="image" on:click={() => addItem("media")} />
        <!-- TODO: camera box -->
        <!-- <IconButton title={$dictionary.items?.live} disabled icon="camera" /> -->
        <IconButton title={$dictionary.items?.timer} icon="timer" on:click={() => addItem("timer")} />
        <IconButton title={$dictionary.items?.clock} icon="clock" on:click={() => addItem("clock")} />
        <IconButton title={$dictionary.items?.mirror} icon="mirror" on:click={() => addItem("mirror")} />
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
                            if (e.ctrlKey) {
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
                    <Icon id={boxes[type]?.icon || "text"} />
                    <p style="margin-left: 10px;">{$dictionary.items?.[type]}</p>
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
        /* min-width: 33%; */
        min-width: 49%;
        flex: 1;
        background-color: var(--primary-darker);
        padding: 20px;
    }
    .grid :global(#icon:hover) {
        background-color: var(--primary-lighter);
    }

    .items p {
        width: auto;
    }
</style>
