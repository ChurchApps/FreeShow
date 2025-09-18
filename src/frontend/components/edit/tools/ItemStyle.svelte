<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import { activeEdit, activeShow, selected, showsCache } from "../../../stores"
    import { wait } from "../../../utils/common"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { percentageToAspectRatio, stylePosToPercentage } from "../../helpers/output"
    import { getLayoutRef } from "../../helpers/show"
    import { getStyles } from "../../helpers/style"
    import { addFilterString, addStyleString } from "../scripts/textStyle"
    import { setBoxInputValue } from "../values/boxes"
    import { itemSections } from "../values/item"
    import EditValues from "./EditValues.svelte"

    export let allSlideItems: Item[]
    export let item: Item | null

    let currentItemSections = clone(itemSections)

    let data: { [key: string]: string } = {}

    $: if (item?.style || item === null) updateData()
    function updateData() {
        data = getStyles(item?.style, true)
        dataChanged()
    }

    // $: if (data) dataChanged()
    function dataChanged() {
        // gradient
        const styles = getStyles(item?.style)
        const isGradient = styles.background?.includes("gradient")
        if (isGradient) data["background-color"] = styles.background

        // setBoxInputValue({ icon: "", edit: itemEditValues }, "default", "background-opacity", "hidden", isGradient || !data["background-color"])

        const transform = data["transform"] || ""
        const showPerspective = transform.includes("rotateX") && !transform.includes("rotateX(0deg)")
        setBoxInputValue(currentItemSections, "transform", "perspective", "hidden", !showPerspective)

        data = stylePosToPercentage(data)
    }

    $: itemBackFilters = getStyles(item?.style)["backdrop-filter"]
    // $: if (itemBackFilters) getItemFilters()
    // function getItemFilters() {
    //     if (!item) return

    //     itemEditValues.backdrop_filters?.inputs.forEach((a) => {
    //         a.flat().forEach((filter) => {
    //             let value = backdropFilters?.[filter.key || ""]
    //             if (value) filter.values.value = value
    //         })
    //     })
    // }

    async function updateStyle(e: any) {
        let input = e.detail
        input = percentageToAspectRatio(input)

        if (input.id === "backdrop-filter" || input.id === "transform") {
            let oldString = input.id === "backdrop-filter" ? itemBackFilters : data[input.id]
            input.value = addFilterString(oldString || "", [input.key, input.value])
            input.key = input.id
        }

        // gradient colors
        if (input.id === "style" && input.key === "background-color") {
            // set "background" value instead of "background-color"
            if (input.value.includes("gradient")) input.key = "background"
            // reset "background" value
            else if (data.background) {
                updateStyle({ detail: { ...input, key: "background", value: "" } })
                await wait(10)
            }
        }

        let allItems: number[] = $activeEdit.items

        // update all items if nothing is selected
        if (!allItems.length) allSlideItems.forEach((_item, i) => allItems.push(i))

        /////

        let ref = getLayoutRef()
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

        let values: { [key: string]: string[] } = {}

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

        if (input.id.includes("CSS")) {
            values = { [slides[0]]: [input.value] }
            // only change one selected
            allItems = [allItems[0]]
        }

        if (!Object.values(values).length) return

        if ($activeEdit.id) {
            history({
                id: "UPDATE",
                oldData: { id: $activeEdit.id },
                newData: { key: "items", subkey: "style", data: Object.values(values)[0], indexes: allItems },
                location: { page: "edit", id: $activeEdit.type + "_items", override: true }
            })
            return
        }

        slides.forEach((slide, i) => {
            if (!slideItems[i].length) return
            history({
                id: "setItems",
                newData: { style: { key: "style", values: values[slide] } },
                location: { page: "edit", show: $activeShow!, slide, items: slideItems[i], override: "slideitem_" + slide + "_items_" + slideItems[i].join(",") }
            })
        })
    }

    function updateStyle2(e: any) {
        const input = e.detail
        input.value = input.values.value
        input.input = input.type

        if (input.key === "left" || input.key === "top" || input.key === "width" || input.key === "height") input.relative = true

        updateStyle({ detail: input })
    }
</script>

<EditValues sections={currentItemSections} {item} styles={data} on:change={updateStyle2} />
