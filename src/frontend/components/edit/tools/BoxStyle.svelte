<script lang="ts">
    import type { Item, ItemType } from "../../../../types/Show"
    import { activeEdit, activeShow, overlays, templates } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getListOfShows } from "../../helpers/show"
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
        let sel: any = window.getSelection()
        // if (sel.focusNode?.parentElement?.closest(".edit") !== null && !e.target.closest(".editTools")) {
        // if (e.target.closest(".edit") && !e.target.closest(".editTools")) {
        if (e.target.closest(".edit") && !e.target.closest(".CSS")) {
            if (sel.type === "None") selection = null
            // else if (sel.type === "caret") selection = [sel.anchorOffset, sel.focusOffset]
            else selection = getSelectionRange() // range
        }
        // console.log("SEL: ", selection)
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

    $: if (id === "mirror" && box) box.edit.default[0].values.options = getListOfShows(!$activeEdit.id)
    $: if (id === "media" && box) box.edit.default[0].value = item?.src || ""
    $: if (id === "list" && box) box.edit.default[0].value = item?.list?.items || []

    function setValue(input: any) {
        let allItems: number[] = $activeEdit.items
        // update all items if nothing is selected
        if (!allItems.length) {
            allItems = []
            allSlideItems.forEach((_item, i) => allItems.push(i))
        }
        // let fullItems = allItems.map((a) => allSlideItems[a])

        let value: any = input.value
        if (input.id === "filter") value = addFilterString(item?.filter || "", [input.key, value])
        else if (input.key) value = { ...((item as any)?.[input.key] || {}), [input.key]: value }

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

        if ($activeEdit.id) {
            if ($activeEdit.type === "overlay") {
                overlays.update((a: any) => {
                    allItems.forEach((i: number) => {
                        if (a[$activeEdit.id!].items[i]) a[$activeEdit.id!].items[i][input.id] = value
                    })
                    return a
                })

                return
            }

            if ($activeEdit.type === "template") {
                templates.update((a: any) => {
                    allItems.forEach((i: number) => {
                        if (a[$activeEdit.id!].items[i]) a[$activeEdit.id!].items[i][input.id] = value
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
    }

    function updateValue(e: any) {
        let input = e.detail

        if (input.id !== "style" && input.id !== "CSS") {
            setValue(input)
            return
        }

        // console.log("original", getOriginalValue(box!.edit, input.key))
        // console.log(input)

        let allItems: number[] = $activeEdit.items
        // update all items if nothing is selected
        if (!allItems.length) allSlideItems.forEach((_item, i) => allItems.push(i))
        allSlideItems = clone(allSlideItems)

        let values: any = []
        let aligns: boolean = input.key === "align-items" || input.key === "text-align"

        if (input.id === "CSS") allItems = [allItems[0]]

        allItems.forEach((itemIndex) => {
            let selected = selection
            if (!selected?.length || !selected?.filter((a) => a.start !== a.end).length) {
                selected = []
                allSlideItems[itemIndex].lines?.forEach((line) => {
                    selected!.push({ start: 0, end: getLineText(line).length })
                })
            }

            if (input.key === "text-align") {
                let newAligns: any[] = []
                allSlideItems[itemIndex].lines?.forEach((_a, line) => {
                    if (!selection || selection[line].start !== undefined) newAligns.push(input.key + ": " + input.value)
                    else newAligns.push(allSlideItems[itemIndex].lines![line].align)
                })
                values.push(newAligns)
            } else if (allSlideItems[itemIndex].lines) {
                if (input.id === "CSS") {
                    values.push(addStyle(selected, allSlideItems[itemIndex], input.value.replaceAll("\n", "")).lines!.map((a) => a.text))
                } else {
                    values.push(aligns ? addStyleString(allSlideItems[itemIndex].align || "", [input.key, input.value]) : addStyle(selected, allSlideItems[itemIndex], [input.key, input.value]).lines!.map((a) => a.text))
                }
            } else {
                if (input.id === "CSS") {
                    values = [input.value.replaceAll("\n", "")]
                } else {
                    values = [addStyleString(item?.style || "", [input.key, input.value])]
                }
            }
            // newData.push(addStyle(selected, allSlideItems[itemIndex], [input.key, input.value]).lines!.map((a) => a.text))
        })

        // TODO: remove unused (if default)

        // TODO: template v-align
        // console.log(values, input)

        if (!values.length) return

        // update layout
        if ($activeEdit.id) {
            // overlay / template
            let currentItems: any[] = []
            if ($activeEdit.type === "overlay") currentItems = clone($overlays[$activeEdit.id!].items)
            if ($activeEdit.type === "template") currentItems = clone($templates[$activeEdit.id!].items)

            allItems.forEach((itemIndex, i) => {
                let currentValue = values[i] ?? values[0]

                if (input.key === "align-items") currentItems[itemIndex].align = currentValue
                else {
                    let lines: any = currentItems[itemIndex].lines
                    lines?.forEach((_a: any, j: number) => {
                        currentItems[itemIndex].lines![j][aligns ? "align" : "text"] = currentValue[j]
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

        let ref: any[] = _show().layouts("active").ref()[0]

        const setItemStyle = ["list", "timer", "clock", "icon"]
        if (setItemStyle.includes(id)) {
            history({
                id: "setItems",
                // oldData: { style: { key: "style", values: [oldData] } },
                newData: { style: { key: "style", values: values } },
                location: { page: "edit", show: $activeShow!, slide: ref[$activeEdit.slide!].id, items: allItems },
            })
            return
        }

        let key: string = input.key === "text-align" || aligns ? "align" : "text"
        history({
            // WIP
            id: input.key === "text-align" ? "textAlign" : aligns ? "setItems" : "textStyle",
            newData: { style: { key, values: values } },
            location: { page: "edit", show: $activeShow!, slide: ref[$activeEdit.slide!].id, items: allItems },
        })
    }
</script>

<svelte:window on:keyup={keyup} on:mouseup={getTextSelection} />

<EditValues edits={box?.edit} {item} on:change={updateValue} {styles} {lineAlignStyle} {alignStyle} />
