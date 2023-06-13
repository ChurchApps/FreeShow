<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import { activeEdit, activeShow, selected, showsCache } from "../../../stores"
    import { history } from "../../helpers/history"
    import { _show } from "../../helpers/shows"
    import { getStyles } from "../../helpers/style"
    import { addFilterString, addStyleString } from "../scripts/textStyle"
    import { itemEdits } from "../values/item"
    import EditValues from "./EditValues.svelte"

    export let allSlideItems: Item[]
    export let item: Item | null

    let data: { [key: string]: any } = {}

    $: if (item?.style || item === null) data = getStyles(item?.style, true)

    function updateStyle(e: any) {
        let input = e.detail

        if (input.id === "transform") {
            input.value = addFilterString(data.transform || "", [input.key, input.value])
            input.key = "transform"
        }

        let allItems: number[] = $activeEdit.items

        // update all items if nothing is selected
        if (!allItems.length) allSlideItems.forEach((_item, i) => allItems.push(i))

        /////

        let ref: any[] = _show("active").layouts("active").ref()[0] || {}
        let slides: string[] = [ref[$activeEdit.slide || ""]?.id]
        let slideItems: number[][] = [allItems]
        let showSlides = $showsCache[$activeShow?.id || ""]?.slides || {}

        // get all selected slides
        if ($selected.id === "slide") {
            let selectedSlides = $selected.data.filter(({ index }) => index !== $activeEdit.slide!)
            slides.push(...selectedSlides.map(({ index }) => ref[index].id))

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

        slides.forEach((slide, i) => {
            if (!slideItems[i].length) return
            values[slide] = []

            // loop through all items
            slideItems[i].forEach((itemIndex) => {
                let currentSlideItem = showSlides[slide]?.items?.[itemIndex] || allSlideItems[itemIndex]
                values[slide].push(addStyleString(currentSlideItem.style, [input.key, input.value]))
            })
        })

        if (input.id === "CSS") {
            values = [input.value.replaceAll("\n", "")]
            // only change one selected
            allItems = [allItems[0]]
        }

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
</script>

<EditValues edits={itemEdits} styles={data} {item} on:change={updateStyle} />
