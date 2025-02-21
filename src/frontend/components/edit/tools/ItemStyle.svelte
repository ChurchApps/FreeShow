<script lang="ts">
    import { uid } from "uid"
    import type { Item } from "../../../../types/Show"
    import { activeEdit, activeShow, selected, showsCache } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { _show } from "../../helpers/shows"
    import { getFilters, getStyles } from "../../helpers/style"
    import { getBackgroundOpacity, setBackgroundColor } from "../scripts/edit"
    import { addFilterString, addStyleString } from "../scripts/textStyle"
    import { itemEdits } from "../values/item"
    import EditValues from "./EditValues.svelte"
    import { setBoxInputValue } from "../values/boxes"
    import { percentageToAspectRatio, stylePosToPercentage } from "../../helpers/output"

    export let allSlideItems: Item[]
    export let item: Item | null

    let itemEditValues = clone(itemEdits)

    let data: { [key: string]: any } = {}

    $: if (item?.style || item === null) updateData()
    function updateData() {
        data = getStyles(item?.style, true)
        dataChanged()
    }

    // CSS
    $: if (itemEditValues?.CSS && item?.style) itemEditValues.CSS[0].value = item.style

    // $: if (data) dataChanged()
    function dataChanged() {
        setBoxInputValue({ icon: "", edit: itemEditValues }, "default", "background-opacity", "hidden", !data["background-color"])

        data = stylePosToPercentage(data)
    }

    $: itemBackFilters = getStyles(item?.style)["backdrop-filter"]
    $: if (itemBackFilters) getItemFilters()
    function getItemFilters() {
        if (!item) return

        // update backdrop filters
        let backdropFilters = getFilters(itemBackFilters || "")
        let defaultBackdropFilters = itemEditValues.backdrop_filters || []
        itemEditValues.backdrop_filters.forEach((filter: any) => {
            let value = backdropFilters[filter.key] ?? defaultBackdropFilters.find((a) => a.key === filter.key)?.value
            let index = itemEditValues.backdrop_filters.findIndex((a: any) => a.key === filter.key)
            itemEditValues.backdrop_filters[index].value = value
        })
    }

    $: if (item) itemEditValues = getBackgroundOpacity(itemEditValues, data)

    function updateStyle(e: any) {
        let input = e.detail
        input = percentageToAspectRatio(input)

        console.log(input)

        if (input.id === "backdrop-filter" || input.id === "transform") {
            let oldString = input.id === "backdrop-filter" ? itemBackFilters : data[input.id]
            input.value = addFilterString(oldString || "", [input.key, input.value])
            input.key = input.id
        }

        // background opacity
        if (input.id === "background-opacity" || (input.value && input.key === "background-color")) {
            input = setBackgroundColor(input, data)
            setTimeout(() => getBackgroundOpacity(itemEditValues, data), 100)
        }

        let allItems: number[] = $activeEdit.items

        // update all items if nothing is selected
        if (!allItems.length) allSlideItems.forEach((_item, i) => allItems.push(i))

        // reverse to get same order as "Item" & "Items" etc., uses
        allItems = allItems.reverse()

        /////

        let ref: any[] = _show("active").layouts("active").ref()[0] || {}
        let slides: string[] = [ref[$activeEdit.slide ?? ""]?.id]
        let slideItems: number[][] = [allItems]
        let showSlides = $showsCache[$activeShow?.id || ""]?.slides || {}

        // get all selected slides
        if ($selected.id === "slide") {
            let selectedSlides = $selected.data.filter(({ index }) => index !== $activeEdit.slide!)
            slides.push(...selectedSlides.map(({ index }) => ref[index]?.id))

            slides.forEach((id, i) => {
                if (i === 0) return
                if (!showSlides[id]) {
                    slideItems.push([])
                    return
                }

                let currentItems = showSlides[id].items
                let currentItemIndexes = currentItems.map((_item, i) => i)
                slideItems.push(currentItemIndexes)
            })
        }

        /////

        let values: any = {}

        // get relative value
        let relativeValue = 0
        if (input.relative) {
            let items = showSlides[slides[0]]?.items || allSlideItems
            let firstItemStyle = items?.[allItems[0]]?.style || ""
            let previousValue = Number(getStyles(firstItemStyle, true)?.[input.key] || "0")
            relativeValue = Number(input.value.replace("px", "")) - previousValue
        }

        slides.forEach((slide, i) => {
            if (!slideItems[i].length) return
            values[slide] = []

            // loop through all items
            slideItems[i].forEach((itemIndex) => {
                let currentSlideItem = showSlides[slide]?.items?.[itemIndex] || allSlideItems[itemIndex]

                let newValue = input.value
                if (input.relative) {
                    let previousItemValue = Number(getStyles(currentSlideItem.style, true)?.[input.key] || "0")
                    newValue = previousItemValue + relativeValue + "px"
                }

                values[slide].push(addStyleString(currentSlideItem.style, [input.key, newValue]))
            })
        })

        if (input.id === "CSS") {
            values = { [slides[0]]: [input.value.replaceAll("\n", "")] }
            // only change one selected
            allItems = [allItems[0]]
        }

        console.log(values)
        if (!Object.values(values).length) return

        if ($activeEdit.id) {
            history({
                id: "UPDATE",
                oldData: { id: $activeEdit.id },
                newData: { key: "items", subkey: "style", data: Object.values(values)[0], indexes: allItems },
                location: { page: "edit", id: $activeEdit.type + "_items", override: true },
            })
            return
        }

        slides.forEach((slide, i) => {
            if (!slideItems[i].length) return
            history({
                id: "setItems",
                newData: { style: { key: "style", values: values[slide] } },
                location: { page: "edit", show: $activeShow!, slide, items: slideItems[i], override: "slideitem_" + slide + "_items_" + slideItems[i].join(",") },
            })
        })
    }

    let sessionId = ""
    if (item) sessionId = uid()
</script>

{#key item}
    <EditValues edits={itemEditValues} defaultEdits={clone(itemEdits)} styles={data} {item} on:change={updateStyle} {sessionId} />
{/key}
