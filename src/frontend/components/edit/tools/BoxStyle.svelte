<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import type { Item, ItemType, Slide } from "../../../../types/Show"
    import { activeEdit, activeShow, overlays, selected, showsCache, templates, theme, themes, timers } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getExtension, getMediaType } from "../../helpers/media"
    import { getLayoutRef } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import { getStyles } from "../../helpers/style"
    import { MAX_FONT_SIZE } from "../scripts/autosize"
    import { addFilterString, addStyle, addStyleString, getItemStyleAtPos, getItemText, getLastLineAlign, getLineText, getSelectionRange, setCaret } from "../scripts/textStyle"
    import { itemBoxes, setBoxInputValue2 } from "../values/boxes"
    import EditValues from "./EditValues.svelte"

    export let id: ItemType
    export let allSlideItems: Item[] = []
    export let item: Item | null = null

    // -----

    // selection
    let selection: null | { start: number; end: number }[] = null
    const unsubscribe = activeEdit.subscribe((a) => {
        if (!a.items.length) selection = null
    })
    onDestroy(unsubscribe)

    onMount(() => {
        getTextSelection()

        // set focus to textbox if only one without content
        if (allSlideItems.length === 1 && item && !getItemText(item).length && !$activeEdit.items.length) {
            activeEdit.update((a) => ({ ...(a || {}), items: [0] }))
            const elem = document.querySelector(".editItem")?.querySelector(".edit")
            if (elem) (elem as HTMLElement).focus()
        }
    })

    function getTextSelection(e: any = null) {
        if (e) {
            if (e.target.closest(".menus") || e.target.closest(".popup") || e.target.closest(".drawer") || e.target.closest(".chords") || e.target.closest(".contextMenu") || e.target.closest(".editTools")) return
        }

        let sel = window.getSelection()

        if (sel?.type === "None") selection = null
        else selection = getSelectionRange() // range
    }

    function keyup(e: KeyboardEvent) {
        if (e.key.includes("Arrow") || e.key.toUpperCase() === "A") getTextSelection(e)
    }

    const formatting = {
        b: () => ({ id: "style", key: "font-weight", value: "bold" }),
        i: () => ({ id: "style", key: "font-style", value: "italic" }),
        u: () => ({ id: "style", key: "text-decoration", value: "underline" })
    }
    function keydown(e: KeyboardEvent) {
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
            if (selectedLine > -1 && selection[selectedLine]) setCaret(editElem, { line: selectedLine, pos: selection[selectedLine].end })
        }, 10)
    }

    // -----

    const setItemStyle = ["list", "timer", "clock", "icon", "events", "camera", "variable", "web", "slide_tracker"]

    const setBox = () => clone(itemBoxes[id])!
    let box = setBox()
    $: if ($activeEdit.id || $activeShow?.id || $activeEdit.slide) box = setBox()

    // get item values
    $: style = item?.lines ? getItemStyleAtPos(item.lines, selection) : item?.style || ""
    let styles: any = {}
    $: if (style !== undefined) styles = getStyles(style, true)

    $: lineAlignStyle = item?.lines ? getStyles(getLastLineAlign(item, selection)) : getStyles(item?.align)
    $: alignStyle = item?.align ? getStyles(item.align) : {}

    $: customValues = {
        "text-align": lineAlignStyle["text-align"] || "center",
        "align-items": alignStyle["align-items"] || "center"
    }

    /// SET INPUT VALUES ///

    // remove chord options
    $: if ($activeEdit.type === "overlay" && box?.sections?.chords) {
        delete box.sections.chords
    }

    $: if (box?.sections.CSS && id !== "captions") {
        setBoxInputValue2(box, "CSS", "CSS_text", "value", style)
    }

    $: if (box?.sections.font) {
        setBoxInputValue2(box, "font", "font-size", "disabled", item?.textFit !== "none")
        setBoxInputValue2(box, "font", "textFit", "value", item?.textFit || "growToFit")
        // setBoxInputValue2(box2, "font", "auto", "value", item.auto ?? true)
    }

    $: if (id === "text") {
        setBoxInputValue2(box, "default", "font-family", "styleValue", getStyles(style)["font"] || "")
        // setBoxInputValue2(box2, "default", "textFit", "hidden", !item?.auto)
        setBoxInputValue2(box, "text", "nowrap", "value", !!styles["white-space"]?.includes("nowrap"))
        setBoxInputValue2(box, "lines", "specialStyle.lineRadius", "hidden", !item?.specialStyle?.lineRadius && !item?.specialStyle?.lineBg)
    }

    $: if (id === "media" && item) {
        const extension = getExtension(item.src || "")
        const isVideo = getMediaType(extension) === "video"
        setBoxInputValue2(box, "default", "muted", "hidden", !isVideo)
        setBoxInputValue2(box, "default", "loop", "hidden", !isVideo)
        setBoxInputValue2(box, "default", "speed", "hidden", !isVideo)
    }

    $: if (id === "timer" && item) {
        setBoxInputValue2(box, "default", "timer.circleMask", "hidden", item.timer?.viewType !== "circle")
        const timer = $timers[item.timer?.id || ""]
        const timerLength = Math.abs((timer?.start || 0) - (timer?.end || 0))
        setBoxInputValue2(box, "default", "timer.showHours", "value", item.timer?.showHours !== false)
        setBoxInputValue2(box, "default", "timer.showHours", "hidden", (item.timer?.viewType || "time") !== "time" || timerLength < 3600)
    }
    $: if (id === "clock" && item) {
        const clockType = item.clock?.type || "digital"
        const dateFormat = item.clock?.dateFormat || "none"

        setBoxInputValue2(box, "default", "clock.dateFormat", "hidden", clockType !== "digital")
        setBoxInputValue2(box, "default", "clock.showTime", "hidden", clockType !== "digital" || dateFormat === "none")
        setBoxInputValue2(box, "default", "clock.seconds", "hidden", clockType === "custom" || (clockType === "digital" && item.clock?.showTime === false && dateFormat !== "none"))
        setBoxInputValue2(box, "default", "clock.customFormat", "hidden", clockType !== "custom")
        setBoxInputValue2(box, "default", "tip", "hidden", clockType !== "custom")
    }
    $: if (id === "camera" && item) {
        if (item.device?.name) setBoxInputValue2(box, "default", "device", "name", item.device.name)
    }
    $: if (id === "slide_tracker" && item) {
        setBoxInputValue2(box, "default", "tracker.accent", "value", item.tracker?.accent || $themes[$theme]?.colors?.secondary || "#F0008C")

        setBoxInputValue2(box, "default", "tracker.childProgress", "hidden", item.tracker?.type !== "group")
        setBoxInputValue2(box, "default", "tracker.oneLetter", "hidden", item.tracker?.type !== "group")
    }
    $: if (id === "events" && item) {
        setBoxInputValue2(box, "default", "events.startDaysFromToday", "disabled", !!item.events?.enableStartDate)
        setBoxInputValue2(box, "default", "events.startDate", "hidden", !item.events?.enableStartDate)
        setBoxInputValue2(box, "default", "events.startTime", "hidden", !item.events?.enableStartDate)
    }

    ///

    function setValue(input: any, allItems: any[]) {
        let value: any = input.value
        if (input.id === "filter") value = addFilterString(item?.filter || "", [input.key, value])
        else if (input.key === "text-align") value = `text-align: ${value};`
        else if (input.key) value = { ...((item as any)?.[input.key] || {}), [input.key]: value }

        // set nested value
        if (input.id.includes(".")) {
            let splitted = input.id.split(".")
            let item = getSelectedItem()

            input.id = splitted[0]
            value = item[splitted[0]] || {}
            value[splitted[1]] = input.value
        }

        function getSelectedItem() {
            if ($activeEdit.id) {
                if ($activeEdit.type === "overlay") {
                    return clone($overlays[$activeEdit.id].items[allItems[0]])
                } else if ($activeEdit.type === "template") {
                    return clone($templates[$activeEdit.id].items[allItems[0]])
                }
            }

            let slideId = getLayoutRef()[$activeEdit.slide!]?.id
            let slide = clone(_show().slides([slideId]).get()[0]) as Slide

            return slide.items[allItems[0]]
        }

        if (id === "text") {
            let newFontSize = 0
            if (input.id === "textFit") {
                // change font size to more clearly indicate what the different text fit does
                if (input.value !== "growToFit" && Number(styles["font-size"]) < 200) {
                    newFontSize = 0
                } else {
                    newFontSize = input.value !== "growToFit" ? 100 : MAX_FONT_SIZE
                }
            } else if (input.id === "auto" && item?.textFit === "growToFit") {
                if (input.value && Number(styles["font-size"]) < MAX_FONT_SIZE) newFontSize = MAX_FONT_SIZE
                else if (!input.value && Number(styles["font-size"]) === MAX_FONT_SIZE) newFontSize = 100
            }
            if (newFontSize) updateValue({ detail: { name: "font_size", id: "style", key: "font-size", value: newFontSize + "px" } })
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
            location: { page: "edit", show: $activeShow!, slide: getLayoutRef()[$activeEdit.slide!]?.id, items: allItems }
        })

        // update values
        // box2 = box2

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

        // reverse to get same order as "Textbox" & "Items" etc., uses
        if (($activeEdit.type || "show") === "show") allItems = allItems.reverse()

        // only same type
        let currentType = id || allSlideItems[allItems[0]].type || "text"
        allItems = allItems.filter((index) => (allSlideItems[index].type || "text") === currentType)

        if (input.id === "nowrap") input = { ...input, id: "style", key: "white-space", value: input.value ? "nowrap" : undefined }

        if (input.id !== "style" && !input.id.includes("CSS")) {
            setValue(input, allItems)
            return
        }

        let aligns: boolean = input.key === "align-items" || input.key === "text-align"

        if (input.id.includes("CSS")) allItems = [allItems[0]]

        /////

        // this is only for show slides
        let ref = getLayoutRef()
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

        // WIP get relative value
        // ItemStyle.svelte

        let values: { [key: string]: any[] } = {}
        slides.forEach((slide, i) => {
            if (!slideItems[i].length) return
            values[slide] = []
            slideItems[i].forEach((i) => getNewItemValues(clone(showSlides[slide]?.items?.[i] || allSlideItems[i]), slide))
        })

        function getNewItemValues(currentSlideItem: Item, slideId: string) {
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
                    if (!selection?.length || selection[line]?.start !== undefined) newAligns.push(`${input.key}: ${input.value};`)
                    else newAligns.push(currentSlideItem.lines![line].align)
                })
                values[slideId].push(newAligns)
            } else if (currentSlideItem.lines) {
                if (input.id.includes("CSS")) {
                    values[slideId].push(addStyle(selected, currentSlideItem, input.value).lines!.map((a) => a.text))
                } else {
                    values[slideId].push(aligns ? addStyleString(currentSlideItem.align || "", [input.key, input.value]) : addStyle(selected, clone(currentSlideItem), [input.key, input.value]).lines!.map((a) => a.text))
                }
            } else {
                if (input.id.includes("CSS")) {
                    values[slideId] = [input.value]
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
            let currentItems: Item[] = []
            if ($activeEdit.type === "overlay") currentItems = clone($overlays[$activeEdit.id].items)
            if ($activeEdit.type === "template") currentItems = clone($templates[$activeEdit.id].items)
            // only selected
            currentItems = currentItems.filter((_item, i) => allItems.includes(i))

            // WIP changing the default "Name" overlay causes textbox swapping....

            allItems.forEach((_itemIndex, i) => {
                let allValues: any = Object.values(values)[0]
                let currentValue: any = allValues[i] ?? allValues[0]
                // some textboxes don't have lines, this will break things, so make sure it has lines!
                if (currentItems[i].lines && typeof currentValue === "string") currentValue = allValues.find((a) => typeof a !== "string") || allValues[0]

                if (input.key === "align-items") currentItems[i].align = currentValue
                else if (currentType !== "text") currentItems[i].style = currentValue
                else {
                    let lines = currentItems[i].lines
                    lines?.forEach((_a, j) => {
                        currentItems[i].lines![j][aligns ? "align" : "text"] = currentValue[j]
                    })
                }
            })

            // WIP if top textbox is empty, and another has text, that will update (but the right side won't update (as top is empty as not changed)), that is confusing

            // no text
            if (currentItems[0].lines) {
                let textLength = currentItems.reduce((length, item) => (length += getItemText(item).length), 0)
                if (!textLength) {
                    newToast("empty.text")
                    return
                }
            }

            let override = $activeEdit.id + "#" + allItems.join(",")
            history({
                id: "UPDATE",
                oldData: { id: $activeEdit.id },
                newData: { key: "items", data: currentItems, indexes: allItems },
                location: { page: "edit", id: $activeEdit.type + "_items", override }
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
                    location: { page: "edit", show: $activeShow!, slide, items: slideItems[i], override: "slide_" + slide + "_items_" + slideItems[i].join(",") }
                })
            })

            return
        }

        // no text
        // values: {key: [[[]]]}
        let textLength = Object.values(values).reduce((length: number, value: any) => length + value.flat(2).reduce((value, text) => value + (text?.value || ""), "").length, 0)
        if (input.key !== "text-align" && !aligns && !textLength) {
            newToast("empty.text")
            return
        }

        let key: string = input.key === "text-align" || aligns ? "align" : "text"
        slides.forEach((slide, i) => {
            if (!slideItems[i].length) return
            history({
                // WIP
                id: input.key === "text-align" ? "textAlign" : aligns ? "setItems" : "textStyle",
                newData: { style: { key, values: values[slide] } },
                location: { page: "edit", show: $activeShow!, slide, items: slideItems[i], override: "slide_" + slide + "_items_" + slideItems[i].join(",") }
            })
        })
    }

    $: boxSections = box?.sections || {}
    function updateValue2(e: any) {
        const input = e.detail
        input.value = input.values.value
        input.input = input.type

        if (input.id === "textFit") updateValue({ detail: { id: "auto", value: input.value !== "none" } })
        // unset transparent color
        if (input.key === "text-shadow" && input.value.includes("rgb(0 0 0 / 0)") && input.value.includes("px")) {
            input.value = input.value.replace("rgb(0 0 0 / 0)", "rgb(0 0 0 / 1)")
        }

        updateValue({ detail: input })
    }

    // don't load right away (because that will load content twice)
    let loaded = false
    onMount(() => {
        loaded = true
    })
</script>

<svelte:window on:keyup={keyup} on:keydown={keydown} on:mouseup={getTextSelection} />

{#if loaded}
    <EditValues sections={boxSections} {item} {styles} {customValues} on:change={updateValue2} />
{/if}
