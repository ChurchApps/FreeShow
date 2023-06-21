<script lang="ts">
    import type { Item, ItemType } from "../../../../types/Show"
    import { activeEdit, activeShow, overlays, selected, showsCache, templates } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getListOfShows, getStageList } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import { getStyles } from "../../helpers/style"
    import { addFilterString, addStyle, addStyleString, getItemStyleAtPos, getLastLineAlign, getLineText, getSelectionRange } from "../scripts/textStyle"
    import { boxes } from "../values/boxes"
    import EditValues from "./EditValues.svelte"

    export let id: ItemType
    export let allSlideItems: Item[] = []
    export let item: Item | null = null

    // -----

    // selection
    let selection: null | { start: number; end: number }[] = null
    activeEdit.subscribe((a) => {
        if (!a.items.length) selection = null
    })

    function getTextSelection(e: any) {
        if (e.target.closest(".menus") || e.target.closest(".popup") || e.target.closest(".drawer") || e.target.closest(".chords") || e.target.closest(".contextMenu") || e.target.closest(".editTools")) return

        let sel: any = window.getSelection()

        if (sel.type === "None") selection = null
        // else if (sel.type === "caret") selection = [sel.anchorOffset, sel.focusOffset]
        else selection = getSelectionRange() // range
    }

    function keyup(e: any) {
        if (e.key.includes("Arrow") || e.key.toUpperCase() === "A") getTextSelection(e)
    }

    // TODO: clean here!!!

    // -----

    $: box = boxes[id]

    // get item values
    $: style = item?.lines ? getItemStyleAtPos(item.lines, selection) : item?.style || ""
    let styles: any = {}
    $: if (style) styles = getStyles(style, true)

    $: if (box?.edit?.CSS && style) box.edit.CSS[0].value = style

    $: lineAlignStyle = item?.lines ? getStyles(getLastLineAlign(item, selection)) : {}
    $: alignStyle = item?.align ? getStyles(item.align) : {}

    $: if (id === "text" && box?.edit?.special) box.edit.special[0].value = item?.scrolling?.type || "none"
    $: if (id === "mirror" && box) getMirrorValues()
    $: if (id === "media" && box) box.edit.default[0].value = item?.src || ""
    $: if (id === "list" && box) box.edit.default[0].value = item?.list?.items || []
    $: if (id === "timer" && box) box.edit.default[2].hidden = item?.timer?.viewType !== "circle"

    function getMirrorValues() {
        if (!item?.mirror || !box) return
        let enableStage = item.mirror.enableStage || false
        let useSlideIndex = item.mirror.useSlideIndex
        let index = item.mirror.index

        if (enableStage) {
            box!.edit.default[1].name = "select_stage"
            box!.edit.default[1].values.options = getStageList()
            box!.edit.default[1].id = "mirror.stage"
            box.edit.default[2].hidden = true
            box.edit.default[3].hidden = true
        } else {
            box!.edit.default[1].name = "popup.select_show"
            box!.edit.default[1].values.options = getListOfShows(!$activeEdit.id)
            box!.edit.default[1].id = "mirror.show"
            box.edit.default[2].hidden = false
            box.edit.default[3].hidden = false
        }

        box.edit.default[0].value = enableStage
        if (useSlideIndex !== undefined) box.edit.default[2].value = useSlideIndex
        if (index !== undefined) box.edit.default[3].value = index
    }

    function setValue(input: any, allItems: any[]) {
        let value: any = input.value
        if (input.id === "filter") value = addFilterString(item?.filter || "", [input.key, value])
        else if (input.key) value = { ...((item as any)?.[input.key] || {}), [input.key]: value }
        console.log(input, value)

        // set nested value
        if (input.id.includes(".")) {
            let splitted = input.id.split(".")

            let item: any = {}
            if ($activeEdit.id) {
                if ($activeEdit.type === "overlay") {
                    item = $overlays[$activeEdit.id].items[allItems[0]]
                } else if ($activeEdit.type === "template") {
                    item = $templates[$activeEdit.id].items[allItems[0]]
                }
            } else {
                let slideId = _show().layouts("active").ref()[0][$activeEdit.slide!].id
                let slide = clone(_show().slides([slideId]).get()[0])
                item = slide.items[allItems[0]]
            }

            if (item[splitted[0]] !== undefined) {
                input.id = splitted[0]
                value = item[splitted[0]]
                value[splitted[1]] = input.value
            }
        }
        console.log(value)

        if ($activeEdit.id) {
            if ($activeEdit.type === "overlay") {
                overlays.update((a: any) => {
                    allItems.forEach((i: number) => {
                        if (a[$activeEdit.id!].items[i]) {
                            if (input.id.includes(".")) {
                                let splitted = input.id.split(".")
                                if (!a[$activeEdit.id!].items[i][splitted[0]]) a[$activeEdit.id!].items[i][splitted[0]] = {}
                                a[$activeEdit.id!].items[i][splitted[0]][splitted[1]] = value
                            } else {
                                a[$activeEdit.id!].items[i][input.id] = value
                            }
                        }
                    })
                    return a
                })

                return
            }

            if ($activeEdit.type === "template") {
                templates.update((a: any) => {
                    allItems.forEach((i: number) => {
                        if (a[$activeEdit.id!].items[i]) {
                            if (input.id.includes(".")) {
                                let splitted = input.id.split(".")
                                if (!a[$activeEdit.id!].items[i][splitted[0]]) a[$activeEdit.id!].items[i][splitted[0]] = {}
                                a[$activeEdit.id!].items[i][splitted[0]][splitted[1]] = value
                            } else {
                                a[$activeEdit.id!].items[i][input.id] = value
                            }
                        }
                    })
                    return a
                })

                return
            }

            return
        }

        history({
            id: "setItems",
            newData: { style: { key: input.id, values: [value] } },
            location: { page: "edit", show: $activeShow!, slide: _show().layouts("active").ref()[0][$activeEdit.slide!].id, items: allItems },
        })

        // update values
        box = box
    }

    function updateValue(e: any) {
        let input = e.detail

        // console.log("original", getOriginalValue(box!.edit, input.key))
        // console.log(input)

        let allItems: number[] = $activeEdit.items
        // update all items if nothing is selected
        if (!allItems.length) allSlideItems.forEach((_item, i) => allItems.push(i))
        allSlideItems = clone(allSlideItems)

        // only same type
        let currentType = id || allSlideItems[allItems[0]].type || "text"
        allItems = allItems.filter((index) => (allSlideItems[index].type || "text") === currentType)

        if (input.id !== "style" && input.id !== "CSS") {
            setValue(input, allItems)
            return
        }

        let aligns: boolean = input.key === "align-items" || input.key === "text-align"

        if (input.id === "CSS") allItems = [allItems[0]]

        /////

        // this is only for show slides
        let ref: any[] = _show().layouts("active").ref()[0] || {}
        let slides: string[] = [ref[$activeEdit.slide ?? ""]?.id || "other"]
        let slideItems: number[][] = [allItems]
        let showSlides = $showsCache[$activeShow?.id || ""]?.slides || {}

        // get all selected slides
        if (slides[0] && $selected.id === "slide") {
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

                // only same type
                currentItemIndexes = currentItemIndexes.filter((index) => (currentItems[index].type || "text") === currentType)
                slideItems.push(currentItemIndexes)
            })
        }

        /////

        let values: any = {}
        slides.forEach((slide, i) => {
            if (!slideItems[i].length) return
            values[slide] = []
            slideItems[i].forEach((i) => getNewItemValues(clone(showSlides[slide]?.items?.[i] || allSlideItems[i]), slide))
        })
        function getNewItemValues(currentSlideItem: any, slideId: string) {
            let selected = selection
            if (!selected?.length || !selected?.filter((a) => a.start !== a.end).length) {
                selected = []
                currentSlideItem.lines?.forEach((line) => {
                    selected!.push({ start: 0, end: getLineText(line).length })
                })
            }

            if (input.key === "text-align") {
                let newAligns: any[] = []
                currentSlideItem.lines?.forEach((_a, line) => {
                    if (!selection || selection[line].start !== undefined) newAligns.push(input.key + ": " + input.value)
                    else newAligns.push(currentSlideItem.lines![line].align)
                })
                values[slideId].push(newAligns)
            } else if (currentSlideItem.lines) {
                if (input.id === "CSS") {
                    values[slideId].push(addStyle(selected, currentSlideItem, input.value.replaceAll("\n", "")).lines!.map((a) => a.text))
                } else {
                    values[slideId].push(aligns ? addStyleString(currentSlideItem.align || "", [input.key, input.value]) : addStyle(selected, clone(currentSlideItem), [input.key, input.value]).lines!.map((a) => a.text))
                }
            } else {
                if (input.id === "CSS") {
                    values[slideId] = [input.value.replaceAll("\n", "")]
                } else {
                    values[slideId] = [addStyleString(item?.style || "", [input.key, input.value])]
                }
            }
            // newData.push(addStyle(selected, allSlideItems[itemIndex], [input.key, input.value]).lines!.map((a) => a.text))
        }

        // TODO: remove unused (if default)

        // TODO: template v-align

        if (!Object.values(values).length) return

        // update layout
        if ($activeEdit.id) {
            // overlay / template
            let currentItems: any[] = []
            if ($activeEdit.type === "overlay") currentItems = $overlays[$activeEdit.id!].items
            if ($activeEdit.type === "template") currentItems = $templates[$activeEdit.id!].items
            // only selected
            currentItems = clone(currentItems).filter((_item, i) => allItems.includes(i))

            allItems.forEach((_itemIndex, i) => {
                let allValues: any = Object.values(values)[0]
                let currentValue: any = allValues[i] ?? allValues[0]
                // some textboxes don't have lines, this will break things, so make sure it has lines!
                if (currentItems[i].lines && typeof currentValue === "string") currentValue = allValues.find((a) => typeof a !== "string") || allValues[0]

                if (input.key === "align-items") currentItems[i].align = currentValue
                else if (currentType !== "text") currentItems[i].style = currentValue
                else {
                    let lines: any = currentItems[i].lines
                    lines?.forEach((_a: any, j: number) => {
                        currentItems[i].lines![j][aligns ? "align" : "text"] = currentValue[j]
                    })
                }
            })

            let override = $activeEdit.id + "#" + allItems.join(",")
            history({
                id: "UPDATE",
                oldData: { id: $activeEdit.id },
                newData: { key: "items", data: currentItems, indexes: allItems },
                location: { page: "edit", id: $activeEdit.type + "_items", override },
            })

            return
        }

        const setItemStyle = ["list", "timer", "clock", "icon"]
        if (setItemStyle.includes(id)) {
            slides.forEach((slide, i) => {
                if (!slideItems[i].length) return
                history({
                    id: "setItems",
                    // oldData: { style: { key: "style", values: [oldData] } },
                    newData: { style: { key: "style", values: values[slide] } },
                    location: { page: "edit", show: $activeShow!, slide, items: slideItems[i], override: "slide_" + slide + "_items_" + slideItems[i].join(",") },
                })
            })
            return
        }

        let key: string = input.key === "text-align" || aligns ? "align" : "text"
        slides.forEach((slide, i) => {
            if (!slideItems[i].length) return
            history({
                // WIP
                id: input.key === "text-align" ? "textAlign" : aligns ? "setItems" : "textStyle",
                newData: { style: { key, values: values[slide] } },
                location: { page: "edit", show: $activeShow!, slide, items: slideItems[i], override: "slide_" + slide + "_items_" + slideItems[i].join(",") },
            })
        })
    }
</script>

<svelte:window on:keyup={keyup} on:mouseup={getTextSelection} />

<EditValues edits={box?.edit} {item} on:change={updateValue} {styles} {lineAlignStyle} {alignStyle} />
