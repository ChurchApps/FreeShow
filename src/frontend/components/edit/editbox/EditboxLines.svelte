<script lang="ts">
    import { onMount, tick } from "svelte"
    import { uid } from "uid"
    import type { Item, Line } from "../../../../types/Show"
    import { splitCustomDynamicValues } from "../../../show/slides"
    import { activeEdit, activeShow, activeStage, overlays, redoHistory, refreshListBoxes, showsCache, stageShows, templates } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { getNormalizedKey, isComposing, isFormattingKey } from "../../../utils/shortcuts"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { addToPos } from "../../helpers/mover"
    import { getLayoutRef } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import { getStyles } from "../../helpers/style"
    import autosize from "../scripts/autosize"
    import { getItemText, getLineText, getSelectionRange, setCaret } from "../scripts/textStyle"
    import EditboxChords from "./EditboxChords.svelte"
    import { EditboxHelper } from "./EditboxHelper"
    import { EditboxPaste } from "./EditboxPaste"

    export let item: Item
    export let ref: {
        type?: "show" | "overlay" | "template" | "stage"
        showId?: string
        origin?: string
        id: string
    }
    export let index: number
    export let editIndex = -1
    export let plain = false
    export let chordsMode = false
    export let chordsAction = ""
    export let isLocked = false

    let textElem: HTMLElement | undefined
    let html = ""
    let previousHTML = ""
    let currentStyle = ""

    // WIP pressing line break on empty html (textbox) does not work, but it works after typing something

    onMount(() => {
        getStyle()

        setTimeout(() => {
            loaded = true
            autoSize = item?.autoFontSize || 0
            if (autoSize) return

            getCustomAutoSize()
        }, 50)
    })

    // prevent certain updates during IME composition to prevent text deselecting and double-insertion.
    let composing = false

    let currentSlide = -1
    $: if ($activeEdit.slide !== null && $activeEdit.slide !== undefined && $activeEdit.slide !== currentSlide && !composing) {
        currentSlide = $activeEdit.slide
        setTimeout(getStyle, 10)
    }

    $: {
        // style hash
        let s = ""
        clone(item?.lines)?.forEach((line) => {
            let align = (typeof line.align === "string" ? line.align : "").replaceAll(lineStyleBg, "").replaceAll(lineStyleRadius, "") + ";"
            s += align + lineStyleBg + lineStyleRadius // + line.chords?.map((a) => a.key)
            if (!line?.text) return
            if (!Array.isArray(line.text)) line.text = []
            line.text.forEach((a) => {
                s += EditboxHelper.getTextStyle(a)
            })
        })

        // dont replace while typing
        // && (window.getSelection() === null || window.getSelection()!.type === "None")
        if (currentStyle.replaceAll(";", "") !== s.replaceAll(";", "") && !composing) getStyle()
    }

    let previousChords = ""
    $: {
        // chords updated! (needed to save chords so they don't get reset when changing the lines)
        let newChords = JSON.stringify(item?.lines?.map((a) => a.chords?.map((a) => a.key)))
        if (previousChords !== newChords) {
            previousChords = newChords
            getStyle()
        }
    }

    $: lineGap = item?.specialStyle?.lineGap
    $: lineRadius = item?.specialStyle?.lineRadius || 0
    $: lineBg = item?.specialStyle?.lineBg
    $: lineStyleBox = lineGap ? `gap: ${lineGap}px;` : ""
    $: lineStyleRadius = lineRadius ? `border-radius: ${lineRadius}px;` : ""
    $: lineStyleBg = lineBg ? `background: ${lineBg};` : ""

    function getStyle() {
        if (composing) return
        if (!plain && $activeEdit.slide === null) return

        let result = EditboxHelper.getStyleHtml(item, plain, currentStyle, ref.origin === "powerpoint")
        html = result.html
        currentStyle = result.currentStyle
        previousHTML = html
    }

    // let sel = getSelectionRange()

    $: if (textElem && html !== previousHTML && !composing) {
        previousHTML = html
        // let pos = getCaretCharacterOffsetWithin(textElem)
        setTimeout(updateLines, 10)
    }

    function setCaretDelayed(line: number, pos: number) {
        setTimeout(() => {
            setCaret(textElem, { line, pos })
        }, 10)
    }

    async function refreshStyleAndRestoreCaret(caret: { line: number; pos: number }) {
        getStyle()
        await tick()
        setCaret(textElem, caret)
    }

    function keydown(e: KeyboardEvent) {
        if (isComposing(e)) return

        if (e.key === "Enter" && e.shiftKey) {
            // by default the browser contenteditable will add a <br> instead of our custom <span class="break"> when pressing SHIFT
            // so just prevent shift break!
            e.preventDefault()
            return
        }

        // WIP replace with exising altKeys cut_in_half shortcuts.ts

        if (e.key === "Enter" && (e.target?.closest(".item") || e.target?.closest(".quickEdit"))) {
            // only the focused editbox instance should handle the split
            if (e.target !== textElem) return
            if (e.target.closest(".quickEdit") && Number(e.target.closest(".quickEdit").getAttribute("data-index")) !== editIndex) return
            if (!e.target.closest(".quickEdit") && !$activeEdit.items.includes(index)) return

            if (!e.altKey) return

            // split
            let sel = getSelectionRange()
            if (!sel?.length || (sel.length === 1 && !Object.keys(sel[0]).length)) return

            let lines: Line[] = getNewLines()
            let currentIndex = 0,
                textPos = 0
            let start = -1

            cutInTwo({ e, sel, lines: clone(lines), currentIndex, textPos, start })
        }

        storeCurrentCaretPos()
    }

    function cutInTwo({ e, sel, lines, currentIndex, textPos, start }) {
        if ((ref.type || "show") !== "show") return
        let { firstLines, secondLines } = EditboxHelper.cutLinesInTwo({ sel, lines, currentIndex, textPos, start })

        // in list view the component's own indexes are correct, $activeEdit might hold a stale edit tab state
        if (!plain && typeof $activeEdit.slide === "number") editIndex = $activeEdit.slide
        let domItemIndex = Number(e?.target?.closest(".editItem")?.getAttribute("data-index"))
        let editItemIndex: number = plain ? index : ($activeEdit.items[0] ?? (isNaN(domItemIndex) ? 0 : domItemIndex))

        let layoutRef = getLayoutRef()
        let slideRef = layoutRef[editIndex]
        if (!slideRef) return

        // create new slide
        let newSlide = clone(_show().slides([ref.id]).get()[0]) || {}
        if (!newSlide.items?.[editItemIndex]) return
        newSlide.items[editItemIndex].lines = secondLines
        delete newSlide.id
        delete newSlide.globalGroup
        newSlide.group = null
        newSlide.color = null

        // update scripture dynamic values based on current firstLines & secondLines
        // WIP duplicate of splitItemInTwo (kinda)
        if (newSlide.customDynamicValues) {
            const buildDV = (lines: Line[]) => {
                const targetCDV = clone(newSlide.customDynamicValues!)
                const collected: Record<string, Record<number, string>> = {}

                lines.forEach((line) => {
                    line.text?.forEach((text) => {
                        if (!text.sourceDynamicKey) return
                        const [key, indexStr] = text.sourceDynamicKey.split(":")
                        const idx = Number(indexStr || "0")
                        collected[key] = collected[key] || {}
                        collected[key][idx] = (collected[key][idx] ? collected[key][idx] + " " : "") + text.value
                    })
                })

                Object.keys(targetCDV).forEach((key) => {
                    const val = targetCDV[key]
                    if (Array.isArray(val)) {
                        targetCDV[key] = val.map((item, idx) => (collected[key]?.[idx] !== undefined ? (Array.isArray(item) ? [item[0], collected[key][idx]] : collected[key][idx]) : null)).filter(Boolean)
                    } else if (collected[key]?.[0] !== undefined) {
                        targetCDV[key] = collected[key][0]
                    }
                })
                return targetCDV
            }

            const firstDV = buildDV(firstLines)
            const secondDV = buildDV(secondLines)

            showsCache.update((a) => {
                const showId = ref.showId || $activeShow?.id || ""
                if (a[showId]?.slides?.[ref.id]) a[showId].slides[ref.id].customDynamicValues = firstDV
                return a
            })
            newSlide.customDynamicValues = secondDV
        }

        // add new slide
        let id = uid()
        _show().slides([id]).add([newSlide])

        // update slide
        updateLines(firstLines)

        // set child
        let parentId = slideRef.type === "child" ? slideRef.parent!.id : slideRef.id
        let children = _show().slides([parentId]).get("children")[0] || []
        let slideIndex = slideRef.type === "child" ? slideRef.index + 1 : 0
        children = addToPos(children, [id], slideIndex)
        _show().slides([parentId]).set({ key: "children", value: children })

        let parentIndex = slideRef.type === "child" ? slideRef.parent!.layoutIndex : slideRef.layoutIndex
        let parentsBefore = layoutRef.filter((a, i) => i < parentIndex && a.id === parentId)?.length
        let newIndex = $activeEdit.slide! + (parentsBefore + 1)

        if (!e?.target?.closest(".item")) {
            getStyle()
            return
        }

        // set focus to textbox
        activeEdit.set({ slide: newIndex, items: [0], showId: $activeShow?.id })
        setTimeout(() => {
            // timeout because elem is refreshed first
            const elem = document.querySelector(".editItem")?.querySelector(".edit")
            if (elem) (elem as HTMLElement).focus()

            // set caret at the end
            let sel = getSelectionRange()
            const caret = { line: sel.length - 1, pos: 999 }
            setCaret(elem, caret)
        })
    }

    let HISTORY_UPDATE_KEY = 0
    let updates = 0
    let recentKeyboardLineMutationAt = 0
    function updateLines(newLines: Line[] = []) {
        if (composing) return

        // updateItem = true
        if (!newLines?.length) newLines = getNewLines()

        if ($activeEdit.type === "overlay") overlays.update(setNewLines)
        else if ($activeEdit.type === "template") templates.update(setNewLines)
        else if (ref.type === "stage") {
            stageShows.update((a) => {
                if (!a[$activeStage.id!]?.items?.[ref.id]) return a
                a[$activeStage.id!].items[ref.id].lines = newLines
                a[$activeStage.id!].modified = Date.now()
                return a
            })
        } else if (ref.id) {
            // dont override history when undoing
            let lastRedo = $redoHistory[$redoHistory.length - 1]
            if (lastRedo?.id === "SHOW_ITEMS") {
                let previousData = lastRedo.oldData.previousData

                let historyText = previousData[index]?.lines.reduce((text, line) => (text += getLineText(line)), "")
                let linesText = newLines.reduce((text, line) => (text += getLineText(line)), "")

                if (historyText === linesText) return
            }

            // only reset caret when lines are added/removed, not when line content changes
            let lastChangedLine = EditboxHelper.determineCaretLine(item?.lines || [], newLines)
            const keyboardLineMutation = Date.now() - recentKeyboardLineMutationAt < 250
            const domSelection = window.getSelection()
            const anchorElem = (domSelection?.anchorNode as Element)?.nodeType === Node.ELEMENT_NODE ? (domSelection?.anchorNode as Element) : domSelection?.anchorNode?.parentElement
            const editingThisTextElem = !!textElem && (document.activeElement === textElem || anchorElem?.closest(".edit") === textElem)
            if (lastChangedLine > -1 && (item?.lines || []).length !== newLines.length && !keyboardLineMutation && !editingThisTextElem) setCaretDelayed(lastChangedLine, 0) // create new history store, when passing 15 steps
            updates++
            if (updates >= 15) {
                HISTORY_UPDATE_KEY++
                updates = 0
            }
            let itemRef = ref.showId + ref.id + "_" + index + "_" + HISTORY_UPDATE_KEY

            // WIP I guess this (undo/redo) is also controlled by the default text input method..

            // fix lineBg/Radius style
            if (lineStyleBg) {
                newLines.forEach((line) => {
                    line.align = (typeof line.align === "string" ? line.align : "").replace(lineStyleBg, "")
                })
            }
            if (lineStyleRadius) {
                newLines.forEach((line) => {
                    line.align = (typeof line.align === "string" ? line.align : "").replace(lineStyleRadius, "")
                })
            }

            history({ id: "SHOW_ITEMS", newData: { key: "lines", data: clone([newLines]), slides: [ref.id], items: [index], showId: ref.showId }, location: { page: "none", override: itemRef } })

            // update stored scripture custom dynamic values
            if ($showsCache[ref.showId || ""]?.slides?.[ref.id]?.customDynamicValues) {
                showsCache.update((a) => {
                    if (!a[ref.showId || ""]?.slides?.[ref.id]?.customDynamicValues) return a
                    newLines.forEach((line) => {
                        line.text?.forEach((text) => {
                            if (text.sourceDynamicKey?.includes("scripture_text")) {
                                const key = text.sourceDynamicKey.split(":")[0]
                                const index = text.sourceDynamicKey.split(":")[1] || "0"
                                const storage = a[ref.showId!]?.slides?.[ref.id]?.customDynamicValues
                                if (!storage?.[key]?.[index]) return
                                storage[key][index][1] = text.value
                            }
                        })
                    })
                    return a
                })
            }

            // refresh list view boxes
            if (plain) refreshListBoxes.set(editIndex)
        }

        function setNewLines(a: any) {
            if (!a[$activeEdit.id!]?.items?.[index]) return a

            a[$activeEdit.id!].items[index].lines = newLines

            a[$activeEdit.id!].modified = Date.now()
            return a
        }
    }

    // AUTO SIZE

    // text change
    let textChanged = false
    let previousText = ""
    let changedTimeout: NodeJS.Timeout | null = null
    $: if (html && textElem?.innerText !== previousText) checkText()
    function checkText() {
        textChanged = true
        previousText = textElem?.innerText || ""
        if (changedTimeout) clearTimeout(changedTimeout)
        changedTimeout = setTimeout(() => (textChanged = false), 500)
    }

    let isTyping = false
    $: if (isAuto && textChanged) checkTyping()
    let typingTimeout: NodeJS.Timeout | null = null
    function checkTyping() {
        if (!loaded) return
        isTyping = true

        if (typingTimeout) clearTimeout(typingTimeout)
        typingTimeout = setTimeout(() => {
            isTyping = false
            if (isAuto) getCustomAutoSize()
        }, 800)
    }

    // update auto size
    let loaded = false
    $: isAuto = item?.auto || (item?.textFit || "none") !== "none"
    $: textArray = Array.isArray(item?.lines?.[0]?.text) ? item.lines[0].text : []
    $: itemText = textArray.filter((a) => !a.customType?.includes("disableTemplate")) || []
    $: itemFontSize = Number(getStyles((ref.type === "stage" ? item : itemText[0])?.style, true)?.["font-size"] || "")
    $: if (isAuto || itemFontSize || textChanged) getCustomAutoSize()

    let autoSize = 0
    let alignElem: HTMLElement | undefined
    let loopStop: NodeJS.Timeout | null = null
    function getCustomAutoSize() {
        if (isTyping || !loaded || !alignElem || !isAuto) return

        if (loopStop) return
        loopStop = setTimeout(() => (loopStop = null), 200)

        if (ref.type === "stage") {
            itemFontSize = Number(getStyles(item?.style, true)?.["font-size"] || "")
        }

        let type = item?.textFit || "shrinkToFit"
        let defaultFontSize = itemFontSize
        let maxFontSize

        // if (ref.type === "stage") {
        //     type = "growToFit"
        // }

        if (type === "growToFit") {
            defaultFontSize = 100
            maxFontSize = itemFontSize
        }

        autoSize = autosize(alignElem, { type, textQuery: ".edit .break span", defaultFontSize, maxFontSize })
    }

    // UPDATE STYLE FROM LINES

    function getNewLines() {
        if (!textElem || !item) return []

        let newLines: Line[] = []
        let pos = -1
        currentStyle = ""
        let updateHTML = false

        // plain mode DOM carries no styles, resolve the source line/text by identity attributes (survives line splits/merges)
        const attrIndex = (elem: any, name: string, fallback: number) => {
            const value = Number(elem.getAttribute?.(name) ?? NaN)
            return isNaN(value) ? fallback : value
        }

        new Array(...textElem.children).forEach((line: any, i) => {
            const sourceLine = plain ? attrIndex(line, "data-line-index", i) : i
            let align: string = plain ? (typeof item.lines?.[sourceLine]?.align === "string" ? (item.lines?.[sourceLine]?.align as string) : "") : line.getAttribute("style") || ""
            align = align.replaceAll(lineStyleBg, "").replaceAll(lineStyleRadius, "") + ";"
            pos++
            currentStyle += align + lineStyleBg + lineStyleRadius

            let newLine = { align, text: [] as any[] }
            let lineChords: any[] = []

            newLines.push(newLine)

            new Array(...line.childNodes).forEach((child: any, j) => {
                if (child.nodeName === "#text") {
                    // add "floating" text to previous node (e.g. pressing backspace at the start of a line)
                    // preserve style when merging lines with different styling (macOS issue)
                    let lastNode = newLines[pos].text.length - 1
                    let originalLineStyle = item.lines?.[sourceLine]?.text?.[0]?.style || ""
                    let lastNodeStyle = lastNode >= 0 ? newLines[pos].text[lastNode]?.style || "" : ""

                    // Create new segment if no previous node or styles differ
                    if (lastNode < 0 || !newLines[pos].text[lastNode] || (originalLineStyle && originalLineStyle !== lastNodeStyle)) {
                        newLines[pos].text.push({ style: originalLineStyle, value: child.textContent })
                    } else {
                        newLines[pos].text[lastNode].value += child.textContent
                    }

                    updateHTML = true
                    return
                }
                if (child.nodeName !== "SPAN") {
                    // merge stray elements the browser sometimes creates on backspace/delete (e.g. <font>) into the previous segment
                    const strayText = child.nodeType === Node.ELEMENT_NODE ? (child.innerText || "").replaceAll("\n", "") : ""
                    if (strayText) {
                        let lastNode = newLines[pos].text.length - 1
                        if (lastNode < 0) newLines[pos].text.push({ style: item.lines?.[sourceLine]?.text?.[0]?.style || "", value: strayText })
                        else newLines[pos].text[lastNode].value += strayText
                        updateHTML = true
                    }
                    return
                }

                const sourceText = plain ? attrIndex(child, "data-text-index", j) : j
                let style = plain ? item.lines?.[sourceLine]?.text[sourceText]?.style || "" : child.getAttribute("style") || ""

                let lineText = child.innerText
                // empty line
                if (lineText === "\n") lineText = ""
                if (plain && !lineText && !style) {
                    style = item.lines?.[i - 1]?.text[0]?.style || ""
                    newLines[pos].align = newLines[pos - 1]?.align || ""
                }

                // remove custom font size
                let customIndex = style.indexOf("--custom")
                if (customIndex > -1) style = style.slice(0, customIndex)

                // GET custom values
                let customType = child.getAttribute("data-customtype") || undefined
                let sourceDynamicKey = child.getAttribute("data-sourcedynamickey") || undefined

                const text: any = { style, value: lineText }
                if (customType) text.customType = customType
                if (sourceDynamicKey) text.sourceDynamicKey = sourceDynamicKey

                newLines[pos].text.push(text)

                currentStyle += style

                // GET CHORDS
                let storedChords = child.getAttribute("data-chords")
                if (storedChords) {
                    try {
                        storedChords = JSON.parse(storedChords)
                        lineChords.push(...storedChords)
                    } catch (err) {
                        return
                    }
                }
            })

            // ADD BACK CHORDS
            if (lineChords?.length) {
                newLines[pos].chords = lineChords

                // UPDATE/FIX CHORDS ON LINE BREAK (the browser clones the data-chords attributes when splitting a line)
                const previousChordIds = newLines[pos - 1]?.chords?.map((a) => a.id) || []
                const shared = (a) => previousChordIds.includes(a.id)
                if (pos > 0 && newLines[pos].chords!.some(shared)) {
                    let breakPoint = newLines[pos - 1].text.reduce((textLength, text) => (textLength += text.value.length), 0)

                    newLines[pos - 1].chords = newLines[pos - 1].chords!.filter((a) => !shared(a) || a.pos < breakPoint)
                    newLines[pos].chords = newLines[pos].chords!.filter((a) => !shared(a) || a.pos >= breakPoint).map((a) => (shared(a) && a.pos >= breakPoint ? { ...a, pos: a.pos - breakPoint } : a))
                }
            }
        })

        if (pasting) return newLines

        const keyboardLineMutation = Date.now() - recentKeyboardLineMutationAt < 250

        if (updateHTML && !keyboardLineMutation) {
            // get caret pos
            let sel = getSelectionRange()
            let lineIndex = sel.findIndex((a) => a?.start !== undefined)
            if (lineIndex >= 0) {
                let caret = { line: lineIndex || 0, pos: sel[lineIndex]?.start || 0 }
                void refreshStyleAndRestoreCaret(caret)
            }
        }

        // fix removing all text in a line
        let caret: any = null
        let liveSel = getSelectionRange()
        let liveSelLine = liveSel.findIndex((a) => a?.start !== undefined)
        const liveCaret = liveSelLine > -1 ? { line: liveSelLine, pos: liveSel[liveSelLine]?.start || 0 } : null

        let align = item.lines?.[0]?.align || ""
        let textStyle = item.lines?.[0]?.text?.[0]?.style || ""

        if (!newLines.length) {
            newLines = [{ align, text: [{ style: textStyle, value: "" }] }]
            caret = { line: 0, pos: 0 }
        } else {
            newLines.forEach((line, i) => {
                if (!line.text?.length) {
                    const lineStyle = item.lines?.[i]?.text?.[0]?.style || textStyle
                    newLines[i].text = [{ style: lineStyle, value: "" }]
                    caret = { line: i, pos: 0 }
                }
            })

            // set to last caret pos (if backspace)
            let sel = getSelectionRange()
            let currentLine = sel.findIndex((a) => a?.start !== undefined)
            let deleteKey = currentLine === lastCaretPos.line
            if (!caret && (item.lines || []).length > newLines.length) {
                if (liveCaret) {
                    caret = liveCaret
                } else if (deleteKey) {
                    caret = lastCaretPos
                } else {
                    let newLine = lastCaretPos.line > -1 ? lastCaretPos.line - 1 : newLines.length - 1
                    let newPos = lastCaretPos.pos > -1 ? getLineText(newLines[lastCaretPos.line - 1]).length - lastCaretPos.lineLength : getLineText(newLines[newLines.length - 1]).length
                    caret = { line: newLine, pos: newPos }
                }
            }
        }

        // For keyboard line operations that changed the line structure, prefer the live caret from the contenteditable DOM.
        // In-line edits (e.g. backspace inside a line) must not rebuild the HTML, that would destroy the browser's own caret.
        const structureChanged = (item.lines || []).length !== newLines.length || newLines.some((line, i) => (line.text?.length || 0) !== (item.lines?.[i]?.text?.length || 0))
        if (keyboardLineMutation && liveCaret && structureChanged) caret = liveCaret

        if (caret) {
            item.lines = newLines
            if (newLines.length > 0) void refreshStyleAndRestoreCaret(caret)

            lastCaretPos = caret
        } else {
            storeCurrentCaretPos()

            // line added (prevent template/overlay caret reset)
            if (ref.type !== "show" && (item.lines || []).length < newLines.length) {
                setTimeout(() => setCaret(textElem, lastCaretPos), 20)
            }
        }

        return newLines
    }

    let lastCaretPos: { line: number; pos: number; lineLength: number } = { line: -1, pos: -1, lineLength: 0 }
    function storeCurrentCaretPos() {
        let sel = getSelectionRange()
        let caretLineIndex = sel.findIndex((line) => line.start !== undefined)
        if (caretLineIndex > -1) lastCaretPos = { line: caretLineIndex, pos: sel[caretLineIndex]?.start ?? -1, lineLength: getHTMLLineText(caretLineIndex).length }
    }

    function getHTMLLineText(lineIndex: number) {
        if (!textElem || !item) return ""

        let text = ""

        let lineElem = textElem.children[lineIndex]
        if (!lineElem) return ""
        new Array(...lineElem.childNodes).forEach((child: any) => {
            if (child.nodeName === "#text") text += child.textContent
            else text += child.innerText
        })

        return text.trim()
    }

    function textElemKeydown(e: KeyboardEvent) {
        if ((e.key === "Enter" || e.key === "Backspace" || e.key === "Delete") && !isComposing(e)) {
            recentKeyboardLineMutationAt = Date.now()
        }

        if (e.ctrlKey || e.metaKey) {
            // Keep rich text changes in BoxStyle handler only.
            if (isFormattingKey(e)) e.preventDefault()
        }

        if (getNormalizedKey(e).toLowerCase() === "v" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            EditboxPaste.handlePaste(
                e,
                {
                    item,
                    ref,
                    textElem,
                    lastCaretPos,
                    getNewLines,
                    updateLines,
                    getStyle,
                    setPasting: (p) => {
                        pasting = p
                    }
                },
                e.shiftKey
            )
        }

        if (e.key === "<") {
            // Bamini font character "<" (ஈ)
            // https://github.com/ChurchApps/FreeShow/issues/2899
            if (item?.lines?.some((line) => line.text?.some((text) => text.style?.toLowerCase()?.includes("bamini")))) {
                e.preventDefault()
                document.execCommand("insertHTML", false, "ஈ")
                return
            }

            // HTML (will be invisible in editor)
            // &lt; is currently read and replaced as < when editing
            newToast("Note: < is treated as HTML")
        }
    }

    function handleCopy(e: ClipboardEvent) {
        EditboxPaste.handleCopy(e, getNewLines())
    }

    function handleCut(e: ClipboardEvent) {
        EditboxPaste.handleCut(e, getNewLines(), paste)
    }

    // paste
    let pasting = false
    function paste(e: any, clipboardText = "", clipboardHtml = "") {
        EditboxPaste.paste(e, clipboardText, clipboardHtml, {
            item,
            ref,
            textElem,
            lastCaretPos,
            getNewLines,
            updateLines,
            getStyle,
            setPasting: (p) => {
                pasting = p
            }
        })
    }
