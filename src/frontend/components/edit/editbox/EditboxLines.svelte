<script lang="ts">
    import type { Item, Line } from "../../../../types/Show"
    import { activeEdit, overlays, redoHistory, refreshListBoxes, showsCache, templates } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { _show } from "../../helpers/shows"
    import { getAutoSize, getMaxBoxTextSize } from "../scripts/autoSize"
    import { chordMove } from "../scripts/chords"
    import { getLineText, getSelectionRange, setCaret } from "../scripts/textStyle"
    import { EditboxHelper } from "./EditboxHelper"

    import { onMount } from "svelte"
    import { uid } from "uid"
    import { addToPos } from "../../helpers/mover"
    import EditboxChords from "./EditboxChords.svelte"

    export let item: Item
    export let ref: {
        type?: "show" | "overlay" | "template"
        showId?: string
        id: string
    }
    export let index: number
    export let editIndex: number = -1
    export let plain: boolean = false
    export let chordsMode: boolean = false

    let textElem: any
    let html: string = ""
    let previousHTML: string = ""
    let currentStyle: string = ""

    onMount(() => {
        getStyle()

        setTimeout(() => {
            loaded = true
            autoSize = item?.autoFontSize || 0
            if (autoSize) return

            if (isTextbox) getCustomAutoSize()
            else autoSize = getAutoSize(item)
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
        item?.lines?.forEach((line) => {
            let align = line.align.replaceAll(lineBg, "")
            if (align && !align.endsWith(";")) align += ";"
            s += align + lineBg
            line.text?.forEach((a) => {
                s += EditboxHelper.getTextStyle(a)
            })
        })

        // dont replace while typing
        // && (window.getSelection() === null || window.getSelection()!.type === "None")
        console.log(currentStyle !== s, currentStyle, s)
        if (currentStyle !== s) getStyle()
    }

    $: lineGap = item?.specialStyle?.lineGap

    function getStyle() {
        if (!plain && $activeEdit.slide === null) return
        let result = EditboxHelper.getSyleHtml(item, plain, currentStyle)
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

    function keydown(e: any) {
        // TODO: get working in list view
        if (e.key === "Enter" && (e.target.closest(".item") || e.target.closest(".quickEdit"))) {
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

    function cutInTwo({ e, sel, lines, currentIndex, textPos, start }) {
        let { firstLines, secondLines } = EditboxHelper.cutLinesInTwo({ sel, lines, currentIndex, textPos, start })

        if (typeof $activeEdit.slide === "number") editIndex = $activeEdit.slide
        let editItemIndex: number = $activeEdit.items[0] ?? Number(e?.target?.closest(".editItem")?.getAttribute("data-index")) ?? 0

        let slideRef: any = _show().layouts("active").ref()[0][editIndex]
        if (!slideRef) return

        // create new slide
        let newSlide = clone(_show().slides([ref.id]).get()[0]) || {}
        if (!newSlide.items[editItemIndex]) return
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
        let parentId = slideRef.type === "child" ? slideRef.parent.id : slideRef.id
        let children = _show().slides([parentId]).get("children")[0] || []
        let slideIndex = slideRef.type === "child" ? slideRef.index + 1 : 0
        children = addToPos(children, [id], slideIndex)
        _show().slides([parentId]).set({ key: "children", value: children })

        if (e?.target?.closest(".item")) activeEdit.set({ slide: $activeEdit.slide! + 1, items: [] })
        else getStyle()
    }

    let HISTORY_UPDATE_KEY = 0
    let updates: number = 0
    function updateLines(newLines: Line[]) {
        // updateItem = true
        if (!newLines) newLines = getNewLines()

        if ($activeEdit.type === "overlay") overlays.update(setNewLines)
        else if ($activeEdit.type === "template") templates.update(setNewLines)
        else if (ref.id) {
            // dont override history when undoing
            let lastRedo = $redoHistory[$redoHistory.length - 1]
            if (lastRedo?.id === "SHOW_ITEMS") {
                let previousData = lastRedo.oldData.previousData

                let historyText = previousData[index]?.lines.reduce((text, line) => (text += getLineText(line)), "")
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
    $: if (html && textElem?.innerText !== previousText) checkText()
    function checkText() {
        textChanged = true
        previousText = textElem?.innerText
        setTimeout(() => (textChanged = false))
    }

    // typing
    let isTyping: boolean = false
    $: if (isAuto && textChanged) checkTyping()
    let typingTimeout: any = null
    function checkTyping() {
        if (!loaded) return
        isTyping = true

        if (typingTimeout) clearTimeout(typingTimeout)
        typingTimeout = setTimeout(() => {
            isTyping = false
            if (isTextbox && isAuto) getCustomAutoSize()
        }, 1000)
    }

    // update auto size
    let loaded = false
    $: isTextbox = !!item?.lines
    $: isAuto = item?.auto
    $: if (isTextbox && (isAuto || textChanged)) getCustomAutoSize()
    $: if (!isTextbox && item) autoSize = getAutoSize(item)

    let autoSize: number = 0
    let alignElem: any
    let loopStop = false
    function getCustomAutoSize() {
        if (isTyping || loopStop || !loaded || !textElem || !alignElem || !item.auto) return
        loopStop = true

        autoSize = getMaxBoxTextSize(textElem, alignElem)

        // update item with new style
        if (ref.type === "overlay") {
            overlays.update((a) => {
                a[ref.id].items[index].autoFontSize = autoSize
                return a
            })
        } else if (ref.type === "template") {
            templates.update((a) => {
                a[ref.id].items[index].autoFontSize = autoSize
                return a
            })
        } else if (ref.showId) {
            showsCache.update((a) => {
                if (!a[ref.showId!]?.slides?.[ref.id]?.items?.[index]) return a

                a[ref.showId!].slides[ref.id].items[index].autoFontSize = autoSize
                return a
            })
        }

        setTimeout(() => {
            loopStop = false
        }, 500)
    }

    // UPDATE STYLE FROM LINES

    function getNewLines() {
        if (!textElem || !item) return []

        let newLines: Line[] = []
        let pos: number = -1
        currentStyle = ""
        let updateHTML: boolean = false

        new Array(...textElem.children).forEach((line: any, i: number) => {
            let align: string = plain ? item.lines![i]?.align || "" : line.getAttribute("style") || ""
            pos++
            currentStyle += align

            let newLine: any = { align, text: [] }
            let lineChords: any[] = []

            newLines.push(newLine)

            new Array(...line.childNodes).forEach((child: any, j: number) => {
                if (child.nodeName === "#text") {
                    // add "floating" text to previous node (e.g. pressing backspace at the start of a line)
                    let lastNode = newLines[pos].text.length - 1
                    if (lastNode < 0 || !newLines[pos].text[lastNode]) return
                    newLines[pos].text[lastNode].value += child.textContent

                    updateHTML = true
                    return
                }
                if (child.nodeName !== "SPAN") return

                let style = plain ? item.lines![i]?.text[j]?.style || "" : child.getAttribute("style") || ""
                // TODO: pressing enter / backspace will remove any following style in list view
                // if (plain && !style && i > 0) style = item.lines![i - 1]?.text[j]?.style

                let lineText = child.innerText
                // empty line
                if (lineText === "\n") lineText = ""
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
            if (!caret && (item.lines || []).length > newLines.length && !deleteKey) {
                let newLine = lastCaretPos.line > -1 ? lastCaretPos.line - 1 : newLines.length - 1
                let newPos = lastCaretPos.pos > -1 ? getLineText(newLines[lastCaretPos.line - 1]).length - lastCaretPos.lineLength : getLineText(newLines[newLines.length - 1]).length
                caret = { line: newLine, pos: newPos }
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
        new Array(...lineElem.childNodes).forEach((child: any) => {
            if (child.nodeName === "#text") text += child.textContent
            else text += child.innerText
        })

        return text.trim()
    }

    function textElemKeydown(e: any) {
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
                let lastPastedLine = pastingIndex + (clipboard.split("\n").length - 1)
                caret = { line: lastPastedLine, pos: lineSel.start + clipboard.length }
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

    // let height: number = 0
    // let width: number = 0
    // $: autoSize = item.lines ? height / (item.lines.length + 3) : height / 2
    // $: autoSize = height < width ? height / 1.5 : width / 4
    // $: autoSize = Math.min(height, width) / 2
    // $: autoSize = getAutoSize(item)
</script>

<svelte:window on:keydown={keydown} />

{#if item?.lines}
    <!-- TODO: remove align..... -->
    <div bind:this={alignElem} class="align" class:plain style={plain ? null : item.align || null}>
        {#if item.lines?.length < 2 && !item.lines?.[0]?.text?.[0]?.value?.length}
            <span class="placeholder">
                <T id="empty.text" />
            </span>
        {/if}
        {#if chordsMode && textElem}
            <EditboxChords {item} {autoSize} {index} {ref} {chordsMode} />
        {/if}
        <div
            bind:this={textElem}
            on:mousemove={(e) => {
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

    .edit:not(.plain .edit) :global(span) {
        font-size: 100px;
        /* min-height: 100px;
  min-width: 100px;
  display: inline-table; */
    }
</style>
