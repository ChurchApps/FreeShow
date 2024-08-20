<script lang="ts">
    import type { Item } from "../../../types/Show"
    import type { TabsObj } from "../../../types/Tabs"
    import { activeEdit, activeShow, overlays, showsCache, storedEditMenuState, templates } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { clone } from "../helpers/array"
    import { history } from "../helpers/history"
    import { _show } from "../helpers/shows"
    import { getStyles } from "../helpers/style"
    import Button from "../inputs/Button.svelte"
    import Tabs from "../main/Tabs.svelte"
    import Center from "../system/Center.svelte"
    import BoxStyle from "./tools/BoxStyle.svelte"
    import ItemStyle from "./tools/ItemStyle.svelte"
    import Items from "./tools/Items.svelte"
    import SlideFilters from "./tools/SlideFilters.svelte"
    import SlideStyle from "./tools/SlideStyle.svelte"
    import TemplateStyle from "./tools/TemplateStyle.svelte"
    import { boxes } from "./values/boxes"
    import { itemEdits } from "./values/item"

    let tabs: TabsObj = {
        text: { name: "items.text", icon: "text" },
        item: { name: "tools.item", icon: "item" },
        items: { name: "tools.items", icon: "items" },
        slide: { name: "tools.slide", icon: "options", overflow: true },
        filters: { name: "edit.filters", icon: "filter", overflow: true },
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

    let slides: any[] = []
    $: if (allSlideItems && (($activeEdit?.id && editSlideSelected) || showIsActive))
        slides = _show($activeEdit?.id || $activeShow?.id)
            .slides()
            .get()

    // WIP better way of updating all of this
    $: if (!item && !tabs.text.disabled) {
        active = "items"
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

    $: ref = [$showsCache, _show().layouts("active").ref()[0] || {}][1]

    $: if (editSlideSelected && activeIsShow && ref.length <= $activeEdit.slide! && ref.length > 0) activeEdit.set({ slide: 0, items: [], showId: $activeShow?.id })

    $: allSlideItems = editSlideSelected && activeIsShow && ref.length > $activeEdit.slide! ? clone(_show().slides([ref[$activeEdit.slide!]?.id]).get("items")[0] || []) : []
    $: if ($activeEdit.type === "overlay") allSlideItems = clone($overlays[$activeEdit.id!]?.items || [])
    $: if ($activeEdit.type === "template") allSlideItems = clone($templates[$activeEdit.id!]?.items || [])
    const getItemsByIndex = (array: number[]): Item[] => array.map((i) => allSlideItems[i])

    // select active items or all items
    $: items = $activeEdit.items.length ? getItemsByIndex($activeEdit.items.sort((a, b) => a - b)) : allSlideItems
    // select last item
    $: item = items?.length ? items[items.length - 1] : null

    function applyStyleToAllSlides() {
        if (!isShow) return
        let type = item?.type || "text"

        // just replace item style or anything else if not textbox
        let itemKeys: string[] = []
        if (type !== "text" && (active === "text" || active === "item")) {
            Object.values(itemEdits).forEach((values) => {
                itemKeys.push(...values.map((a) => a.key || ""))
            })
        }

        if (active === "text") {
            // get current text style
            // don't style scripture verses
            let normalText = item?.lines?.[0].text?.filter((a) => !a.customType) || []
            let style = normalText[0]?.style || item?.style
            let extraKeys = {
                auto: item?.auto,
                specialStyle: item?.specialStyle,
                scrolling: item?.scrolling,
            }

            let newStyle: string = ""
            // remove all "item" style from new style
            if (type !== "text") {
                let newStyles: any = getStyles(style)
                Object.entries(newStyles).forEach(([key, value]: any) => {
                    if (!itemKeys.includes(key)) newStyle += `${key}: ${value};`
                })
            }

            _show().slides().get().forEach(updateSlideStyle)

            return

            function updateSlideStyle(slide) {
                let items: any[] = []
                let values: any[] = []

                slide.items.forEach(updateItemStyle)

                if (!items.length || !values.length) return

                if (type !== "text") {
                    history({
                        id: "setStyle",
                        newData: { style: { key: "style", values } },
                        location: { page: "edit", show: $activeShow!, slide: slide.id, items },
                    })

                    return
                }

                history({
                    id: "textStyle",
                    newData: { style: { key: "text", values } },
                    location: { page: "edit", show: $activeShow!, slide: slide.id, items },
                })

                Object.keys(extraKeys).forEach((key) => {
                    history({
                        id: "setItems",
                        newData: { style: { key, values: [extraKeys[key]] } },
                        location: { page: "edit", show: $activeShow!, slide: slide.id, items },
                    })
                })

                function updateItemStyle(item: any, i: number) {
                    let itemType = item.type || "text"
                    if (itemType !== type) return

                    items.push(i)

                    if (type !== "text") {
                        let itemStyles = getStyles(item.style)
                        let newItemStyle = ""

                        // get only current "item" style
                        Object.entries(itemStyles).forEach(([key, value]: any) => {
                            if (itemKeys.includes(key)) newItemStyle += `${key}: ${value};`
                        })

                        values.push(newItemStyle + newStyle)

                        return
                    }

                    if (type !== "text" || !item.lines) return

                    let text = item.lines.map((a: any) => {
                        if (!a.text) return

                        return a.text.map((a: any) => {
                            // don't style scripture verses
                            if (a.customType) return a

                            a.style = style

                            return a
                        })
                    })

                    values.push(text)
                }
            }
        }

        if (active === "item") {
            // get current item style
            let style = item?.style
            if (!style) return

            let newStyle: string = ""
            // get only "item" style from new style
            if (type !== "text") {
                let newStyles: any = getStyles(style)
                Object.entries(newStyles).forEach(([key, value]: any) => {
                    if (itemKeys.includes(key)) newStyle += `${key}: ${value};`
                })
            }

            _show().slides().get().forEach(updateSlideStyle)

            return

            function updateSlideStyle(slide) {
                let values: string[] = []
                if (type === "text") values = [style!]

                let items: number[] = []
                slide.items.forEach(updateItemStyle)

                history({
                    id: "setStyle",
                    newData: { style: { key: "style", values } },
                    location: { page: "edit", show: $activeShow!, slide: slide.id, items },
                })

                function updateItemStyle(item, i) {
                    if ((item.type || "text") !== type) return

                    items.push(i)

                    // get only current style
                    let itemStyles = getStyles(item.style)
                    let newItemStyle = ""

                    // get only current "item" style
                    Object.entries(itemStyles).forEach(([key, value]: any) => {
                        if (!itemKeys.includes(key)) newItemStyle += `${key}: ${value};`
                    })

                    values.push(newStyle + newItemStyle)
                }
            }
        }

        if (active === "filters") {
            let ref = _show().layouts("active").ref()[0]
            let slideData = ref[$activeEdit.slide!].data
            let indexes = ref.map((_, i) => i)

            history({ id: "SHOW_LAYOUT", newData: { key: "filterEnabled", data: slideData.filterEnabled || ["background"], dataIsArray: true, indexes } })
            history({ id: "SHOW_LAYOUT", newData: { key: "backdrop-filter", data: slideData["backdrop-filter"], indexes } })
            history({ id: "SHOW_LAYOUT", newData: { key: "filter", data: slideData.filter, indexes } })
            return
        }

        if (active === "slide") {
            let ref = _show().layouts("active").ref()[0]
            let slideStyle = _show().slides([ref[$activeEdit.slide!].id]).get("settings")[0]

            _show().slides().get().forEach(updateSlideStyle)

            return

            function updateSlideStyle(slide) {
                let oldData = { style: slide.settings }

                history({
                    id: "slideStyle",
                    oldData,
                    newData: { style: slideStyle },
                    location: { page: "edit", show: $activeShow!, slide: slide.id },
                })
            }
        }
    }

    function addToFollowing() {
        if (active !== "filters") return

        let ref = _show().layouts("active").ref()[0]
        let slideData = ref[$activeEdit.slide!].data
        let indexes = ref.map((_, i) => i).filter((a) => a >= $activeEdit.slide!)

        history({ id: "SHOW_LAYOUT", newData: { key: "filterEnabled", data: slideData.filterEnabled || ["background"], dataIsArray: true, indexes } })
        history({ id: "SHOW_LAYOUT", newData: { key: "backdrop-filter", data: slideData["backdrop-filter"], indexes } })
        history({ id: "SHOW_LAYOUT", newData: { key: "filter", data: slideData.filter, indexes } })
    }

    function reset() {
        if (!isShow) {
            if ($activeEdit.type === "template" && active === "slide") {
                let id = $activeEdit?.id || ""
                history({ id: "UPDATE", newData: { key: "settings", data: {} }, oldData: { id }, location: { page: "edit", id: "template_settings", override: id } })
                return
            }

            return
        }

        let ref = _show().layouts("active").ref()[0]
        let slide = ref[$activeEdit.slide!].id
        if (!slide) return

        storedEditMenuState.set({})

        if (active === "item") {
            history({
                id: "setStyle",
                newData: { style: { key: "style", values: ["top:120px;left:50px;height:840px;width:1820px;"] } },
                location: { page: "edit", show: $activeShow!, slide, items: $activeEdit.items },
            })
            return
        }

        if (active === "filters") {
            let indexes = [$activeEdit.slide]
            if (typeof indexes[0] !== "number") return

            history({ id: "SHOW_LAYOUT", newData: { key: "filterEnabled", data: undefined, indexes } })
            history({ id: "SHOW_LAYOUT", newData: { key: "filter", data: undefined, indexes } })
            return
        }

        if (active === "slide") {
            history({
                id: "slideStyle",
                oldData: { style: _show().slides([slide]).get("settings")[0] },
                newData: { style: {} },
                location: { page: "edit", show: $activeShow!, slide },
            })
            return
        }

        if (active !== "text") return

        // TODO: reset timer/icon/media/mirror style

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

        if (!values.length) return

        // let selectedItems = $activeEdit.items.length ? $activeEdit.items : Object.keys(allSlideItems)
        history({
            id: "textStyle",
            newData: { style: { key: "text", values } },
            location: {
                page: "edit",
                show: $activeShow!,
                slide,
                items: $activeEdit.items,
            },
        })

        const deleteKeys = ["auto", "specialStyle", "scrolling"]
        deleteKeys.forEach((key) => {
            history({
                id: "setItems",
                newData: { style: { key, values: [undefined] } },
                location: { page: "edit", show: $activeShow!, slide, items: $activeEdit.items, id: key },
            })
        })
    }

    $: slideActive = !!((slides?.length && showIsActive && $activeEdit.slide !== null) || $activeEdit.id)
    $: overflowHidden = !!(isShow || $activeEdit.type === "template")
</script>

<div class="main border editTools">
    {#if slideActive}
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
                    <Button style="flex: 1;" on:click={applyStyleToAllSlides} dark center>
                        <Icon id="copy" right />
                        <T id={"actions.to_all"} />
                    </Button>
                {/if}
                {#if active === "filters"}
                    <Button style="flex: 1;" on:click={addToFollowing} dark center>
                        <Icon id="down" right />
                        <T id={"actions.to_following"} />
                    </Button>
                {/if}
                <!-- TODO: reset template/overlay -->
                <Button style="flex: 1;" on:click={reset} disabled={!isShow && ($activeEdit.type !== "template" || active !== "slide")} dark center>
                    <Icon id="reset" right />
                    <T id={"actions.reset"} />
                </Button>
            {/if}
        </span>
    {:else}
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