</script>

<svelte:window on:keydown={keydown} />

{#if item?.lines}
    <div bind:this={alignElem} class="align" class:chords={chordsMode} class:plain style={plain ? null : item.align || null}>
        {#if item.lines?.length < 2 && !getItemText(item).length}
            <span class="placeholder">
                <p>
                    {#if chordsMode}
                        <T id="edit.chords" />
                    {:else}
                        <T id="empty.text" />
                    {/if}
                </p>
            </span>
        {/if}
        {#if isLocked}
            <div class="edit">{@html html}</div>
        {:else}
            {#if chordsMode && textElem}
                <EditboxChords {item} {autoSize} {index} {ref} {chordsMode} {chordsAction} />
            {/if}
            <div
                bind:this={textElem}
                on:mouseup={() => storeCurrentCaretPos()}
                class="edit context {plain ? '#editbox_text' : '#edit_box__editbox_text'}"
                class:hidden={chordsMode}
                class:autoSize={item.auto && autoSize}
                contenteditable
                on:keydown={textElemKeydown}
                on:compositionstart={() => (composing = true)}
                on:compositionend={() => (composing = false)}
                on:blur={() => (composing = false)}
                on:copy={handleCopy}
                on:cut={handleCut}
                bind:innerHTML={html}
                style="{plain || !item.auto ? '' : `--auto-size: ${autoSize}px;`}{!plain ? lineStyleBox : ''}{plain ? '' : typeof item.align === 'string' ? item.align.replace('align-items', 'justify-content') : ''}"
                class:height={item.lines?.length < 2 && !item.lines?.[0]?.text[0]?.value.length}
                class:tallLines={chordsMode}
            />
            <!-- this did not work on mac: -->
            <!-- on:paste|preventDefault={paste} -->
        {/if}
    </div>
{/if}

<style>
    .align span.placeholder {
        opacity: 0.5;
        pointer-events: none;
        position: absolute;
        width: 100%;
        overflow: hidden;
        padding-top: 0;

        line-height: 1.5em;
        text-shadow: none;
    }
    .align.chords {
        overflow: visible !important;
    }

    .edit:global(.invisible) {
        pointer-events: none;
        position: absolute;
        opacity: 0;
        overflow: hidden;
    }
    .edit:not(.invisible).autoSize :global(span:not(.custom)) {
        font-size: var(--auto-size) !important;
    }

    .align {
        height: 100%;
        display: flex;
        text-align: center;
        align-items: center;

        position: relative; /* type something overflow */
    }
    .align.plain {
        text-align: start;
        position: relative;
    }

    .edit :global(.break span) {
        min-height: 50px;
        /* display: inline-block; */
    }

    .edit {
        outline: none;
        width: 100%;
        height: 100%;
        overflow-wrap: break-word;
        font-size: 0;
        /* display: inline-block; */
        /* height: 100%; */
        /* white-space: initial; */

        display: flex;
        flex-direction: column;
        text-align: center;
        justify-content: center;
        /* align-items: center; */
    }
    .edit.hidden {
        visibility: hidden;
    }

    .edit :global(.break) {
        text-wrap: balance; /* balanced breaking, looks much cleaner */
        white-space: pre-wrap; /* preserve special spaces from Text edit */
    }
    .edit :global(.break.normalWrap) {
        text-wrap: unset;
    }

    /* .edit.tallLines {
  line-height: 200px;
} */

    .plain .edit {
        font-size: 1.5em;
        justify-content: flex-start;
        text-align: start;
    }

    .edit.height {
        font-size: unset;
    }
    .edit.height :global(.break) {
        height: 1em;
    }
    .edit.height :global(span) {
        height: 100%;
        display: block;
    }

    .edit :global(.break) {
        /* display: contents; */
        width: 100%;
        /* line-height: normal; */
    }

    .edit :global(.break span) {
        /* text transform changes actual text on edit if set to e.g. Uppercase */
        text-transform: none !important;
    }

    .edit:not(.plain .edit) :global(span) {
        font-size: 100px;
        /* min-height: 100px;
  min-width: 100px;
  display: inline-table; */
    }

    /* bible parts */
    .edit :global(.break span.uncertain) {
        opacity: 0.7;
        font-size: 0.8em;
        font-style: italic;
    }
</style>
