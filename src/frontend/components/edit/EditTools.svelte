<script lang="ts">
    import type { Item, ItemType, Slide } from "../../../types/Show"
    import type { TabsObj } from "../../../types/Tabs"
    import { activeEdit, activeShow, activeTriggerFunction, copyPasteEdit, dictionary, overlays, selected, showsCache, storedEditMenuState, templates } from "../../stores"
    import { newToast } from "../../utils/common"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { clone } from "../helpers/array"
    import { history } from "../helpers/history"
    import { getLayoutRef } from "../helpers/show"
    import { _show } from "../helpers/shows"
    import { getStyles } from "../helpers/style"
    import Button from "../inputs/Button.svelte"
    import Tabs from "../main/Tabs.svelte"
    import Center from "../system/Center.svelte"
    import { getBoxStyle, getFilterStyle, getItemStyle, getSlideStyle, setBoxStyle, setFilterStyle, setItemStyle, setSlideStyle } from "./scripts/itemClipboard"
    import { DEFAULT_ITEM_STYLE } from "./scripts/itemHelpers"
    import { addStyleString } from "./scripts/textStyle"
    import BoxStyle from "./tools/BoxStyle.svelte"
    import ItemStyle from "./tools/ItemStyle.svelte"
    import Items from "./tools/Items.svelte"
    import SlideFilters from "./tools/SlideFilters.svelte"
    import SlideStyle from "./tools/SlideStyle.svelte"
    import TemplateStyle from "./tools/TemplateStyle.svelte"
    import { boxes } from "./values/boxes"

    let tabs: TabsObj = {
        text: { name: "items.text", icon: "text" },
        item: { name: "tools.item", icon: "item" },
        items: { name: "tools.items", icon: "items" },
        slide: { name: "tools.slide", icon: "options", overflow: true },
        filters: { name: "edit.filters", icon: "filter", overflow: true }
    }
    let active: string = Object.keys(tabs)[0]
    $: tabs.text.icon = item?.type && boxes[item.type] ? boxes[item.type]!.icon : "text"
    $: tabs.text.name = "items." + (item?.type || "text")

    // is not template or overlay
    $: isShow = !$activeEdit.id
    $: tabs.filters.remove = !isShow // TODO: set filters in template / overlay ?
    $: tabs.slide.remove = !isShow && $activeEdit.type !== "template"
    $: if ((tabs.slide.remove && active === "slide") || (tabs.filters.remove && active === "filters")) active = item ? "text" : "items"

    $: showIsActive = $activeShow && ($activeShow.type === undefined || $activeShow.type === "show")
    $: editSlideSelected = $activeEdit.slide !== null && $activeEdit.slide !== undefined
    $: activeIsShow = $activeShow && ($activeShow.type || "show") === "show"

    $: if ($activeTriggerFunction === "slide_notes") active = "slide"

    let slides: Slide[] = []
    $: if (allSlideItems && (($activeEdit?.id && editSlideSelected) || showIsActive))
        slides = _show($activeEdit?.id || $activeShow?.id)
            .slides()
            .get()

    // WIP better way of updating all of this
    $: if (!item && !tabs.text.disabled) {
        if (active === "text" || active === "item") active = "items"
        tabs.text.disabled = true
    } else if (item && tabs.text.disabled) {
        // open item options when the first one is created (on an empty slide)
        if (active === "items" && allSlideItems.length === 1) active = "text"
        // TODO: false triggers (arranging items)
        tabs.text.disabled = false
        // } else if (item && active !== "text" && active !== "items") {
        //     active = "text"
    }
    $: if (!allSlideItems?.length && !tabs.item.disabled) {
        tabs.item.disabled = true
    } else if (allSlideItems?.length && tabs.item.disabled) {
        tabs.item.disabled = false
    }

    $: ref = getLayoutRef("active", $showsCache)

    $: if (editSlideSelected && activeIsShow && ref.length <= $activeEdit.slide! && ref.length > 0) activeEdit.set({ slide: 0, items: [], showId: $activeShow?.id })

    let allSlideItems: Item[] = []
    $: {
        if ($activeEdit.type === "overlay") allSlideItems = clone($overlays[$activeEdit.id!]?.items || [])
        else if ($activeEdit.type === "template") allSlideItems = clone($templates[$activeEdit.id!]?.items || [])
        else allSlideItems = editSlideSelected && activeIsShow && ref.length > $activeEdit.slide! ? clone(_show().slides([ref[$activeEdit.slide!]?.id]).get("items")[0] || []) : []
    }
    const getItemsByIndex = (array: number[]): Item[] => array.map((i) => allSlideItems[i])

    // select active items or all items
    $: items = $activeEdit.items.length ? getItemsByIndex($activeEdit.items.sort((a, b) => a - b)) : allSlideItems
    // select last item
    $: item = items?.length ? items[items.length - 1] : null

    // COPY

    $: itemType = active === "text" ? item?.type || "text" : ""
    $: type = `${active}${itemType}`
    function copyStyle() {
        const styles = getItemsStyle()

        copyPasteEdit.update((a) => {
            a[type] = styles
            return a
        })

        console.log("COPIED STYLE", $copyPasteEdit)
    }

    function getItemsStyle(_updater: any = null) {
        return items.map((item) => getCurrentStyle(item))
    }

    function getCurrentStyle(item) {
        if (active === "text") return getBoxStyle(item)
        if (active === "item") return getItemStyle(item)
        if (active === "slide") return getSlideStyle()
        if (active === "filters") return getFilterStyle()
        return null
    }

    // PASTE

    function pasteStyle(applyToAll = false, applyToFollowing = false) {
        let styles = $copyPasteEdit[type]
        if (!Array.isArray(styles)) return

        // get selected slide(s)
        let slides: any[] = []
        if ($activeEdit.type === "overlay") slides = [$overlays[$activeEdit.id!]]
        else if ($activeEdit.type === "template") slides = [$templates[$activeEdit.id!]]
        else {
            let activeSlides: string[] = []
            // all slides
            if (applyToAll) activeSlides = []
            // selected slides
            else if ($selected.id === "slide" && $selected.data.length) activeSlides = $selected.data.map(({ index }) => ref[index]?.id)
            // active slide
            else activeSlides = [ref[$activeEdit.slide!]?.id]

            slides = _show().slides(activeSlides).get()
        }

        slides = clone(slides)

        setNewStyle()
        function setNewStyle() {
            if (active === "text") return setBoxStyle(styles, slides, itemType as ItemType)
            if (active === "item") return setItemStyle(styles, slides)
            if (active === "slide") return setSlideStyle(styles[0], slides)
            if (active === "filters") {
                let indexes: number[] = []
                if (applyToFollowing) indexes = ref.map((_, i) => i).filter((a) => a >= $activeEdit.slide!)
                else if (applyToAll) indexes = ref.map((_, i) => i)
                else indexes = [$activeEdit.slide!]

                return setFilterStyle(styles[0], indexes)
            }
        }
    }

    // RESET

    function reset() {
        if (!isShow) {
            if ($activeEdit.type === "template" && active === "slide") {
                let id = $activeEdit?.id || ""
                history({ id: "UPDATE", newData: { key: "settings", data: {} }, oldData: { id }, location: { page: "edit", id: "template_settings", override: id } })
                return
            }

            return
        }

        let ref = getLayoutRef()
        let slide = ref[$activeEdit.slide!].id
        if (!slide) return

        storedEditMenuState.set({})

        if (active === "item") {
            history({
                id: "setStyle",
                newData: { style: { key: "style", values: [DEFAULT_ITEM_STYLE] } },
                location: { page: "edit", show: $activeShow!, slide, items: $activeEdit.items }
            })
            return
        }

        if (active === "filters") {
            let indexes = [$activeEdit.slide]
            if (typeof indexes[0] !== "number") return

            history({ id: "SHOW_LAYOUT", newData: { key: "filterEnabled", data: undefined, indexes } }) // pre 1.4.4
            history({ id: "SHOW_LAYOUT", newData: { key: "filter", data: undefined, indexes } })
            history({ id: "SHOW_LAYOUT", newData: { key: "backdrop-filter", data: undefined, indexes } })
            return
        }

        if (active === "slide") {
            history({
                id: "slideStyle",
                oldData: { style: _show().slides([slide]).get("settings")[0] },
                newData: { style: {} },
                location: { page: "edit", show: $activeShow!, slide }
            })
            return
        }

        if (active !== "text") return

        let values: any = []
        items.forEach((item) => {
            if (item.lines) {
                let text = item.lines.map((a) => {
                    return a.text.map((a) => {
                        a.style = ""
                        return a
                    })
                })
                values.push(text)
            }
        })

        // let selectedItems = $activeEdit.items.length ? $activeEdit.items : Object.keys(allSlideItems)
        if (values.length) {
            history({
                id: "textStyle",
                newData: { style: { key: "text", values } },
                location: {
                    page: "edit",
                    show: $activeShow!,
                    slide,
                    items: $activeEdit.items
                }
            })
        }

        let deleteKeys = ["auto", "textFit", "specialStyle", "scrolling"]
        // reset timer/icon/media/mirror etc. style
        if (item && item[item.type || ""]) deleteKeys = [item.type!]

        deleteKeys.forEach((key) => {
            history({
                id: "setItems",
                newData: { style: { key, values: [undefined] } },
                location: { page: "edit", show: $activeShow!, slide, items: $activeEdit.items, id: key }
            })
        })

        // WIP refresh edit tools after resetting
    }

    function keydown(e: KeyboardEvent) {
        if (document.activeElement?.closest(".edit")) return

        // move items with arrow keys
        if (e.key.includes("Arrow") && $activeEdit.items.length) {
            e.preventDefault()

            const key = ["ArrowLeft", "ArrowRight"].includes(e.key) ? "left" : "top"
            let value = ["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 1
            if (e.ctrlKey || e.metaKey) value *= 10

            let selectedItems: number[] = $activeEdit.items || allSlideItems.map((_, i) => i)
            if (!selectedItems.length) return

            let values: string[] = []

            selectedItems.forEach((index) => {
                let item = allSlideItems[index]
                let previousItemValue = Number(getStyles(item.style, true)?.[key] || "0")
                let newValue = previousItemValue + value + "px"

                values.push(addStyleString(item.style, [key, newValue]))
            })

            if ($activeEdit.id) {
                history({
                    id: "UPDATE",
                    oldData: { id: $activeEdit.id },
                    newData: { key: "items", subkey: "style", data: values, indexes: selectedItems },
                    location: { page: "edit", id: $activeEdit.type + "_items", override: true }
                })
                return
            }

            let ref = getLayoutRef()
            let slideId = ref[$activeEdit.slide ?? ""]?.id

            history({
                id: "setItems",
                newData: { style: { key: "style", values } },
                location: { page: "edit", show: $activeShow!, slide: slideId, items: selectedItems, override: "slideitem_" + slideId + "_items_" + selectedItems.join(",") }
            })
        }
    }

    $: slideActive = !!((slides?.length && showIsActive && $activeEdit.slide !== null) || $activeEdit.id)
    $: isLocked = $activeEdit.id ? false : $showsCache[$activeShow?.id || ""]?.locked === true
    $: isDefault = $activeEdit.type === "overlay" ? $overlays[$activeEdit.id || ""]?.isDefault : $activeEdit.type === "template" ? $templates[$activeEdit.id || ""]?.isDefault : false
    $: overflowHidden = !!(isShow || $activeEdit.type === "template")

    $: currentCopied = $copyPasteEdit[type]
    $: copiedStyleDifferent = currentCopied && JSON.stringify(currentCopied) !== JSON.stringify(getItemsStyle($showsCache[$activeEdit?.id || $activeShow?.id || ""]))

    function copyToCreateData() {
        const slide = $activeEdit?.type === "overlay" ? $overlays[$activeEdit.id || ""] : $activeEdit?.type === "template" ? $templates[$activeEdit.id || ""] : null
        if (!slide) return

        const newSlide = {
            isDefault: true,
            name: slide.name,
            color: slide.color || null,
            category: slide.category,
            items: trimItems(clone(slide.items))
            // settings
        } as typeof slide

        navigator.clipboard.writeText(JSON.stringify(newSlide))
        newToast("Copied!")

        function trimItems(items: Item[]) {
            items.forEach((item) => {
                if (item.type === "text") delete item.type
                if (item.auto === false) delete item.auto

                item.lines?.forEach((line, lineIndex) => {
                    line.align = line.align.replaceAll(";;", ";")
                    if (line.align === ";") line.align = ""

                    line.text.forEach((text) => {
                        text.value = text.value ? (lineIndex + 1).toString() : ""
                        text.style = text.style.replace("color:#FFFFFF;", "")
                    })
                })
            })
            return items
        }
    }
</script>

<svelte:window on:keydown={keydown} />

<div class="main border editTools">
    {#if slideActive && !isLocked && !isDefault}
        <Tabs {tabs} bind:active {overflowHidden} />

        {#if active === "text"}
            <div class="content">
                {#if item}
                    <BoxStyle id={item?.type || "text"} bind:allSlideItems bind:item />
                {:else}
                    <Center faded>
                        <T id="empty.items" />
                    </Center>
                {/if}
            </div>
        {:else if active === "item"}
            <div class="content">
                <ItemStyle bind:allSlideItems bind:item />
            </div>
        {:else if active === "items"}
            <div class="content">
                <Items bind:allSlideItems />
            </div>
        {:else if active === "filters"}
            <div class="content">
                <SlideFilters />
            </div>
        {:else if active === "slide"}
            <div class="content">
                {#if $activeEdit.type === "template"}
                    <TemplateStyle />
                {:else}
                    <SlideStyle />
                {/if}
            </div>
        {/if}

        <span style="display: flex;flex-wrap: wrap;white-space: nowrap;">
            {#if active !== "items"}
                {#if isShow}
                    <!-- WIP copy/paste style for overlay/templates! -->

                    {#if currentCopied && !copiedStyleDifferent}
                        {#if isShow}
                            {#if active === "filters"}
                                <Button title={$dictionary.actions?.to_following} on:click={() => pasteStyle(false, true)} dark center>
                                    <Icon id="down" />
                                    <!-- <T id="actions.to_following" /> -->
                                </Button>
                            {/if}
                            <Button style="flex: 1;" title={$dictionary.actions?.to_all} on:click={() => pasteStyle(true)} dark center>
                                <Icon id="paste" right />
                                <T id="actions.to_all" />
                            </Button>
                        {/if}
                    {:else}
                        <Button style={copiedStyleDifferent ? "" : "flex: 1;"} title={$dictionary.actions?.copy} on:click={copyStyle} dark center>
                            <Icon id="copy" right={!copiedStyleDifferent} white />
                            {#if !copiedStyleDifferent}<T id="actions.copy" />{/if}
                        </Button>
                    {/if}
                    {#if copiedStyleDifferent}
                        <Button style="flex: 1;" title={$dictionary.actions?.paste} on:click={() => pasteStyle()} dark center>
                            <Icon id="paste" right />
                            <T id="actions.paste" />
                        </Button>
                    {/if}
                {/if}

                <!-- TODO: reset template/overlay -->
                <Button style="flex: 1;" title={$dictionary.actions?.reset} on:click={reset} disabled={!isShow && ($activeEdit.type !== "template" || active !== "slide")} dark center>
                    <Icon id="reset" right />
                    <T id="actions.reset" />
                </Button>

                {#if true && ($activeEdit.type === "template" || $activeEdit.type === "overlay")}
                    <Button style="flex: 1;" title={$dictionary.actions?.copy} on:click={copyToCreateData} dark center>
                        <Icon id="copy" right />
                        DEV: Copy to "createData"
                    </Button>
                {/if}
            {/if}
        </span>
    {:else if !isLocked}
        <Center faded>
            <T id="empty.slides" />
        </Center>
    {/if}
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        height: 100%;
    }

    .content {
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
    }
    .content :global(section) {
        padding: 10px;
        /* flex: 1; */
        /* height: 100%; */
    }
    .content :global(section div) {
        display: flex;
        justify-content: space-between;
    }
</style>
