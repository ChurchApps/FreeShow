<script lang="ts">
    import type { Item, ItemType, Line, Slide } from "../../../types/Show"
    import type { TabsObj } from "../../../types/Tabs"
    import { activeEdit, activeShow, activeTriggerFunction, copyPasteEdit, overlays, selected, showsCache, storedEditMenuState, templates } from "../../stores"
    import { getAccess } from "../../utils/profile"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { clone } from "../helpers/array"
    import { history } from "../helpers/history"
    import { getLayoutRef } from "../helpers/show"
    import { _show } from "../helpers/shows"
    import { getStyles } from "../helpers/style"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
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
    import { itemBoxes } from "./values/boxes"

    let tabs: TabsObj = {
        text: { name: "items.text", icon: "text" },
        item: { name: "tools.item", icon: "item" },
        items: { name: "tools.items", icon: "items" },
        slide: { name: "tools.slide", icon: "options", overflow: true },
        filters: { name: "edit.filters", icon: "filter", overflow: true }
    }
    let active: string = Object.keys(tabs)[0]
    $: tabs.text.icon = item?.type && itemBoxes[item.type] ? itemBoxes[item.type]!.icon : "text"
    $: tabs.text.name = "items." + (item?.type || "text")

    $: activeId = $activeEdit.id || ""
    $: activeSlide = $activeEdit.slide ?? -1

    // is not template or overlay
    $: isShow = !activeId
    $: tabs.filters.remove = !isShow // TODO: set filters in template / overlay ? ( && $activeEdit.type !== "template")
    $: tabs.slide.remove = (!isShow && $activeEdit.type !== "template") || templateTextMode
    $: if ((tabs.slide.remove && active === "slide") || (tabs.filters.remove && active === "filters")) active = item ? "text" : "items"

    $: templateTextMode = $activeEdit.type === "template" && $templates[activeId]?.settings?.mode === "text"
    $: if (templateTextMode) {
        tabs.item.remove = true
        tabs.items.remove = true
        // tabs.slide.remove = true
    } else {
        tabs.item.remove = false
        tabs.items.remove = false
        // tabs.slide.remove = false
    }
    $: templateItemMode = $activeEdit.type === "template" && $templates[activeId]?.settings?.mode === "item"
    $: if (templateItemMode) {
        if (active === "text") active = item ? "item" : "items"
        tabs.text.remove = true
    } else {
        tabs.text.remove = false
    }

    $: showIsActive = $activeShow && ($activeShow.type === undefined || $activeShow.type === "show")
    $: editSlideSelected = $activeEdit.slide !== null && $activeEdit.slide !== undefined
    $: activeIsShow = $activeShow && ($activeShow.type || "show") === "show"

    $: if ($activeTriggerFunction === "slide_notes") active = "slide"

    let slides: Slide[] = []
    $: if (allSlideItems && (($activeEdit?.id && editSlideSelected) || showIsActive))
        slides = _show($activeEdit?.id || $activeShow?.id)
            .slides()
            .get()

    $: isEmpty = !allSlideItems?.length
    $: tabs.item.disabled = isEmpty
    let previousCount = 0
    $: if (isEmpty || activeId || activeSlide) previousCount = 0
    $: if (item !== undefined) itemChanged()
    function itemChanged() {
        if (item === null) {
            if (active === "text" || active === "item") active = "items"
            tabs.text.disabled = true
            return
        }

        let currentCount = allSlideItems.length
        if (previousCount === currentCount) return
        previousCount = currentCount

        if (active === "items") active = "text"
        tabs.text.disabled = false
    }

    $: ref = getLayoutRef("active", $showsCache)

    $: if (editSlideSelected && activeIsShow && ref.length <= activeSlide && ref.length > 0) activeEdit.set({ slide: 0, items: [], showId: $activeShow?.id })

    let allSlideItems: Item[] = []
    $: {
        if ($activeEdit.type === "overlay") allSlideItems = clone($overlays[activeId]?.items || [])
        else if ($activeEdit.type === "template") allSlideItems = clone($templates[activeId]?.items || [])
        else allSlideItems = editSlideSelected && activeIsShow && ref.length > activeSlide ? clone(_show().slides([ref[activeSlide]?.id]).get("items")[0] || []) : []
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

    function clearClipboard() {
        copyPasteEdit.update((a) => {
            delete a[type]
            return a
        })
    }

    function getItemsStyle(_updater: any = null) {
        if (!items?.length) return [getCurrentStyle()]
        return items.map((item) => getCurrentStyle(item))
    }

    function getCurrentStyle(item: Item | null = null) {
        if (active === "text" && item) return getBoxStyle(item)
        if (active === "item" && item) return getItemStyle(item)
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
        if ($activeEdit.type === "overlay") slides = [$overlays[activeId]]
        else if ($activeEdit.type === "template") slides = [$templates[activeId]]
        else {
            let activeSlides: string[] = []
            // all slides
            if (applyToAll) activeSlides = []
            // selected slides
            else if ($selected.id === "slide" && $selected.data.length) activeSlides = $selected.data.map(({ index }) => ref[index]?.id)
            // active slide
            else activeSlides = [ref[activeSlide]?.id]

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
                if (applyToFollowing) indexes = ref.map((_, i) => i).filter((a) => a >= activeSlide)
                else if (applyToAll) indexes = ref.map((_, i) => i)
                else indexes = [activeSlide]

                return setFilterStyle(styles[0], indexes)
            }
        }
    }

    // RESET

    function reset() {
        if (!isShow) {
            if (active === "item") {
                history({
                    id: "UPDATE",
                    oldData: { id: $activeEdit.id },
                    newData: { key: "items", subkey: "style", data: DEFAULT_ITEM_STYLE, indexes: $activeEdit.items },
                    location: { page: "edit", id: $activeEdit.type + "_items", override: true }
                })
                return
            }

            if (active === "slide") {
                if ($activeEdit.type !== "template") return

                let id = $activeEdit?.id || ""
                history({ id: "UPDATE", newData: { key: "settings", data: {} }, oldData: { id }, location: { page: "edit", id: "template_settings", override: id } })
                return
            }

            if (active !== "text") return

            if ($activeEdit.type === "overlay") overlays.update(updateItemValues)
            else if ($activeEdit.type === "template") templates.update(updateItemValues)

            function updateItemValues(a: any) {
                if (!a[$activeEdit.id!]?.items) return

                $activeEdit.items.forEach((i: number) => {
                    if (!a[$activeEdit.id!].items[i]?.lines) return

                    a[$activeEdit.id!].items[i].lines.forEach((line: Line) => {
                        line.text?.forEach((text) => {
                            text.style = ""
                        })
                    })
                })

                a[$activeEdit.id!].modified = Date.now()
                return a
            }

            return
        }

        let ref = getLayoutRef()
        let slideId = ref[activeSlide]?.id
        if (!slideId) return

        storedEditMenuState.set({})

        if (active === "item") {
            history({
                id: "setStyle",
                newData: { style: { key: "style", values: [DEFAULT_ITEM_STYLE] } },
                location: { page: "edit", show: $activeShow!, slide: slideId, items: $activeEdit.items }
            })
            return
        }

        if (active === "filters") {
            let indexes = [activeSlide]
            if (typeof indexes[0] !== "number") return

            history({ id: "SHOW_LAYOUT", newData: { key: "filterEnabled", data: undefined, indexes } }) // pre 1.4.4
            history({ id: "SHOW_LAYOUT", newData: { key: "filter", data: undefined, indexes } }) // pre 1.5.0
            history({ id: "SHOW_LAYOUT", newData: { key: "backdrop-filter", data: undefined, indexes } })
            return
        }

        if (active === "slide") {
            history({
                id: "slideStyle",
                oldData: { style: _show().slides([slideId]).get("settings")[0] },
                newData: { style: {} },
                location: { page: "edit", show: $activeShow!, slide: slideId }
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
                    slide: slideId,
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
                location: { page: "edit", show: $activeShow!, slide: slideId, items: $activeEdit.items, id: key }
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
                if (!item) return

                let previousItemValue = Number(getStyles(item.style, true)?.[key] || "0")
                let newValue = previousItemValue + value + "px"

                values.push(addStyleString(item.style, [key, newValue]))
            })

            if (activeId) {
                history({
                    id: "UPDATE",
                    oldData: { id: activeId },
                    newData: { key: "items", subkey: "style", data: values, indexes: selectedItems },
                    location: { page: "edit", id: $activeEdit.type + "_items", override: true }
                })
                return
            }

            let ref = getLayoutRef()
            let slideId = ref[activeSlide ?? ""]?.id

            history({
                id: "setItems",
                newData: { style: { key: "style", values } },
                location: { page: "edit", show: $activeShow!, slide: slideId, items: selectedItems, override: "slideitem_" + slideId + "_items_" + selectedItems.join(",") }
            })
        }
    }

    $: slideActive = !!((slides?.length && showIsActive && activeSlide !== null) || activeId)
    let profile = getAccess("shows")
    $: isLocked = activeId ? false : $showsCache[$activeShow?.id || ""]?.locked || profile.global === "read" || profile[$showsCache[$activeShow?.id || ""]?.category || ""] === "read"
    // $: isDefault = $activeEdit.type === "overlay" ? $overlays[activeId || ""]?.isDefault : $activeEdit.type === "template" ? $templates[activeId || ""]?.isDefault : false
    $: overflowHidden = !!(isShow || $activeEdit.type === "template")

    $: currentCopied = $copyPasteEdit[type]
    $: currentItemStyle = getItemsStyle($showsCache[$activeEdit?.id || $activeShow?.id || ""])
    $: copiedStyleDifferent = currentCopied && JSON.stringify(currentCopied) !== JSON.stringify(currentItemStyle)

    // function copyToCreateData() {
    //     const slide = $activeEdit?.type === "overlay" ? $overlays[activeId || ""] : $activeEdit?.type === "template" ? $templates[activeId || ""] : null
    //     if (!slide) return

    //     const newSlide = {
    //         isDefault: true,
    //         name: slide.name,
    //         color: slide.color || null,
    //         category: slide.category,
    //         items: trimItems(clone(slide.items))
    //         // settings
    //     } as typeof slide

    //     navigator.clipboard.writeText(JSON.stringify(newSlide))
    //     newToast("Copied!")

    //     function trimItems(items: Item[]) {
    //         items.forEach((item) => {
    //             if (item.type === "text") delete item.type
    //             if (item.auto === false) delete item.auto

    //             item.lines?.forEach((line, lineIndex) => {
    //                 line.align = (line.align || "").replaceAll(";;", ";")
    //                 if (line.align === ";") line.align = ""

    //                 line.text.forEach((text) => {
    //                     text.value = text.value ? (lineIndex + 1).toString() : ""
    //                     text.style = text.style.replace("color:#FFFFFF;", "")
    //                 })
    //             })
    //         })
    //         return items
    //     }
    // }
