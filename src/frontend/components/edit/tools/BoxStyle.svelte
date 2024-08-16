<script lang="ts">
    import { onMount } from "svelte"
    import type { Item, ItemType } from "../../../../types/Show"
    import { activeEdit, activeShow, overlays, selected, showsCache, templates, theme, themes } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { clone } from "../../helpers/array"
    import { hexToRgb, splitRgb } from "../../helpers/color"
    import { history } from "../../helpers/history"
    import { getListOfShows, getStageList } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import { getStyles } from "../../helpers/style"
    import { addFilterString, addStyle, addStyleString, getItemStyleAtPos, getItemText, getLastLineAlign, getLineText, getSelectionRange, setCaret } from "../scripts/textStyle"
    import { boxes } from "../values/boxes"
    import EditValues from "./EditValues.svelte"
    import { uid } from "uid"

    export let id: ItemType
    export let allSlideItems: Item[] = []
    export let item: Item | null = null

    // -----

    // selection
    let selection: null | { start: number; end: number }[] = null
    activeEdit.subscribe((a) => {
        if (!a.items.length) selection = null
    })

    onMount(getTextSelection)

    function getTextSelection(e: any = null) {
        if (e) {
            if (e.target.closest(".menus") || e.target.closest(".popup") || e.target.closest(".drawer") || e.target.closest(".chords") || e.target.closest(".contextMenu") || e.target.closest(".editTools")) return
        }

        let sel: any = window.getSelection()

        if (sel.type === "None") selection = null
        else selection = getSelectionRange() // range
    }

    function keyup(e: any) {
        if (e.key.includes("Arrow") || e.key.toUpperCase() === "A") getTextSelection(e)
    }

    const formatting = {
        b: () => ({ id: "style", key: "font-weight", value: "bold" }),
        i: () => ({ id: "style", key: "font-style", value: "italic" }),
        u: () => ({ id: "style", key: "text-decoration", value: "underline" }),
    }
    function keydown(e: any) {
        if (!selection || (!e.ctrlKey && !e.metaKey) || !formatting[e.key]) return
        e.preventDefault()

        let value = formatting[e.key]()
        // WIP line-through is removed
        if (styles[value.key]?.includes(value.value)) value.value = ""

        updateValue({ detail: value })

        // reset caret position (styles can be changed without this also)
        setTimeout(() => {
            if (!selection) return

            let editElem = document.querySelector(".editArea")?.querySelectorAll(".editItem")?.[$activeEdit.items[0]]?.querySelector(".edit")
            if (!editElem) return

            let selectedLine = selection.findIndex((a) => a.start !== undefined)
            if (selectedLine > -1) setCaret(editElem, { line: selectedLine, pos: selection[selectedLine].end })
        }, 10)
    }

    // -----

    const setItemStyle = ["list", "timer", "clock", "icon", "events", "camera", "variable", "web", "slide_tracker"]

    const setBox = () => clone(boxes[id])
    let box: any = setBox()
    $: if ($activeEdit.id || $activeShow?.id || $activeEdit.slide) box = setBox()

    // get item values
    $: style = item?.lines ? getItemStyleAtPos(item.lines, selection) : item?.style || ""
    let styles: any = {}
    $: if (style !== undefined) styles = getStyles(style, true)

    $: if (box?.edit?.CSS) {
        if (box.edit.CSS[0].id !== "text") box.edit.CSS[0].value = getItemValue(box.edit.CSS[0].id)
        else if (style) box.edit.CSS[0].value = style
    }

    // WIP use this more
    function getItemValue(id: string) {
        if (!item) return null

        let divideIndex = id.indexOf(".")
        if (divideIndex > -1) {
            let firstKey = id.slice(0, divideIndex)
            let secondKey = id.slice(divideIndex + 1)

            return item[firstKey]?.[secondKey] || null
        }

        return item[id] || null
    }

    $: lineAlignStyle = item?.lines ? getStyles(getLastLineAlign(item, selection)) : getStyles(item?.align)
    $: alignStyle = item?.align ? getStyles(item.align) : {}

    // remove chord options
    $: if ($activeEdit.type === "overlay" && box?.edit?.chords) {
        delete box.edit.chords
    }

    // WIP shouldn't have fixed values
    $: if (id === "text" && box?.edit?.style) {
        box.edit.lines[1].value = item?.specialStyle?.lineGap || 0

        let lineBg = item?.specialStyle?.lineBg || ""
        let backgroundValue = splitRgb(lineBg)
        box.edit.lines[2].value = lineBg
        box.edit.lines[3].value = backgroundValue.a
    }
    $: if (id === "text" && box?.edit?.special) {
        box.edit.text[4].value = !!styles["white-space"]?.includes("nowrap")
        box.edit.special[0].value = item?.scrolling?.type || "none"
    }
    $: if (id === "text" && box?.edit?.chords) {
        box.edit.chords[0].value = item?.chords?.enabled || false
        box.edit.chords[1].value = item?.chords?.color || "#FF851B"
        box.edit.chords[2].value = item?.chords?.size || 30

        box.edit.chords[1].hidden = !item?.chords?.enabled
        box.edit.chords[2].hidden = !item?.chords?.enabled
    }

    $: if (id === "timer" && box?.edit?.font) box.edit.font[3].value = item?.auto ?? true

    $: if (box?.edit?.default) {
        if (id === "mirror") getMirrorValues()
        else if (id === "media") box.edit.default[0].value = item?.src || ""
        else if (id === "list") box.edit.default[0].value = item?.list?.items || []
        else if (id === "timer") box.edit.default[2].hidden = item?.timer?.viewType !== "circle"
        else if (id === "variable") box.edit.default[0].value = item?.variable?.id
        else if (id === "web") box.edit.default[0].value = item?.web?.src || ""
        else if (id === "slide_tracker") {
            if (item?.tracker?.type) box.edit.default[0].value = item.tracker.type
            box.edit.default[1].value = item?.tracker?.accent || $themes[$theme]?.colors?.secondary || "#F0008C"
        } else if (id === "events" && box.edit.default[5]) {
            box.edit.default[4].hidden = !item?.events?.enableStartDate
            box.edit.default[5].hidden = !item?.events?.enableStartDate
        }
    }

    function getMirrorValues() {
        if (!item?.mirror || !box) return

        let enableStage = item.mirror.enableStage || false
        let nextSlide = item.mirror.nextSlide || false
        let useSlideIndex = item.mirror.useSlideIndex
        let index = item.mirror.index

        if (nextSlide) {
            box.edit.default[0].hidden = true
            box.edit.default[2].hidden = true
            box.edit.default[3].hidden = true
            box.edit.default[4].hidden = true
        } else if (enableStage) {
            box!.edit.default[2].name = "select_stage"
            box!.edit.default[2].values.options = getStageList()
            box!.edit.default[2].id = "mirror.stage"
            box.edit.default[1].hidden = true
            box.edit.default[3].hidden = true
            box.edit.default[4].hidden = true
        } else {
            box!.edit.default[2].name = "popup.select_show"
            box!.edit.default[2].values.options = getListOfShows(!$activeEdit.id)
            box!.edit.default[2].id = "mirror.show"
            box.edit.default[0].hidden = false
            box.edit.default[1].hidden = false
            box.edit.default[2].hidden = false
            box.edit.default[3].hidden = false
            box.edit.default[4].hidden = false
        }

        box.edit.default[0].value = enableStage
        box.edit.default[1].value = nextSlide
        if (useSlideIndex !== undefined) box.edit.default[3].value = useSlideIndex
        if (index !== undefined) box.edit.default[4].value = index
    }

    // background opacity
    // WIP duplicate of ItemStyle.svelte
    function getBackgroundOpacity() {
        let backgroundValue = item?.specialStyle?.lineBg || ""
        if (!backgroundValue.includes("rgb") || !box?.edit?.lines) return

        let rgb = splitRgb(backgroundValue)
        let boIndex = box.edit.lines.findIndex((a) => a.id === "specialStyle.opacity")
        if (boIndex < 0) return
        box.edit.lines[boIndex].value = rgb.a
    }
    function getOldOpacity() {
        let backgroundValue = item?.specialStyle?.lineBg || ""
        if (!backgroundValue.includes("rgb")) return 1

        let rgb = splitRgb(backgroundValue)
        return rgb.a
    }

    function setValue(input: any, allItems: any[]) {
        let value: any = input.value
        if (input.id === "filter") value = addFilterString(item?.filter || "", [input.key, value])
        else if (input.key === "text-align") value = `text-align: ${value};`
        else if (input.key) value = { ...((item as any)?.[input.key] || {}), [input.key]: value }

        // WIP duplicate of ItemStyle.svelte
        const lineStyleChanged = input.id === "specialStyle.opacity" || (input.value && input.id === "specialStyle.lineBg")
        if (lineStyleChanged) setBackgroundOpacity()
        function setBackgroundOpacity() {
            let backgroundColor = input.id === "specialStyle.lineBg" ? input.value || "" : item?.specialStyle?.lineBg || "rgb(0 0 0);"
            let rgb = backgroundColor.includes("rgb") ? splitRgb(backgroundColor) : hexToRgb(backgroundColor)
            let opacity = input.id === "specialStyle.opacity" ? input.value : getOldOpacity()
            let newColor = "rgb(" + [rgb.r, rgb.g, rgb.b].join(" ") + " / " + opacity + ");"

            input.id = "specialStyle.lineBg"
            input.value = newColor

            setTimeout(getBackgroundOpacity, 100)
        }

        // set nested value
        if (input.id.includes(".")) {
            let splitted = input.id.split(".")
            let item: any = getSelectedItem()

            input.id = splitted[0]
            value = item[splitted[0]] || {}
            value[splitted[1]] = input.value
        }

        function getSelectedItem() {
            if ($activeEdit.id) {
                if ($activeEdit.type === "overlay") {
                    return $overlays[$activeEdit.id].items[allItems[0]]
                } else if ($activeEdit.type === "template") {
                    return $templates[$activeEdit.id].items[allItems[0]]
                }
            }

            let slideId = _show().layouts("active").ref()[0][$activeEdit.slide!].id
            let slide = clone(_show().slides([slideId]).get()[0])

            return slide.items[allItems[0]]
        }

        // UPDATE

        if ($activeEdit.id) {
            if ($activeEdit.type === "overlay") overlays.update(updateItemValues)
            else if ($activeEdit.type === "template") templates.update(updateItemValues)

            return
        }

        history({
            id: "setItems",
            newData: { style: { key: input.id, values: [value] } },
            location: { page: "edit", show: $activeShow!, slide: _show().layouts("active").ref()[0][$activeEdit.slide!].id, items: allItems },
        })

        // update values
        box = box

        return

        function updateItemValues(a: any) {
            allItems.forEach((i: number) => {
                if (!a[$activeEdit.id!].items[i]) return

                if (!input.id.includes(".")) {
                    a[$activeEdit.id!].items[i][input.id] = value
                    return
                }

                let splitted = input.id.split(".")
                if (!a[$activeEdit.id!].items[i][splitted[0]]) a[$activeEdit.id!].items[i][splitted[0]] = {}
                a[$activeEdit.id!].items[i][splitted[0]][splitted[1]] = value
            })

            return a
        }
    }

    function updateValue(e: any) {
        let input = e.detail
        console.log("BOX INPUT:", input)

        let allItems: number[] = $activeEdit.items
        // update all items if nothing is selected
        if (!allItems.length) allSlideItems.forEach((_item, i) => allItems.push(i))
        allSlideItems = clone(allSlideItems)

        // only same type
        let currentType = id || allSlideItems[allItems[0]].type || "text"
        allItems = allItems.filter((index) => (allSlideItems[index].type || "text") === currentType)

        if (input.id === "nowrap") input = { ...input, id: "style", key: "white-space", value: input.value ? "nowrap" : undefined }

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
            slides.push(...selectedSlides.map(({ index }) => ref[index]?.id))

            slides.forEach((id, i) => {
                if (!id || i === 0) return
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
            if (!currentSlideItem) return

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
                    if (!selection || selection[line]?.start !== undefined) newAligns.push(input.key + ": " + input.value)
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
                    // TODO: don't replace full item style (position) when changing multiple (Like EditTools.svelte:152)
                    values[slideId] = [addStyleString(item?.style || "", [input.key, input.value])]
                }
            }
        }

        // align other items (VARIABLE)
        if (aligns && item?.type && item.type !== "text") {
            input.id = "align"
            setValue(input, allItems)

            return
        }

        // TODO: remove unused (if default)

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

            // no text
            if (currentItems[0].lines) {
                let textLength = currentItems.reduce((length, item) => (length += getItemText(item).length), 0)
                if (!textLength) {
                    newToast("$empty.text")
                    return
                }
            }

            let override = $activeEdit.id + "#" + allItems.join(",")
            history({
                id: "UPDATE",
                oldData: { id: $activeEdit.id },
                newData: { key: "items", data: currentItems, indexes: allItems },
                location: { page: "edit", id: $activeEdit.type + "_items", override },
            })

            return
        }

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

        // no text
        // values: {key: [[[]]]}
        let textLength = Object.values(values).reduce((length: number, value: any) => (length += value.flat(2)?.length || 0), 0)
        if (!textLength) {
            newToast("$empty.text")
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

    let sessionId = ""
    if (item) sessionId = uid()
</script>

<svelte:window on:keyup={keyup} on:keydown={keydown} on:mouseup={getTextSelection} />

{#key box}
    <EditValues edits={box?.edit} defaultEdits={clone(boxes[id])?.edit} {item} on:change={updateValue} {styles} {lineAlignStyle} {alignStyle} {sessionId} />
{/key}
