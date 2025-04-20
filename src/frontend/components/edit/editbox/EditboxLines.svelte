<script lang="ts">
    import { onMount } from "svelte"
    import { uid } from "uid"
    import type { Item, Line } from "../../../../types/Show"
    import { activeEdit, activeShow, activeStage, overlays, redoHistory, refreshListBoxes, stageShows, templates } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { addToPos } from "../../helpers/mover"
    import { getLayoutRef } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import { getStyles } from "../../helpers/style"
    import autosize from "../scripts/autosize"
    import type { AutosizeTypes } from "../scripts/autosize"
    import { chordMove } from "../scripts/chords"
    import { getLineText, getSelectionRange, setCaret } from "../scripts/textStyle"
    import EditboxChords from "./EditboxChords.svelte"
    import { EditboxHelper } from "./EditboxHelper"

    export let item: Item
    export let ref: {
        type?: "show" | "overlay" | "template" | "stage"
        showId?: string
        id: string
    }
    export let index: number
    export let editIndex: number = -1
    export let plain: boolean = false
    export let chordsMode: boolean = false
    export let chordsAction: string = ""
    export let isLocked: boolean = false

    let textElem: HTMLElement | undefined
    let html: string = ""
    let previousHTML: string = ""
    let currentStyle: string = ""

    // WIP pressing line break on empty html (textbox) does not work, but it works after typing something
    // NOTE: undoing a change will set the html to "", causing the same issue

    onMount(() => {
        getStyle()

        setTimeout(() => {
            loaded = true
            autoSize = item?.autoFontSize || 0
            if (autoSize) return

            getCustomAutoSize()
        }, 50)
    })

    let currentSlide: number = -1
    $: if ($activeEdit.slide !== null && $activeEdit.slide !== undefined && $activeEdit.slide !== currentSlide) {
        currentSlide = $activeEdit.slide
        setTimeout(getStyle, 10)
    }

    $: {
        // style hash
        let s = ""
        let lineBg = item.specialStyle?.lineBg ? `background-color: ${item.specialStyle.lineBg};` : ""
        clone(item?.lines)?.forEach((line) => {
            let align = line.align.replaceAll(lineBg, "") + ";"
            s += align + lineBg // + line.chords?.map((a) => a.key)
            console.assert(Array.isArray(line?.text), "Text is not an array!")
            line?.text?.forEach((a) => {
                s += EditboxHelper.getTextStyle(a)
            })
        })

        // dont replace while typing
        // && (window.getSelection() === null || window.getSelection()!.type === "None")
        if (currentStyle.replaceAll(";", "") !== s.replaceAll(";", "")) getStyle()
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

    function getStyle() {
        if (!plain && $activeEdit.slide === null) return
        let result = EditboxHelper.getStyleHtml(item, plain, currentStyle)
        html = result.html
        currentStyle = result.currentStyle
        previousHTML = html
    }

    // let sel = getSelectionRange()

    $: if (textElem && html !== previousHTML) {
        previousHTML = html
        // let pos = getCaretCharacterOffsetWithin(textElem)
        setTimeout(updateLines, 10)
    }

    function setCaretDelayed(line: number, pos: number) {
        setTimeout(() => {
            setCaret(textElem, { line, pos })
        }, 10)
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter" && e.shiftKey) {
            // by default the browser contenteditable will add a <br> instead of our custom <span class="break"> when pressing SHIFT
            // so just prevent shift break!
            e.preventDefault()
            return
        }

        // TODO: get working in list view
        if (e.key === "Enter" && (e.target?.closest(".item") || e.target?.closest(".quickEdit"))) {
            // incorrect editbox
            if (e.target.closest(".quickEdit") && Number(e.target.closest(".quickEdit").getAttribute("data-index")) !== editIndex) return
            if (!e.target.closest(".quickEdit") && !$activeEdit.items.includes(index)) return

            // split
            let sel = getSelectionRange()
            if (!sel?.length || (sel.length === 1 && !Object.keys(sel[0]).length)) return

            // WIP auto add • or - if on line and pressing Enter

            // if (sel.start === sel.end) {
            let lines: Line[] = getNewLines()
            let currentIndex = 0,
                textPos = 0
            let start = -1

            // TODO: auto bullets
            if (!e.altKey) {
                // console.log(lines, textPos, start, currentIndex, sel)
                // let lastLine = lines[lines.length - 1]
                // let lineText = lastLine.text?.[lastLine.text?.length - 1]?.value
                // if (!lineText?.includes("\n") || !lineText?.includes("• ")) return
                // lines[lines.length - 1].text[lastLine.text.length - 1].value += "• "

                // updateLines(lines)

                return
            }

            cutInTwo({ e, sel, lines, currentIndex, textPos, start })
        }

        storeCurrentCaretPos()
    }

    function cutInTwo({ e, sel, lines, currentIndex, textPos, start }: any) {
        if ((ref.type || "show") !== "show") return
        let { firstLines, secondLines } = EditboxHelper.cutLinesInTwo({ sel, lines, currentIndex, textPos, start })

        if (typeof $activeEdit.slide === "number") editIndex = $activeEdit.slide
        let editItemIndex: number = $activeEdit.items[0] ?? Number(e?.target?.closest(".editItem")?.getAttribute("data-index")) ?? 0

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

        // add new slide
        let id = uid()
        _show()
            .slides([id])
            .add([clone(newSlide)])

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
    let updates: number = 0
    function updateLines(newLines: Line[] = []) {
        // updateItem = true
        if (!newLines?.length) newLines = getNewLines()

        if ($activeEdit.type === "overlay") overlays.update(setNewLines)
        else if ($activeEdit.type === "template") templates.update(setNewLines)
        else if (ref.type === "stage") {
            stageShows.update((a) => {
                if (!a[$activeStage.id!]?.items?.[ref.id]) return a
                a[$activeStage.id!].items[ref.id].lines = newLines
                return a
            })
        } else if (ref.id) {
            // dont override history when undoing
            let lastRedo = $redoHistory[$redoHistory.length - 1]
            if (lastRedo?.id === "SHOW_ITEMS") {
                let previousData = lastRedo.oldData.previousData

                let historyText = previousData[index]?.lines.reduce((text: any, line: any) => (text += getLineText(line)), "")
                let linesText = newLines.reduce((text, line) => (text += getLineText(line)), "")

                if (historyText === linesText) return
            }

            let lastChangedLine = EditboxHelper.determineCaretLine(item?.lines || [], newLines)
            if (lastChangedLine > -1) setCaretDelayed(lastChangedLine, 0)

            // create new history store, when passing 15 steps
            updates++
            if (updates >= 15) {
                HISTORY_UPDATE_KEY++
                updates = 0
            }
            let itemRef = ref.showId + ref.id + "_" + index + "_" + HISTORY_UPDATE_KEY

            // WIP I guess this (undo/redo) is also controlled by the default text input method..

            // fix lineBg style
            const lineBgStyle = item.specialStyle?.lineBg ? `background-color: ${item.specialStyle.lineBg};` : ""
            if (lineBgStyle) {
                newLines.forEach((line) => {
                    line.align = (line.align || "").replace(lineBgStyle, "")
                })
            }

            history({ id: "SHOW_ITEMS", newData: { key: "lines", data: clone([newLines]), slides: [ref.id], items: [index] }, location: { page: "none", override: itemRef } })

            // refresh list view boxes
            if (plain) refreshListBoxes.set(editIndex)
        }

        function setNewLines(a: any) {
            if (!a[$activeEdit.id!].items[index]) return a

            a[$activeEdit.id!].items[index].lines = newLines
            return a
        }
    }

    // AUTO SIZE

    // text change
    let textChanged = false
    let previousText: string = ""
    let changedTimeout: NodeJS.Timeout | null = null
    $: if (html && textElem?.innerText !== previousText) checkText()
    function checkText() {
        textChanged = true
        previousText = textElem?.innerText || ""
        if (changedTimeout) clearTimeout(changedTimeout)
        changedTimeout = setTimeout(() => (textChanged = false), 500)
    }

    // typing
    let isTyping: boolean = false
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
    $: isAuto = item?.auto
    $: textFit = item?.textFit
    $: itemText = item?.lines?.[0]?.text?.filter((a) => !a.customType?.includes("disableTemplate")) || []
    $: itemFontSize = Number(getStyles(itemText[0]?.style, true)?.["font-size"] || "")
    $: if (isAuto || textFit || itemFontSize || textChanged) getCustomAutoSize()

    let autoSize: number = 0
    let alignElem: HTMLElement | undefined
    let loopStop: NodeJS.Timeout | null = null
    function getCustomAutoSize() {
        if (isTyping || !loaded || !alignElem || !item.auto) return

        if (loopStop) return
        loopStop = setTimeout(() => (loopStop = null), 200)

        let type = (item?.textFit || "shrinkToFit") as AutosizeTypes
        let defaultFontSize = itemFontSize
        let maxFontSize

        if (ref.type === "stage") {
            type = "growToFit"
        }

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
        let pos: number = -1
        currentStyle = ""
        let updateHTML: boolean = false
        let lineBg = item.specialStyle?.lineBg ? `background-color: ${item.specialStyle.lineBg};` : ""

        new Array(...textElem.children).forEach((line, i) => {
            let align: string = plain ? item.lines?.[i]?.align || "" : line.getAttribute("style") || ""
            align = align.replaceAll(lineBg, "") + ";"
            pos++
            currentStyle += align + lineBg

            let newLine = { align, text: [] as any[] }
            let lineChords: any[] = []

            newLines.push(newLine)

            // WIP backspace a line into a line with different styling will merge both and apply the first style to both (HTML issue)

            new Array(...line.childNodes).forEach((child: any, j) => {
                if (child.nodeName === "#text") {
                    // add "floating" text to previous node (e.g. pressing backspace at the start of a line)
                    let lastNode = newLines[pos].text.length - 1
                    if (lastNode < 0 || !newLines[pos].text[lastNode]) return
                    newLines[pos].text[lastNode].value += child.textContent

                    updateHTML = true
                    return
                }
                if (child.nodeName !== "SPAN") return

                let style = plain ? item.lines?.[i]?.text[j]?.style || "" : child.getAttribute("style") || ""
                // TODO: pressing enter / backspace will remove any following style in list view
                // if (plain && !style && i > 0) style = item.lines![i - 1]?.text[j]?.style

                let lineText = child.innerText
                // empty line
                if (lineText === "\n") lineText = ""
                if (plain && !lineText && !style) {
                    style = item.lines?.[i - 1]?.text[0]?.style || ""
                    newLines[pos].align = newLines[pos - 1].align || ""
                }

                // remove custom font size
                let customIndex = style.indexOf("--custom")
                if (customIndex > -1) style = style.slice(0, customIndex)

                newLines[pos].text.push({ style, value: lineText })

                currentStyle += style

                // GET CHORDS
                let storedChords = child.getAttribute("data-chords")
                if (storedChords) {
                    storedChords = JSON.parse(storedChords)
                    lineChords.push(...storedChords)
                }
            })

            // ADD BACK CHORDS
            if (lineChords?.length) {
                newLines[pos].chords = lineChords

                // UPDATE/FIX CHORDS ON LINE BREAK
                if (pos > 0 && JSON.stringify(newLines[pos].chords) === JSON.stringify(newLines[pos - 1].chords)) {
                    let breakPoint = newLines[pos - 1].text.reduce((textLength, text) => (textLength += text.value.length), 0)

                    newLines[pos - 1].chords = newLines[pos - 1].chords!.filter((a) => a.pos < breakPoint)
                    newLines[pos].chords = newLines[pos].chords!.filter((a) => a.pos >= breakPoint).map((a) => ({ ...a, pos: a.pos - breakPoint }))
                }
            }
        })

        if (pasting) return newLines

        if (updateHTML) {
            // get caret pos
            let sel = getSelectionRange()
            let lineIndex = sel.findIndex((a) => a?.start !== undefined)
            if (lineIndex >= 0) {
                let caret = { line: lineIndex || 0, pos: sel[lineIndex]?.start || 0 }

                setTimeout(() => {
                    getStyle()
                    // set caret position back
                    setTimeout(() => {
                        setCaret(textElem, caret)
                    }, 10)
                }, 10)
            }
        }

        // fix removing all text in a line
        let caret: any = null
        let align = item.lines?.[0]?.align || ""
        let textStyle = item.lines?.[0]?.text?.[0]?.style || ""

        if (!newLines.length) {
            newLines = [{ align, text: [{ style: textStyle, value: "" }] }]
            caret = { line: 0, pos: 0 }
        } else {
            newLines.forEach((line, i) => {
                if (!line.text?.length) {
                    newLines[i].text = [{ style: textStyle, value: "" }]
                    caret = { line: i, pos: 0 }
                }
            })

            // set to last caret pos (if backspace)
            let sel = getSelectionRange()
            let currentLine = sel.findIndex((a) => a?.start !== undefined)
            let deleteKey = currentLine === lastCaretPos.line
            if (!caret && (item.lines || []).length > newLines.length) {
                if (deleteKey) {
                    caret = lastCaretPos
                } else {
                    let newLine = lastCaretPos.line > -1 ? lastCaretPos.line - 1 : newLines.length - 1
                    let newPos = lastCaretPos.pos > -1 ? getLineText(newLines[lastCaretPos.line - 1]).length - lastCaretPos.lineLength : getLineText(newLines[newLines.length - 1]).length
                    caret = { line: newLine, pos: newPos }
                }
            }
        }

        if (caret) {
            item.lines = newLines
            setTimeout(() => {
                getStyle()
                if (newLines.length < 1) return

                // set caret position back
                setTimeout(() => {
                    setCaret(textElem, caret)
                }, 10)
            }, 10)

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
        if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            navigator.clipboard.readText().then((clipText: string) => {
                paste(e, clipText)
            })
        }
    }

    // paste
    let pasting: boolean = false
    function paste(e: any, clipboardText: string = "") {
        let clipboard: string = clipboardText || e.clipboardData?.getData("text/plain") || ""
        if (!clipboard) return

        pasting = true

        let sel = getSelectionRange()
        let caret = { line: 0, pos: 0 }
        let emptySelection: boolean = !sel.filter((a) => Object.keys(a).length).length

        let lines: Line[] = getNewLines()
        let newLines: any[] = []
        let pastingIndex: number = -1
        sel.forEach((lineSel, lineIndex) => {
            if (lineSel.start === undefined && (!emptySelection || lineIndex < sel.length - 1)) {
                newLines.push(lines[lineIndex])
                return
            }

            if (pastingIndex < 0) {
                pastingIndex = lineIndex
                let splitted = clipboard.split("\n")
                let lastPastedLine = pastingIndex + (splitted.length - 1)
                let pos = lineSel.start + clipboard.length
                if (splitted.length > 1) pos = splitted[splitted.length - 1].trim().length
                caret = { line: lastPastedLine, pos }
            }

            let lineText: any[] = []
            let linePos = 0
            let pasteOverflow = 0
            // move multi line select to one line
            lines[lineIndex].text.forEach((text) => {
                let value = text.value
                let newLinePos = linePos + value.length
                if (newLinePos < lineSel.start || linePos > lineSel.end) {
                    lineText.push(text)
                    linePos = newLinePos
                    return
                }

                // selected more text (different styles) on one line
                if (pasteOverflow > 0) {
                    let newValue = value.slice(pasteOverflow)
                    pasteOverflow = pasteOverflow - value.length
                    if (!newValue.length) return

                    text.value = newValue
                    lineText.push(text)
                    return
                }

                let caretPos = lineSel.start - linePos
                let removeText = lineSel.end - lineSel.start
                removeText = removeText > 0 ? removeText : 0
                pasteOverflow = caretPos + removeText - value.length

                let newValue = value.slice(0, caretPos) + (pastingIndex === lineIndex ? clipboard : "") + value.slice(caretPos + removeText)
                if (!newValue.length) return

                text.value = newValue
                lineText.push(text)

                linePos = newLinePos
            })

            if (pastingIndex < 0) {
                newLines.push(lines[lineIndex])
                return
            }

            if (!newLines[pastingIndex]?.text) {
                newLines[pastingIndex] = clone(lines[lineIndex])
                newLines[pastingIndex].text = lineText
            } else {
                newLines[pastingIndex].text.push(...lineText)
            }
        })

        lines = newLines

        lines = EditboxHelper.splitAllCrlf(lines)
        updateLines(lines)
        setTimeout(() => {
            getStyle()
            // set caret position back
            setTimeout(() => {
                setCaret(textElem, caret)
                pasting = false
            }, 10)
        }, 10)
    }
</script>

<svelte:window on:keydown={keydown} />

{#if item?.lines}
    <!-- TODO: remove align..... -->
    <div bind:this={alignElem} class="align" class:chords={chordsMode} class:plain style={plain ? null : item.align || null}>
        {#if item.lines?.length < 2 && !item.lines?.[0]?.text?.[0]?.value?.length}
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
                on:mousemove={(e) => {
                    if (!textElem) return
                    let newLines = chordMove(e, { textElem, item })
                    if (newLines) item.lines = newLines
                }}
                on:mouseup={() => storeCurrentCaretPos()}
                class="edit"
                class:hidden={chordsMode}
                class:autoSize={item.auto && autoSize}
                contenteditable
                on:keydown={textElemKeydown}
                bind:innerHTML={html}
                style="{plain || !item.auto ? '' : `--auto-size: ${autoSize}px;`}{!plain && lineGap ? `gap: ${lineGap}px;` : ''}{plain ? '' : item.align ? item.align.replace('align-items', 'justify-content') : ''}"
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
        text-align: left;
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

    /* .edit.tallLines {
  line-height: 200px;
} */

    .plain .edit {
        font-size: 1.5em;
        justify-content: flex-start;
        text-align: left;
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
</style>