</script>

<svelte:window on:keydown={keydown} />

<div class="main border editTools">
    {#if slideActive && !isLocked}
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

        {#if active !== "items"}
            <FloatingInputs>
                {#if copiedStyleDifferent}
                    <MaterialButton icon="paste" title="actions.paste" on:click={() => pasteStyle()}>
                        <T id="actions.paste" />
                    </MaterialButton>

                    <div class="divider"></div>
                {/if}
                {#if currentCopied && !copiedStyleDifferent}
                    {#if isShow}
                        {#if active === "filters"}
                            <MaterialButton icon="down" title="actions.to_following" on:click={() => pasteStyle(false, true)}>
                                <!-- <T id="actions.to_following" /> -->
                            </MaterialButton>

                            <div class="divider"></div>
                        {/if}
                        <MaterialButton icon="paste" title="actions.to_all" on:click={() => pasteStyle(true)}>
                            <T id="actions.to_all" />
                        </MaterialButton>
                    {/if}
                {:else}
                    <MaterialButton disabled={!currentItemStyle?.length} title="actions.copy" on:click={copyStyle}>
                        <Icon id="copy" white={copiedStyleDifferent} />
                        {#if !copiedStyleDifferent}<T id="actions.copy" />{/if}
                    </MaterialButton>
                {/if}

                <div class="divider"></div>

                <!-- && !copiedStyleDifferent -->
                {#if currentCopied}
                    <MaterialButton icon="clear" title="clear.general: formats.clipboard" on:click={clearClipboard}></MaterialButton>
                {:else}
                    <MaterialButton icon="reset" title="actions.reset" on:click={reset}>
                        <!-- {#if !isShow}<T id="actions.reset" />{/if} -->
                    </MaterialButton>
                {/if}
            </FloatingInputs>
        {/if}

        <!-- <span style="display: flex;flex-wrap: wrap;white-space: nowrap;">
            {#if $activeEdit.type === "template" || $activeEdit.type === "overlay"}
                <Button style="flex: 1;" title={translateText("actions.copy")} on:click={copyToCreateData} dark center>
                    <Icon id="copy" right />
                    DEV: Copy to "createData"
                </Button>
            {/if}
        </span> -->
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

        padding-bottom: 50px;
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
