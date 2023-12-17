<script lang="ts">
    import { onMount } from "svelte"
    import { uid } from "uid"
    import type { Item, Line } from "../../../types/Show"
    import { activeEdit, activePopup, activeShow, dictionary, os, outputs, overlays, redoHistory, refreshListBoxes, selected, showsCache, templates } from "../../stores"
    import { menuClick } from "../context/menuClick"
    import Cam from "../drawer/live/Cam.svelte"
    import Image from "../drawer/media/Image.svelte"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { clone } from "../helpers/array"
    import { deleteAction } from "../helpers/clipboard"
    import { history } from "../helpers/history"
    import { getExtension, getMediaType } from "../helpers/media"
    import { addToPos } from "../helpers/mover"
    import { _show } from "../helpers/shows"
    import { getStyles } from "../helpers/style"
    import Button from "../inputs/Button.svelte"
    import DynamicEvents from "../slide/views/DynamicEvents.svelte"
    import ListView from "../slide/views/ListView.svelte"
    import Mirror from "../slide/views/Mirror.svelte"
    import Timer from "../slide/views/Timer.svelte"
    import Variable from "../slide/views/Variable.svelte"
    import Visualizer from "../slide/views/Visualizer.svelte"
    import Website from "../slide/views/Website.svelte"
    import Clock from "../system/Clock.svelte"
    import Movebox from "../system/Movebox.svelte"
    import { getAutoSize, getMaxBoxTextSize } from "./scripts/autoSize"
    import { addChords, chordMove } from "./scripts/chords"
    import { getLineText, getSelectionRange, setCaret } from "./scripts/textStyle"

    export let item: Item
    export let filter: string = ""
    export let backdropFilter: string = ""
    export let ref: {
        type?: "show" | "overlay" | "template"
        showId?: string
        id: string
    }
    export let index: number
    export let editIndex: number = -1
    export let ratio: number = 1
    export let plain: boolean = false
    export let chordsMode: boolean = false

    let itemElem: any

    export let mouse: any = {}
    function mousedown(e: any) {
        if (e.target.closest(".chords") || e.target.closest(".editTools")) return
        let rightClick: boolean = e.buttons === 2 || ($os.platform === "darwin" && e.ctrlKey)

        activeEdit.update((ae) => {
            if (rightClick) {
                if (ae.items.includes(index)) return ae
                ae.items = [index]

                return ae
            }

            if (e.ctrlKey || e.metaKey) {
                if (ae.items.includes(index)) {
                    if (e.target.closest(".line")) ae.items.splice(ae.items.indexOf(index), 1)
                } else {
                    ae.items.push(index)
                }

                return ae
            }

            ae.items = [index]

            return ae
        })

        let target = e.target.closest(".item")
        if (!target) return

        mouse = {
            x: e.clientX,
            y: e.clientY,
            width: target.offsetWidth,
            height: target.offsetHeight,
            top: target.offsetTop,
            left: target.offsetLeft,
            offset: {
                x: (e.clientX - e.target.closest(".slide").offsetLeft) / ratio - target.offsetLeft,
                y: (e.clientY - e.target.closest(".slide").offsetTop) / ratio - target.offsetTop,
                width: e.clientX / ratio - target.offsetWidth,
                height: e.clientY / ratio - target.offsetHeight,
            },
            item,
            e: e,
        }
    }

    $: active = $activeShow?.id
    $: layout = active && $showsCache[active] ? $showsCache[active].settings.activeLayout : ""
    // $: slide = layout && $activeEdit.slide !== null && $activeEdit.slide !== undefined ? [$showsCache, GetLayoutRef(active, layout)[$activeEdit.slide].id][1] : null

    function cutInTwo({ e, sel, lines, currentIndex, textPos, start }) {
        let firstLines: Line[] = []
        let secondLines: Line[] = []

        lines.forEach((line, i) => {
            if (start > -1 && currentIndex >= start) secondLines.push({ align: line.align, text: [] })
            else firstLines.push({ align: line.align, text: [] })

            textPos = 0
            line.text?.forEach((text) => {
                currentIndex += text.value.length
                if (sel[i]?.start !== undefined) start = sel[i].start

                if (start > -1 && currentIndex >= start) {
                    if (!secondLines.length) secondLines.push({ align: line.align, text: [] })
                    let pos = sel[i].start - textPos
                    if (pos > 0)
                        firstLines[firstLines.length - 1].text.push({
                            style: text.style,
                            value: text.value.slice(0, pos),
                        })
                    secondLines[secondLines.length - 1].text.push({
                        style: text.style,
                        value: text.value.slice(pos, text.value.length),
                    })
                } else {
                    firstLines[firstLines.length - 1].text.push({
                        style: text.style,
                        value: text.value,
                    })
                }
                textPos += text.value.length
            })

            if (!firstLines.at(-1)?.text.length) firstLines.pop()
        })

        let defaultLine = [
            {
                align: lines[0].align || "",
                text: [{ style: lines[0].text[0]?.style || "", value: "" }],
            },
        ]
        if (!firstLines.length || !firstLines[0].text.length) firstLines = defaultLine
        if (!secondLines.length) secondLines = defaultLine

        if (typeof $activeEdit.slide === "number") editIndex = $activeEdit.slide
        let editItemIndex: number = $activeEdit.items[0] || Number(e?.target?.closest(".editItem")?.getAttribute("data-index")) || 0

        let slideRef: any = _show().layouts("active").ref()[0][editIndex]
        if (!slideRef) return

        // create new slide
        let newSlide = { ..._show().slides([ref.id]).get()[0] }
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

    function keydown(e: any) {
        // TODO: get working in list view
        if (e.key === "Enter" && (e.target.closest(".item") || e.target.closest(".quickEdit"))) {
            // incorrect editbox
            if (e.target.closest(".quickEdit") && Number(e.target.closest(".quickEdit").getAttribute("data-index")) !== editIndex) return

            // split
            let sel = getSelectionRange()
            if (!sel?.length || (sel.length === 1 && !Object.keys(sel[0]).length)) return

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

        if (e.key === "Escape") {
            ;(document.activeElement as HTMLElement).blur()
            window.getSelection()?.removeAllRanges()
            if ($activeEdit.items.length) {
                // give time so output don't clear
                setTimeout(() => {
                    activeEdit.update((a) => {
                        a.items = []
                        return a
                    })
                })
            }
        }

        if (!$activeEdit.items.includes(index) || document.activeElement?.closest(".item") || document.activeElement?.closest("input")) return

        if (e.key === "Backspace" || e.key === "Delete") {
            deleteAction({ id: "item", data: { layout, slideId: ref.id } })
        }
    }

    function deselect(e: any) {
        if (e.target.closest(".menus") || e.target.closest(".popup") || e.target.closest(".drawer") || e.target.closest(".chords") || e.target.closest(".contextMenu") || e.target.closest(".editTools")) return

        if (e.ctrlKey || e.metaKey || e.target.closest(".item") === itemElem || !$activeEdit.items.includes(index) || e.target.closest(".item")) return

        if (window.getSelection()) window.getSelection()?.removeAllRanges()

        activeEdit.update((ae) => {
            ae.items = []
            return ae
        })
    }

    let textElem: any
    let html: string = ""
    let previousHTML: string = ""
    let currentStyle: string = ""
    let firstTextStyleArchive: string = ""

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
            s += align + lineBg
            line.text?.forEach((a) => {
                s += getTextStyle(a)
            })
        })

        // dont replace while typing
        // && (window.getSelection() === null || window.getSelection()!.type === "None")
        if (currentStyle !== s) getStyle()
    }
    function getTextStyle(lineText) {
        let style = lineText.style || ""
        return style
    }

    $: lineGap = item?.specialStyle?.lineGap

    function getStyle() {
        if (!plain && $activeEdit.slide === null) return

        // TODO: empty lines
        // console.log(html)
        // console.log(item?.lines)

        html = ""
        currentStyle = ""
        let lineBg = item.specialStyle?.lineBg ? `background-color: ${item.specialStyle.lineBg};` : ""
        item?.lines?.forEach((line, i) => {
            let align = line.align.replaceAll(lineBg, "")
            currentStyle += align + lineBg
            let style = align || lineBg ? 'style="' + align + lineBg + '"' : ""
            html += `<div class="break" ${plain ? "" : style}>`

            // fix removing all text in a line
            if (i === 0 && line.text?.[0]?.style) firstTextStyleArchive = line.text?.[0]?.style || ""
            if (!line.text?.length) line.text = [{ style: firstTextStyleArchive || "", value: "" }]

            let currentChords = line.chords || []
            let textIndex = 0

            line.text?.forEach((a, tIndex) => {
                currentStyle += getTextStyle(a)

                // SAVE CHORDS (WIP does not work well with more "text" per line)
                let textEnd = textIndex + a.value.length
                let textChords = currentChords.filter((a) => a.pos >= textIndex && (a.pos <= textEnd || line.text.length - 1 >= tIndex))
                textIndex = textEnd

                let style = a.style ? 'style="' + a.style + '"' : ""

                html += `<span ${plain ? "" : style} data-chords='${JSON.stringify(textChords)}'>` + (a.value.replaceAll("\n", "<br>") || "<br>") + "</span>"
            })
            html += "</div>"
        })
        previousHTML = html
    }

    // let sel = getSelectionRange()

    $: if (textElem && html !== previousHTML) {
        previousHTML = html
        // let pos = getCaretCharacterOffsetWithin(textElem)
        setTimeout(updateLines, 10)
    }

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

            history({ id: "SHOW_ITEMS", newData: { key: "lines", data: clone([newLines]), slides: [ref.id], items: [index] }, location: { page: "none", override: ref.showId + ref.id + index } })

            // refresh list view boxes
            if (plain) refreshListBoxes.set(editIndex)
        }

        function setNewLines(a: any) {
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
        if (!textElem) return []

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

                newLines[pos].text.push({ style, value: child.innerText })
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

        if (updateHTML) {
            // get caret pos
            let sel = getSelectionRange()
            let lineIndex = sel.findIndex((a) => a?.start !== undefined)
            if (lineIndex >= 0) {
                let caret = { line: lineIndex || 0, pos: sel[lineIndex].start || 0 }

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
        }

        if (caret) {
            item.lines = newLines
            setTimeout(() => {
                getStyle()
                if (newLines.length > 1) {
                    // set caret position back
                    setTimeout(() => {
                        setCaret(textElem, caret)
                    }, 10)
                }
            }, 10)
        }

        return newLines
    }

    // bindings
    function removeBindings() {
        menuClick("bind_item")
    }

    // actions
    function removeAction(action) {
        // TODO: this is a duplicate of SetTime and other places
        let layoutRef: any[] = _show().layouts("active").ref()[0] || []
        let slideRef: any = layoutRef[$activeEdit.slide!] || {}
        let slideItems = _show().get("slides")?.[slideRef.id]?.items || []

        if ($activeEdit.id) getItems()
        function getItems() {
            let slide = {}
            if ($activeEdit.type === "overlay") slide = $overlays
            else if ($activeEdit.type === "template") slide = $templates

            slideItems = slide[$activeEdit.id!]?.items
        }

        if (!slideItems) return

        let actions = clone(slideItems[index].actions)
        delete actions[action]

        if ($activeEdit.type === "overlay" || $activeEdit.type === "template") {
            history({
                id: "UPDATE",
                oldData: { id: $activeEdit.id },
                newData: { key: "items", subkey: "actions", data: [actions], indexes: [index] },
                location: { page: "edit", id: $activeEdit.type + "_items", override: "deleteitemaction_" + index },
            })

            return
        }

        history({
            id: "setItems",
            newData: { style: { key: "actions", values: [actions] } },
            location: { page: "edit", show: $activeShow!, slide: slideRef.id, items: [index], override: "deleteitemaction_" + slideRef.id + "_items_" + index },
        })
    }

    // timer
    let today = new Date()
    setInterval(() => (today = new Date()), 1000)

    function textElemKeydown(e: any) {
        if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            navigator.clipboard.readText().then((clipText: string) => {
                paste(e, clipText)
            })
        }
    }

    // paste
    function paste(e: any, clipboardText: string = "") {
        let clipboard: string = clipboardText || e.clipboardData.getData("text/plain") || ""
        if (!clipboard) return

        let sel = getSelectionRange()
        let lines: Line[] = getNewLines()

        let emptySelection: boolean = !sel.filter((a) => Object.keys(a).length).length

        // get caret pos
        let caret = { line: 0, pos: 0 }
        sel.forEach((lineSel, i) => {
            if (lineSel.start !== undefined || (emptySelection && i >= sel.length - 1)) {
                let pos = 0
                let pasted = false
                lines[i].text.forEach(({ value }, j) => {
                    if (!pasted && (pos + value.length >= lineSel.start || (emptySelection && j >= lines[i].text.length - 1))) {
                        let caretPos = lineSel.start - pos
                        caret = { line: i, pos: lineSel.start + clipboard.length }
                        let removeText = lineSel.end - lineSel.start
                        removeText = removeText > 0 ? removeText : 0

                        lines[i].text[j].value = value.slice(0, caretPos) + clipboard + value.slice(caretPos + removeText, value.length)
                        pasted = true
                    }
                    pos += value.length
                })
            }
        })

        updateLines(lines)
        getStyle()
        // set caret position back
        setTimeout(() => {
            setCaret(textElem, caret)
        }, 10)
    }

    // let height: number = 0
    // let width: number = 0
    // $: autoSize = item.lines ? height / (item.lines.length + 3) : height / 2
    // $: autoSize = height < width ? height / 1.5 : width / 4
    // $: autoSize = Math.min(height, width) / 2
    // $: autoSize = getAutoSize(item)

    const actions = {
        transition: { label: "popup.transition", icon: "transition" },
        showTimer: { label: "actions.show_timer", icon: "time_in" },
        hideTimer: { label: "actions.hide_timer", icon: "time_out" },
    }

    // CHORDS

    let chordButtons: any[] = []
    function chordClick(e: any) {
        let add = e.target.closest(".add")
        if (add) {
            let pos = add.id.split("_")
            addChords(item, ref, index, Number(pos[0]), Number(pos[1]))
            return
        }

        let btn = e.target.closest(".button")
        if (!btn) return

        let data = chordButtons[btn.id]
        if (!data) return

        // for right click or rename click
        selected.set({ id: "chord", data: [{ chord: data.chord, index: data.lineIndex, slideId: ref.id, itemIndex: index }] })

        if (e.button !== 0) return
        // left click
        activePopup.set("rename")
    }

    let chordLines: string[] = []
    $: if (chordsMode && item.lines) createChordLines()
    function createChordLines() {
        chordLines = []
        chordButtons = []

        item.lines!.forEach((line, i) => {
            if (!line.text) return

            let chords = JSON.parse(JSON.stringify(line.chords || []))

            let html = ""
            let currentIndex = 0
            line.text.forEach((text) => {
                if (!text.value) {
                    html += "<br>"
                    return
                }

                let value = text.value.trim().replaceAll("\n", "") || ""

                let letters = value.split("")
                letters.forEach((letter) => {
                    let chordIndex = chords.findIndex((a: any) => a.pos === currentIndex)
                    if (chordIndex >= 0) {
                        let chord = chords[chordIndex]
                        chordButtons.push({ item, showRef: ref, itemIndex: index, chord, lineIndex: i })
                        let buttonIndex = chordButtons.length - 1
                        html += `<span id="${buttonIndex}" class="context #chord chord button">${chord.key}</span>`
                        chords.splice(chordIndex, 1)
                    }

                    let style = text.style
                    if (item.auto && autoSize) style += `font-size: ${autoSize}px;`
                    html += `<span id="${i}_${currentIndex}" class="invisible add" style="${style}">${letter}</span>`

                    currentIndex++
                })
            })

            if (!html) html += `<span class="invisible add"><br></span>`

            chords.forEach((chord: any, ci: number) => {
                chordButtons.push({ item, showRef: ref, itemIndex: index, chord, lineIndex: i })
                let buttonIndex = chordButtons.length - 1
                html += `<span id="${buttonIndex}" class="context #chord chord button" style="transform: translate(${60 * (ci + 1)}px, -80%);">${chord.key}</span>`
            })

            if (!html) return
            chordLines[i] = html
        })
    }
