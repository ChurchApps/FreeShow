<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import type { Item, ItemType, Slide } from "../../../../types/Show"
    import { activeEdit, activePopup, activeShow, alertMessage, categories, styles as outputStyles, overlays, selected, shownTips, showsCache, special, templates, theme, themes, timers } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getExtension, getMediaType } from "../../helpers/media"
    import { getAllEnabledOutputs } from "../../helpers/output"
    import { getLayoutRef } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import { getStyles } from "../../helpers/style"
    import { MAX_FONT_SIZE } from "../scripts/autosize"
    import { addFilterString, addStyle, addStyleString, getItemStyleAtPos, getItemText, getLastLineAlign, getLineText, getSelectionRange } from "../scripts/textStyle"
    import { itemBoxes, setBoxInputValue } from "../values/boxes"
    import EditValues from "./EditValues.svelte"

    export let id: ItemType
    export let allSlideItems: Item[] = []
    export let item: Item | null = null

    // -----

    // selection
    let selection: null | { start: number; end: number }[] = null
    const unsubscribe = activeEdit.subscribe((a) => {
        if (!a.items.length) {
            selection = null
        }
    })
    onDestroy(unsubscribe)

    let selectionChangeListener: null | (() => void) = null

    onMount(() => {
        getTextSelection()

        selectionChangeListener = () => getTextSelection()
        document.addEventListener("selectionchange", selectionChangeListener)

        // set focus to textbox if only one without content
        if (allSlideItems.length === 1 && item && !getItemText(item).length && !$activeEdit.items.length) {
            activeEdit.update((a) => ({ ...(a || {}), items: [0] }))
            const elem = document.querySelector(".editItem")?.querySelector(".edit")
            if (elem) (elem as HTMLElement).focus()
        }
    })

    onDestroy(() => {
        if (selectionChangeListener) document.removeEventListener("selectionchange", selectionChangeListener)
    })

    function getTextSelection(e: any = null) {
        if (e) {
            if (e.target.closest(".menus") || e.target.closest(".popup") || e.target.closest(".drawer") || e.target.closest(".chords") || e.target.closest(".contextMenu") || e.target.closest(".editTools")) return
        }

        let sel = window.getSelection()

        if (sel?.type === "None") {
            if ((document.activeElement as HTMLElement | null)?.closest(".tools")) return
            selection = null
            return
        }

        const anchorElem = (sel?.anchorNode as Element)?.nodeType === Node.ELEMENT_NODE ? (sel?.anchorNode as Element) : sel?.anchorNode?.parentElement
        if (!anchorElem?.closest(".edit")) return

        selection = getSelectionRange() // range
    }

    function mousedown(e: any) {
        // store if going to a text input in the tools
        if (e.target.closest(".tools")) getTextSelection(e)
    }

    function keyup(e: KeyboardEvent) {
        if (e.key.includes("Arrow") || e.key === "Home" || e.key === "End" || e.key.toUpperCase() === "A") getTextSelection(e)
    }

    const formatting = {
        b: () => ({ id: "style", key: "font-weight", value: "bold" }),
        i: () => ({ id: "style", key: "font-style", value: "italic" }),
        u: () => ({ id: "style", key: "text-decoration", value: "underline" })
    }

    function getFormattingShortcut(e: KeyboardEvent) {
        const byKey = formatting[(e.key || "").toLowerCase()]
        if (byKey) return byKey

        const code = e.code || ""
        if (code.startsWith("Key")) return formatting[code.slice(3).toLowerCase()]

        return null
    }

    function getSelectionPoint(editElem: Element, line: number, pos: number) {
        const lineElem = editElem.childNodes[line]
        if (!lineElem) return null

        let count = 0
        const lineChildren = Array.from(lineElem.childNodes)
        for (const [childIndex, child] of lineChildren.entries()) {
            const textLength = (child as HTMLElement).innerText?.replaceAll("\n", "")?.length ?? child.textContent?.length ?? 0
            const isLastChild = childIndex === lineChildren.length - 1
            if (pos <= count + textLength || isLastChild) {
                const localOffset = Math.max(0, pos - count)

                // child can be a raw #text node or an element containing text.
                if (child.nodeType === Node.TEXT_NODE) {
                    const nodeLength = child.textContent?.length ?? 0
                    return { node: child, offset: Math.min(nodeLength, localOffset) }
                }

                const textNode = child.childNodes?.[0]
                if (!textNode || textNode.nodeName === "BR") return { node: child, offset: 0 }

                if (textNode.nodeType === Node.TEXT_NODE) {
                    const nodeLength = textNode.textContent?.length ?? 0
                    return { node: textNode, offset: Math.min(nodeLength, localOffset) }
                }

                const nodeLength = textNode.textContent?.length ?? 0
                return { node: textNode, offset: Math.min(nodeLength, localOffset) }
            }

            count += textLength
        }

        return null
    }

    function isSelectionBackward(sel: Selection) {
        if (!sel.anchorNode || !sel.focusNode) return false
        if (sel.anchorNode === sel.focusNode) return sel.anchorOffset > sel.focusOffset

        const position = sel.anchorNode.compareDocumentPosition(sel.focusNode)
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return true
        return false
    }

    function restoreTextSelection(editElem: Element, savedSelection: { start: number; end: number }[], keepBackwardSelection = false) {
        const selectedLines = savedSelection.map((line, i) => ({ ...line, line: i })).filter((line) => line.start !== undefined && line.end !== undefined)

        if (!selectedLines.length) return false

        const first = selectedLines[0]
        const last = selectedLines[selectedLines.length - 1]
        const startPoint = getSelectionPoint(editElem, first.line, first.start)
        const endPoint = getSelectionPoint(editElem, last.line, last.end)
        if (!startPoint || !endPoint) return false

        const range = document.createRange()
        range.setStart(startPoint.node, startPoint.offset)
        range.setEnd(endPoint.node, endPoint.offset)

        const sel = window.getSelection()
        if (!sel) return false

        if (sel.setBaseAndExtent) {
            if (keepBackwardSelection) sel.setBaseAndExtent(endPoint.node, endPoint.offset, startPoint.node, startPoint.offset)
            else sel.setBaseAndExtent(startPoint.node, startPoint.offset, endPoint.node, endPoint.offset)
        } else {
            sel.removeAllRanges()
            sel.addRange(range)
        }

        return true
    }

    function keydown(e: KeyboardEvent) {
        const shortcut = getFormattingShortcut(e)
        if ((!e.ctrlKey && !e.metaKey) || !shortcut) return

        const liveSelection = getSelectionRange()
        const hasSelectionRange = !!liveSelection?.some((line) => line.start !== undefined && line.end !== undefined && line.start !== line.end)
        if (!hasSelectionRange) return

        e.preventDefault()

        const selectionSnapshot = liveSelection.map((line) => ({ ...line }))
        selection = selectionSnapshot.map((line) => ({ ...line }))
        const currentDomSelection = window.getSelection()
        const backwardSelection = currentDomSelection ? isSelectionBackward(currentDomSelection) : false

        let value = shortcut()
        // WIP line-through is removed
        if (styles[value.key]?.includes(value.value)) value.value = ""

        updateValue({ detail: value })

        requestAnimationFrame(() => {
            const editElem = document.querySelector(".editArea")?.querySelectorAll(".editItem")?.[$activeEdit.items[0]]?.querySelector(".edit")
            if (!editElem) return

            restoreTextSelection(editElem, selectionSnapshot, backwardSelection)

            selection = selectionSnapshot.map((line) => ({ ...line }))
        })
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

    $: if (box?.sections?.CSS && id !== "captions") {
        setBoxInputValue(box, "CSS", "CSS_text", "value", style)
    }

    $: if (box?.sections?.font) {
        setBoxInputValue(box, "font", "font-size", "disabled", item?.textFit !== "none")
        setBoxInputValue(box, "font", "textFit", "value", item?.textFit || "growToFit") // other items (like clock, timer)
        // setBoxInputValue(box2, "font", "auto", "value", item.auto ?? true)
    }

    $: if (id === "text") {
        setBoxInputValue(box, "default", "font-family", "styleValue", getStyles(style)["font"] || "")
        // setBoxInputValue(box2, "default", "textFit", "hidden", !item?.auto)
        setBoxInputValue(box, "text", "nowrap", "value", !!styles["white-space"]?.includes("nowrap"))
        setBoxInputValue(box, "lines", "specialStyle.lineRadius", "hidden", !item?.specialStyle?.lineRadius && !item?.specialStyle?.lineBg)

        setBoxInputValue(box, "default", "textFit", "value", item?.auto ? "shrinkToFit" : "none") // text items
        // WIP disabled auto size -- don't disable if all text is selected
        // setBoxInputValue(box, "default", "font-size", "disabled", selection?.length)
    }

    $: if (id === "media" && item) {
        const extension = getExtension(item.src || "")
        const isVideo = getMediaType(extension) === "video"
        setBoxInputValue(box, "default", "muted", "hidden", !isVideo)
        setBoxInputValue(box, "default", "loop", "hidden", !isVideo)
        setBoxInputValue(box, "default", "speed", "hidden", !isVideo)
    }

    $: if (id === "timer" && item) {
        setBoxInputValue(box, "default", "timer.circleMask", "hidden", item.timer?.viewType !== "circle")
        const timer = $timers[item.timer?.id || ""]
        const timerLength = Math.abs((timer?.start || 0) - (timer?.end || 0))
        setBoxInputValue(box, "default", "timer.showHours", "value", item.timer?.showHours !== false)
        setBoxInputValue(box, "default", "timer.showHours", "hidden", (item.timer?.viewType || "time") !== "time" || timerLength < 3600)
    }
    $: if (id === "clock" && item) {
        const clockType = item.clock?.type || "digital"
        const dateFormat = item.clock?.dateFormat || "none"

        setBoxInputValue(box, "default", "clock.dateFormat", "hidden", clockType !== "digital")
        setBoxInputValue(box, "default", "clock.showTime", "hidden", clockType !== "digital" || dateFormat === "none")
        setBoxInputValue(box, "default", "clock.seconds", "hidden", clockType === "custom" || (clockType === "digital" && item.clock?.showTime === false && dateFormat !== "none"))
        setBoxInputValue(box, "default", "clock.customFormat", "hidden", clockType !== "custom")
        setBoxInputValue(box, "default", "tip", "hidden", clockType !== "custom")
    }
    $: if (id === "camera" && item) {
        if (item.device?.name) setBoxInputValue(box, "default", "device", "name", item.device.name)
    }
    $: if (id === "slide_tracker" && item) {
        setBoxInputValue(box, "default", "tracker.accent", "value", item.tracker?.accent || $themes[$theme]?.colors?.secondary || "#F0008C")

        setBoxInputValue(box, "default", "tracker.childProgress", "hidden", item.tracker?.type !== "group")
        setBoxInputValue(box, "default", "tracker.oneLetter", "hidden", item.tracker?.type !== "group")
    }
    $: if (id === "events" && item) {
        setBoxInputValue(box, "default", "events.startDaysFromToday", "disabled", !!item.events?.enableStartDate)
        setBoxInputValue(box, "default", "events.startDate", "hidden", !item.events?.enableStartDate)
        setBoxInputValue(box, "default", "events.startTime", "hidden", !item.events?.enableStartDate)
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
            if (!item) return

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
            if (!a[$activeEdit.id!]?.items) return a

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

            a[$activeEdit.id!].modified = Date.now()
            return a
        }
    }

    function updateValue(e: any) {
        let input = e.detail
        console.log("BOX INPUT:", input)

        // does not work for partial text when auto size is enabled
        // WIP doesn't need to show if disabled works correctly
        if (id === "text" && input.key === "font-size" && selection?.length && (item?.textFit || "none") !== "none") {
            newToast("edit.auto_size settings.enabled!")
        }

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
        if (slides[0] && $selected.id === "slide" && Array.isArray($selected.data)) {
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
            if (!slideItems[i]?.length) return
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
                currentSlideItem.lines?.forEach((line, linePos) => {
                    if (!selection?.length || selection[linePos]?.start !== undefined) newAligns.push(`${input.key}: ${input.value};`)
                    else newAligns.push(line.align)
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
            if ($activeEdit.type === "overlay") currentItems = clone($overlays[$activeEdit.id]?.items || [])
            if ($activeEdit.type === "template") currentItems = clone($templates[$activeEdit.id]?.items || [])
            // only selected
            currentItems = currentItems.filter((_item, i) => allItems.includes(i))

            // WIP changing the default "Name" overlay causes textbox swapping....

            allItems.forEach((_itemIndex, i) => {
                if (!currentItems[i]) return

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
            if (currentItems[0]?.lines) {
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
            input.value = input.value.replace("rgb(0 0 0 / 0)", "rgb(0 0 0 / 0.4)")
        }

        // store changes for detection
        if (!$activeEdit.id) {
            const id = `${input.id}${input.key || ""}`
            if (!changes[$activeEdit.slide || 0]) changes[$activeEdit.slide || 0] = {}
            changes[$activeEdit.slide || 0][id] = JSON.stringify(input)
            changes = changes
        }

        updateValue({ detail: input })
    }

    // don't load right away (because that will load content twice)
    let loaded = false
    let hasLoaded = false
    onMount(() => {
        loaded = true
        setTimeout(() => (hasLoaded = true), 100)
    })

    // check if the same changes are made to multiple slides, and notify the user to consider using templates
    let changes: { [key: string]: { [key: string]: string } } = {}
    $: if (changes) checkChanges()
    let shownTemplateTip = false
    function checkChanges() {
        // alert if category has template
        if (hasLoaded && !shownTemplateTip && ($activeEdit.type || "show") === "show") {
            const categoryId = $showsCache[$activeShow?.id || ""]?.category || ""
            const categoryTemplate = $categories[categoryId]?.template || ""
            if (categoryTemplate) {
                alertMessage.set("tips.category_template")
                activePopup.set("alert")
                shownTemplateTip = true
                return
            }
        }

        // alert if all outputs has style templates
        if (hasLoaded && !shownTemplateTip && $special.styleTemplatePreview !== false) {
            const outputsHasStyleTemplate = getAllEnabledOutputs().every((output) => {
                return !!$outputStyles[output?.style || ""]?.template
            })
            if (outputsHasStyleTemplate) {
                alertMessage.set("tips.style_template_active")
                activePopup.set("alert")
                shownTemplateTip = true
                return
            }
        }

        if ($shownTips.includes("consider_templates")) return

        const SLIDES = 3
        const allValues: string[] = Object.values(changes).flatMap((slide) => Object.values(slide))
        const valueCounts = new Map<string, number>()

        allValues.forEach((value) => {
            valueCounts.set(value, (valueCounts.get(value) || 0) + 1)
        })

        const duplicates = Array.from(valueCounts.entries()).filter(([_value, count]) => count > SLIDES)
        if (duplicates.length > 0) {
            // openDrawer("templates")
            alertMessage.set("tips.consider_templates")
            activePopup.set("alert")
            shownTips.set([...$shownTips, "consider_templates"])
        }
    }
</script>

<svelte:window on:keyup={keyup} on:keydown={keydown} on:mouseup={getTextSelection} on:mousedown={mousedown} />

{#if loaded}
    <EditValues sections={boxSections} {item} {styles} {customValues} type="text" on:change={updateValue2} />
{/if}
