<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { uid } from "uid"
    import type { Item, ItemType, Slide } from "../../../../types/Show"
    import { activeEdit, activeShow, overlays, selected, showsCache, templates, theme, themes, timers } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { clone } from "../../helpers/array"
    import { hexToRgb, splitRgb } from "../../helpers/color"
    import { history } from "../../helpers/history"
    import { getLayoutRef, getListOfShows, getStageList } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import { getStyles } from "../../helpers/style"
    import { MAX_FONT_SIZE } from "../scripts/autosize"
    import { addFilterString, addStyle, addStyleString, getItemStyleAtPos, getItemText, getLastLineAlign, getLineText, getSelectionRange, setCaret } from "../scripts/textStyle"
    import { boxes, itemBoxes, setBoxInputValue, setBoxInputValue2 } from "../values/boxes"
    import EditValues from "./EditValues.svelte"
    import { getExtension, getMediaType } from "../../helpers/media"

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

    const setBox = () => clone(boxes[id])
    let box = setBox()!
    $: if ($activeEdit.id || $activeShow?.id || $activeEdit.slide) box = setBox()!
    const setBox2 = () => clone(itemBoxes[id])!
    let box2 = setBox2()
    $: if ($activeEdit.id || $activeShow?.id || $activeEdit.slide) box2 = setBox2()

    // get item values
    $: style = item?.lines ? getItemStyleAtPos(item.lines, selection) : item?.style || ""
    let styles: any = {}
    $: if (style !== undefined) styles = getStyles(style, true)

    $: if (box?.edit?.CSS) {
        if (box.edit.CSS[0].id !== "text") box.edit.CSS[0].value = getItemValue(box.edit.CSS[0].id || "")
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

    /// SET INPUT VALUES ///

    // remove chord options
    $: if ($activeEdit.type === "overlay" && box?.edit?.chords) {
        delete box.edit.chords
    }

    $: if (id === "text") {
        setBoxInputValue(box, "default", "font-family", "styleValue", getStyles(style)["font"] || "")
        setBoxInputValue(box, "default", "textFit", "hidden", !item?.auto)

        setBoxInputValue2(box2, "default", "font-family", "styleValue", getStyles(style)["font"] || "")
        setBoxInputValue2(box2, "default", "textFit", "hidden", !item?.auto)

        // text
        setBoxInputValue(box, "text", "nowrap", "value", !!styles["white-space"]?.includes("nowrap"))

        // lines
        setBoxInputValue(box, "lines", "specialStyle.lineGap", "value", item?.specialStyle?.lineGap || 0)
        setBoxInputValue(box, "lines", "specialStyle.lineRadius", "value", item?.specialStyle?.lineRadius || 0)
        let lineBg = item?.specialStyle?.lineBg || ""
        setBoxInputValue(box, "lines", "specialStyle.lineBg", "value", lineBg)
        let backgroundValue = splitRgb(lineBg)
        setBoxInputValue(box, "lines", "specialStyle.opacity", "value", backgroundValue.a)
        setBoxInputValue(box, "lines", "specialStyle.opacity", "hidden", lineBg.includes("gradient") || !lineBg)

        // list
        setBoxInputValue(box, "list", "list.enabled", "value", item?.list?.enabled || false)
        setBoxInputValue(box, "list", "list.style", "value", item?.list?.style || "disc")
        setBoxInputValue(box, "list", "list.style", "hidden", !item?.list?.enabled)
        // setBoxInputValue(box, "list", "list.interval", "value", item?.list?.interval || 0)
        // setBoxInputValue(box, "list", "list.interval", "hidden", !item?.list?.enabled)

        // chords
        setBoxInputValue(box, "chords", "chords.enabled", "value", item?.chords?.enabled || false)
        setBoxInputValue(box, "chords", "chords.color", "value", item?.chords?.color || "#FF851B")
        setBoxInputValue(box, "chords", "chords.size", "value", item?.chords?.size || 60)
        setBoxInputValue(box, "chords", "chords.offsetY", "value", item?.chords?.offsetY || 0)
        setBoxInputValue(box, "chords", "chords.color", "hidden", !item?.chords?.enabled)
        setBoxInputValue(box, "chords", "chords.size", "hidden", !item?.chords?.enabled)
        setBoxInputValue(box, "chords", "chords.offsetY", "hidden", !item?.chords?.enabled)

        // special
        setBoxInputValue(box, "special", "scrolling.type", "value", item?.scrolling?.type || "none")
        setBoxInputValue(box, "special", "button.press", "value", item?.button?.press || "")
        setBoxInputValue(box, "special", "button.release", "value", item?.button?.release || "")
    }
    $: if (id === "media" && item) {
        setBoxInputValue(box, "default", "src", "value", item.src || "")
        setBoxInputValue(box, "default", "speed", "value", item.speed ?? 1)

        const extension = getExtension(item.src || "")
        setBoxInputValue(box, "default", "muted", "hidden", getMediaType(extension) !== "video")
        setBoxInputValue(box, "default", "loop", "hidden", getMediaType(extension) !== "video")
        setBoxInputValue(box, "default", "speed", "hidden", getMediaType(extension) !== "video")
    }
    $: if (id === "web" && item) {
        setBoxInputValue(box, "default", "web.src", "value", item?.web?.src || "")
    }
    $: if (id === "timer" && item) {
        setBoxInputValue(box, "default", "timer.circleMask", "hidden", item.timer?.viewType !== "circle")
        setBoxInputValue(box, "default", "timer.showHours", "value", item.timer?.showHours !== false)
        const timer = $timers[item.timer?.id || ""]
        const timerLength = Math.abs((timer?.start || 0) - (timer?.end || 0))
        setBoxInputValue(box, "default", "timer.showHours", "hidden", (item.timer?.viewType || "time") !== "time" || timerLength < 3600)
        setBoxInputValue(box, "font", "auto", "value", item.auto ?? true)
    }
    $: if (id === "clock" && item) {
        const clockType = item.clock?.type || "digital"
        const dateFormat = item.clock?.dateFormat || "none"

        setBoxInputValue(box, "default", "clock.dateFormat", "hidden", clockType !== "digital")
        setBoxInputValue(box, "default", "clock.showTime", "hidden", clockType !== "digital" || dateFormat === "none")
        setBoxInputValue(box, "default", "clock.seconds", "hidden", clockType === "custom" || (clockType === "digital" && item.clock?.showTime === false && dateFormat !== "none"))
        setBoxInputValue(box, "default", "clock.customFormat", "hidden", clockType !== "custom")
    }
    $: if (id === "camera" && item) {
        if (item.device?.name) setBoxInputValue(box, "default", "device", "name", item.device.name)
        // WIP this does not update name when chosen
    }
    $: if (id === "slide_tracker" && item) {
        if (item.tracker?.type) setBoxInputValue(box, "default", "tracker.type", "value", item.tracker.type)
        setBoxInputValue(box, "default", "tracker.accent", "value", item.tracker?.accent || $themes[$theme]?.colors?.secondary || "#F0008C")

        setBoxInputValue(box, "default", "tracker.childProgress", "hidden", item.tracker?.type !== "group")
        setBoxInputValue(box, "default", "tracker.oneLetter", "hidden", item.tracker?.type !== "group")
    }
    $: if (id === "events" && item) {
        setBoxInputValue(box, "default", "events.startDate", "hidden", !item.events?.enableStartDate)
        setBoxInputValue(box, "default", "events.startTime", "hidden", !item.events?.enableStartDate)
    }
    $: if (id === "mirror" && item) {
        getMirrorValues()
    }

    // moved to textbox, but keep if someone still have old items
    $: if (id === "list" && item) {
        setBoxInputValue(box, "default", "list.items", "value", item.list?.items || [])
    }
    $: if (id === "variable" && item) {
        setBoxInputValue(box, "default", "variable.id", "value", item.variable?.id)
    }

    function getMirrorValues() {
        if (!item?.mirror) return

        let enableStage = item.mirror.enableStage || false
        let nextSlide = item.mirror.nextSlide || false
        let useSlideIndex = item.mirror.useSlideIndex
        let index = item.mirror.index

        setBoxInputValue(box, "default", "mirror.enableStage", "value", true)
        setBoxInputValue(box, "default", "mirror.nextSlide", "value", true)
        setBoxInputValue(box, "default", "mirror.show", "value", true)
        setBoxInputValue(box, "default", "mirror.useSlideIndex", "value", true)
        setBoxInputValue(box, "default", "mirror.index", "value", true)

        if (nextSlide) {
            setBoxInputValue(box, "default", "mirror.enableStage", "hidden", true)
            setBoxInputValue(box, "default", "mirror.show", "hidden", true)
            setBoxInputValue(box, "default", "mirror.useSlideIndex", "hidden", true)
            setBoxInputValue(box, "default", "mirror.index", "hidden", true)
        } else if (enableStage) {
            setBoxInputValue(box, "default", "mirror.show", "name", "select_stage")
            setBoxInputValue(box, "default", "mirror.show", "values", { options: getStageList() })
            setBoxInputValue(box, "default", "mirror.show", "id", "mirror.stage")

            setBoxInputValue(box, "default", "mirror.nextSlide", "hidden", true)
            setBoxInputValue(box, "default", "mirror.useSlideIndex", "hidden", true)
            setBoxInputValue(box, "default", "mirror.index", "hidden", true)
        } else {
            setBoxInputValue(box, "default", "mirror.show", "name", "popup.select_show")
            setBoxInputValue(box, "default", "mirror.show", "values", { options: getListOfShows(!$activeEdit.id) })
            setBoxInputValue(box, "default", "mirror.show", "id", "mirror.show")

            setBoxInputValue(box, "default", "mirror.enableStage", "hidden", false)
            setBoxInputValue(box, "default", "mirror.nextSlide", "hidden", false)
            setBoxInputValue(box, "default", "mirror.show", "hidden", false)
            setBoxInputValue(box, "default", "mirror.useSlideIndex", "hidden", false)
            setBoxInputValue(box, "default", "mirror.index", "hidden", false)
        }

        setBoxInputValue(box, "default", "mirror.enableStage", "value", enableStage)
        setBoxInputValue(box, "default", "mirror.nextSlide", "value", nextSlide)
        if (useSlideIndex !== undefined) setBoxInputValue(box, "default", "mirror.useSlideIndex", "value", useSlideIndex)
        if (index !== undefined) setBoxInputValue(box, "default", "mirror.index", "value", index)
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
        const lineStyleChanged = input.id === "specialStyle.opacity" || (input.value && input.id === "specialStyle.lineBg" && !input.value.includes("gradient"))
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

        let newFontSize = 0
        if (input.id === "textFit") {
            // change font size to more clearly indicate what the different text fit does
            newFontSize = input.value === "shrinkToFit" ? 100 : MAX_FONT_SIZE
        } else if (input.id === "auto" && item?.textFit === "growToFit") {
            if (input.value && Number(styles["font-size"]) < MAX_FONT_SIZE) newFontSize = MAX_FONT_SIZE
            else if (!input.value && Number(styles["font-size"]) === MAX_FONT_SIZE) newFontSize = 100
        }
        if (newFontSize) updateValue({ detail: { name: "font_size", id: "style", key: "font-size", value: newFontSize + "px" } })

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

        // reverse to get same order as "Textbox" & "Items" etc., uses
        if (($activeEdit.type || "show") === "show") allItems = allItems.reverse()

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

    // $: boxSections = box2?.sections || {}
    // function updateValue2(e: any) {
    //     const input = clone(e.detail)
    //     input.value = input.values.value
    //     input.input = input.type

    //     // setBoxInputValue(box, "default", "mirror.show", "name", "select_stage")
    //     // boxSections.default.inputs[0].values[0].value = input.value

    //     updateValue({ detail: input })

    //     // { id: "style", key: "font-family", type: "fontDropdown", value: "CMGSans", values: { label: "edit.family" } }
    //     // { name: "family", id: "style", key: "font-family", input: "fontDropdown", value: "CMGSans" },
    // }

    let sessionId = ""
    if (item) sessionId = uid()

    // don't load right away (because that will load content twice)
    let loaded = false
    onMount(() => {
        loaded = true
    })
</script>

<svelte:window on:keyup={keyup} on:keydown={keydown} on:mouseup={getTextSelection} />

{#if loaded}
    <!-- <EditValues2 sections={boxSections} {item} {styles} on:change={updateValue2} /> -->

    <!-- WIP edit checkbox does not animate because of this refresh -->
    {#key id !== "media" && box}
        <EditValues edits={box?.edit} defaultEdits={clone(boxes[id])?.edit} {item} on:change={updateValue} {styles} {lineAlignStyle} {alignStyle} {sessionId} />
    {/key}
{/if}