</script>

<!-- on:mouseup={() => chordUp({ showRef: ref, itemIndex: index, item })} -->
<svelte:window on:keydown={keydown} on:mousedown={deselect} />

<!-- bind:offsetHeight={height}
bind:offsetWidth={width} -->
<div
    bind:this={itemElem}
    class={plain ? "editItem" : "editItem item context #edit_box"}
    class:selected={$activeEdit.items.includes(index)}
    style={plain
        ? "width: 100%;"
        : `${item?.style}; outline: ${3 / ratio}px solid rgb(255 255 255 / 0.2);z-index: ${index + 1 + ($activeEdit.items.includes(index) ? 100 : 0)};${filter ? "filter: " + filter + ";" : ""}${
              backdropFilter ? "backdrop-filter: " + backdropFilter + ";" : ""
          }`}
    data-index={index}
    on:mousedown={mousedown}
>
    {#if !plain}
        <Movebox {ratio} active={$activeEdit.items.includes(index)} />

        <div class="actions">
            <!-- bindings -->
            {#if item.bindings?.length}
                <div title={$dictionary.actions?.remove_binding} class="actionButton" style="zoom: {1 / ratio};left: 0;right: unset;">
                    <Button on:click={removeBindings} redHover>
                        <Icon id="bind" white />
                    </Button>
                    {#if item.bindings.length > 1}
                        <span class="actionValue">{item.bindings.length}</span>
                    {:else}
                        <span class="actionValue">
                            {#if item.bindings[0] === "stage"}
                                <T id="menu.stage" />
                            {:else}
                                {$outputs[item.bindings[0]]?.name}
                            {/if}
                        </span>
                    {/if}
                </div>
            {/if}
            <!-- actions -->
            {#if item.actions}
                {#each Object.keys(item.actions) as action}
                    <div title={actions[action] ? $dictionary[actions[action].label.split(".")[0]]?.[actions[action].label.split(".")[1]] : ""} class="actionButton" style="zoom: {1 / ratio};left: 0;right: unset;">
                        <Button on:click={() => removeAction(action)} redHover>
                            <Icon id={actions[action]?.icon} white />
                        </Button>
                        {#if typeof item.actions[action] === "number"}
                            <span class="actionValue">{item.actions[action]}s</span>
                        {/if}
                    </div>
                {/each}
            {/if}
        </div>
    {/if}
    {#if item?.lines}
        <!-- TODO: remove align..... -->
        <div bind:this={alignElem} class="align" class:plain style={plain ? null : item.align || null}>
            {#if item.lines?.length < 2 && !item.lines?.[0]?.text?.[0]?.value?.length}
                <span class="placeholder">
                    <T id="empty.text" />
                </span>
            {/if}
            {#if chordsMode && textElem}
                <div class="edit chords" on:mousedown={chordClick}>
                    {#each item.lines as line, i}
                        <div class="break chordsBreak" style="{item?.specialStyle?.lineBg ? `background-color: ${item?.specialStyle?.lineBg};` : ''}{line.align || ''}">
                            {@html chordLines[i]}
                        </div>
                    {/each}
                </div>
            {/if}
            <div
                bind:this={textElem}
                on:mousemove={(e) => {
                    let newLines = chordMove(e, { textElem, item })
                    if (newLines) item.lines = newLines
                }}
                class="edit"
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
    {:else if item?.type === "list"}
        <ListView list={item.list} disableTransition />
    {:else if item?.type === "media"}
        {#if item.src}
            {#if getMediaType(getExtension(item.src)) === "video"}
                <!-- video -->
                <video src={item.src} style="width: 100%;height: 100%;object-fit: {item.fit || 'contain'};filter: {item.filter};transform: scale({item.flipped ? '-1' : '1'}, {item.flippedY ? '-1' : '1'});" muted={true} autoplay loop>
                    <track kind="captions" />
                </video>
            {:else}
                <Image src={item.src} alt="" style="width: 100%;height: 100%;object-fit: {item.fit || 'contain'};filter: {item.filter};transform: scale({item.flipped ? '-1' : '1'}, {item.flippedY ? '-1' : '1'});" />
                <!-- <MediaLoader path={item.src} /> -->
            {/if}
        {/if}
    {:else if item?.type === "camera"}
        {#if item.device}
            <Cam cam={item.device} item />
        {/if}
    {:else if item?.type === "timer"}
        <Timer {item} id={item.timerId || ""} {today} style={item.auto === false ? "" : `font-size: ${autoSize}px;`} edit />
    {:else if item?.type === "clock"}
        <Clock {autoSize} style={false} {...item.clock} />
    {:else if item?.type === "events"}
        <DynamicEvents {...item.events} edit textSize={Number(getStyles(item.style, true)?.["font-size"]) || 80} />
    {:else if item?.type === "variable"}
        <Variable {item} style={item?.style?.includes("font-size") && item.style.split("font-size:")[1].trim()[0] !== "0" ? "" : `font-size: ${autoSize}px;`} edit />
    {:else if item?.type === "web"}
        <Website src={item?.web?.src || ""} />
    {:else if item?.type === "mirror"}
        <Mirror {item} {ref} {ratio} index={$activeEdit.slide || 0} edit />
    {:else if item?.type === "visualizer"}
        <Visualizer {item} />
    {:else if item?.type === "icon"}
        {#if item.customSvg}
            <div class="customIcon">
                {@html item.customSvg}
            </div>
        {:else}
            <Icon style="zoom: {1 / ratio};" id={item.id || ""} fill white custom />
        {/if}
    {/if}
</div>

<style>
    .item {
        outline: 5px solid rgb(255 255 255 / 0.2);
        transition: background-color 0.3s;
        /* cursor: text; */
    }
    .item.selected .align {
        outline: 5px solid var(--secondary-opacity);
        overflow: visible;
    }
    .align span.placeholder {
        opacity: 0.5;
        pointer-events: none;
        position: absolute;
        width: 100%;
        overflow: hidden;
        padding-top: 0;
    }
    .item:hover {
        /* .item:hover > .edit { */
        background-color: rgb(255 255 255 / 0.05);
        backdrop-filter: blur(20px);
    }

    .edit:global(.invisible) {
        pointer-events: none;
        position: absolute;
        opacity: 0;
        overflow: hidden;
    }
    .edit:not(.invisible).autoSize :global(span) {
        font-size: var(--auto-size) !important;
    }

    .actions {
        position: absolute;
        top: 0;
        left: 0;

        display: flex;
        flex-direction: column;
    }
    .actionValue {
        font-size: small;
        opacity: 0.5;
        font-weight: bold;
        padding: 0 5px;
        text-shadow: none;
    }
    .actionButton {
        display: flex;
        align-items: center;
        background-color: var(--focus);
        color: var(--text);
    }
    .actionButton :global(button) {
        padding: 5px !important;
        z-index: 3;
    }
    .chords :global(.chord) {
        position: absolute;
        transform: translateY(-100%);
        background-color: var(--primary-darker);
        /* color: var(--text); */
        font-size: 0.8em;
        border: 5px solid var(--secondary);
        text-shadow: none;
        z-index: 3;

        pointer-events: all;
    }
    .chords :global(.chord):hover {
        filter: brightness(1.2);
    }
    .chords :global(.chord)::after {
        content: "";
        position: absolute;
        bottom: -5px;
        left: 50%;
        transform: translate(-50%, 100%);
        width: 5px;
        height: 50px;
        background-color: var(--secondary);
        /* background-color: var(--secondary-opacity); */
    }
    /* .chordsText {
    position: absolute;
    width: 100%;
    color: transparent !important;
    user-select: none;
  }
  .chordsText:first-child {
    width: 100%;
  } */

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

    /* chords */
    .edit.chords :global(.invisible) {
        opacity: 1;
        font-size: var(--font-size);
        line-height: 1.1em;
        background-color: rgb(255 255 255 / 0.1);
    }
    .edit.chords :global(.invisible):hover {
        opacity: 0.6;
        background-color: var(--secondary);
    }
    .edit.chords :global(.chord) {
        /* color: var(--chord-color);
        font-size: var(--chord-size) !important; */
        bottom: 0;
        transform: translate(-50%, -60%);
        z-index: 2;
        font-size: 60px !important;
        /* color: #FF851B; */

        line-height: initial;
        opacity: 0.9;
    }
    .edit.chords {
        /* line-height: 0.5em; */
        /* font-size: inherit; */
        position: absolute;
        /* pointer-events: none; */
    }

    .chordsBreak {
        position: relative;
        line-height: 0;
    }

    /* custom svg icon */

    .customIcon,
    .customIcon :global(svg) {
        width: 100%;
        height: 100%;
    }
</style>
