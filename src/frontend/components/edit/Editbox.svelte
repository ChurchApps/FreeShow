<script lang="ts">
    import { onMount } from "svelte"
    import { uid } from "uid"
    import type { Item, Line } from "../../../types/Show"
    import { activeEdit, activeShow, overlays, redoHistory, selected, showsCache, templates } from "../../stores"
    import Image from "../drawer/media/Image.svelte"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { clone } from "../helpers/array"
    import { deleteAction } from "../helpers/clipboard"
    import { history } from "../helpers/history"
    import { getExtension, getMediaType } from "../helpers/media"
    import { addToPos } from "../helpers/mover"
    import { _show } from "../helpers/shows"
    import Button from "../inputs/Button.svelte"
    import ListView from "../slide/views/ListView.svelte"
    import Mirror from "../slide/views/Mirror.svelte"
    import Timer from "../slide/views/Timer.svelte"
    import Clock from "../system/Clock.svelte"
    import Movebox from "../system/Movebox.svelte"
    import { getAutoSize } from "./scripts/autoSize"
    import { addChords, changeKey, chordDown, chordMove, chordUp, getChordPosition } from "./scripts/chords"
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
        if (e.target.closest(".chords")) return

        activeEdit.update((ae) => {
            if (e.ctrlKey || e.metaKey) {
                if (ae.items.includes(index)) {
                    if (e.target.closest(".line")) ae.items.splice(ae.items.indexOf(index), 1)
                } else ae.items.push(index)
            } else ae.items = [index]
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

    function keydown(e: any) {
        // TODO: get working in list view
        if (e.key === "Enter" && e.altKey && (e.target.closest(".item") || e.target.closest(".quickEdit"))) {
            // incorrect editbox
            if (e.target.closest(".quickEdit") && Number(e.target.closest(".quickEdit").getAttribute("data-index")) !== editIndex) return

            // split
            let sel = getSelectionRange()
            if (!sel?.length || (sel.length === 1 && !Object.keys(sel[0]).length)) return

            // if (sel.start === sel.end) {
            let lines: Line[] = getNewLines()
            let firstLines: Line[] = []
            let secondLines: Line[] = []
            let currentIndex = 0,
                textPos = 0
            let start = -1

            lines.forEach((line, i) => {
                if (start > -1 && currentIndex >= start) secondLines.push({ align: line.align, text: [] })
                else firstLines.push({ align: line.align, text: [] })

                textPos = 0
                line.text.forEach((text) => {
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
            let editItemIndex: number = $activeEdit.items[0] || Number(e.target.closest(".editItem").getAttribute("data-index")) || 0

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

            if (e.target.closest(".item")) activeEdit.set({ slide: $activeEdit.slide! + 1, items: [] })
            else getStyle()
        }

        if (e.key === "Escape") {
            ;(document.activeElement as HTMLElement).blur()
            window.getSelection()?.removeAllRanges()
            if ($activeEdit.items.length) {
                activeEdit.update((a) => {
                    a.items = []
                    return a
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

    onMount(getStyle)

    // update rearrange items
    // TODO: (minor issue) text seemingly swapping places when rearranging items
    // let updateItem: boolean = false
    // $: if (item) checkItemUpdate()
    // function checkItemUpdate() {
    //     if (updateItem) {
    //         updateItem = false
    //         return
    //     }

    //     // update item
    //     getStyle()
    // }

    let currentSlide: number = -1
    $: if ($activeEdit.slide !== null && $activeEdit.slide !== undefined && $activeEdit.slide !== currentSlide) {
        currentSlide = $activeEdit.slide
        setTimeout(getStyle, 10)
    }

    // // update text if slide added/removed (for quick edit)
    // let slideLength = 0
    // $: if (_show().get().slides.length > slideLength) {
    //   slideLength = _show().get().slides.length
    //   setTimeout(getStyle, 10)
    // }

    $: {
        // console.log("ITEM", clone(item))

        // style hash
        let s = ""
        item?.lines?.forEach((line) => {
            s += line.align
            line.text?.forEach((a) => {
                // + (item.auto ? autoSize : "")
                s += a.style
            })
        })

        // dont replace while typing
        // && (window.getSelection() === null || window.getSelection()!.type === "None")
        if (currentStyle !== s) getStyle()
    }

    function getStyle() {
        if (!plain && $activeEdit.slide === null) return

        // TODO: empty lines
        // console.log(html)
        // console.log(item?.lines)

        html = ""
        currentStyle = ""
        item?.lines?.forEach((line) => {
            currentStyle += line.align
            let style = line.align ? 'style="' + line.align + '"' : ""
            html += `<div class="break" ${plain ? "" : style}>`
            line.text?.forEach((a) => {
                // + (item.auto ? autoSize : "")
                currentStyle += a.style

                let auto: string = item.auto ? "font-size: " + autoSize + "px;" : ""
                let style = a.style ? 'style="' + a.style + auto + '"' : ""

                html += `<span ${plain ? "" : style}>` + a.value + "</span>"
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
        }

        function setNewLines(a: any) {
            a[$activeEdit.id!].items[index].lines = newLines
            return a
        }
    }

    let previousLinesCount = 100
    function getNewLines() {
        let newLines: Line[] = []
        let pos: number = -1
        currentStyle = ""
        let updateHTML: boolean = false

        new Array(...textElem.children).forEach((line: any, i: number) => {
            let align: string = plain ? item.lines![i]?.align || "" : line.getAttribute("style") || ""
            pos++
            currentStyle += align

            let newLine: any = { align, text: [] }
            let chords = item.lines?.[i]?.chords
            if (chords) newLine.chords = chords
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
                newLines[pos].text.push({ style, value: child.innerText })
                currentStyle += style
            })
        })

        let linesLength = new Array(...textElem.children).filter((a) => a.innerText).length
        if (updateHTML || (plain && linesLength < previousLinesCount)) {
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
        previousLinesCount = linesLength

        return newLines
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
    $: autoSize = getAutoSize(item)
</script>

<svelte:window on:keydown={keydown} on:mousedown={deselect} on:mouseup={() => chordUp({ showRef: ref, itemIndex: index, item })} />

<!-- bind:offsetHeight={height}
bind:offsetWidth={width} -->
<div
    bind:this={itemElem}
    class={plain ? "editItem" : "editItem item context #edit_box"}
    class:selected={$activeEdit.items.includes(index)}
    style={plain ? "width: 100%;" : `${item?.style}; outline: ${3 / ratio}px solid rgb(255 255 255 / 0.2);z-index: ${index + 1};${filter ? "filter: " + filter + ";" : ""}${backdropFilter ? "backdrop-filter: " + backdropFilter + ";" : ""}`}
    data-index={index}
    on:mousedown={mousedown}
>
    {#if !plain}
        <Movebox {ratio} active={$activeEdit.items.includes(index)} />
    {/if}
    {#if item?.lines}
        <!-- chords -->
        <div
            class="chordsButton"
            style="zoom: {1 / ratio};"
            on:mousedown={() => {
                selected.set({
                    id: "chord",
                    data: [{ slideId: ref.id, itemIndex: index }],
                })
            }}
        >
            {#if chordsMode}
                <Button class="context #chord" on:click={() => addChords(item, ref, index)}>
                    <Icon id="add" white />
                </Button>
            {/if}
        </div>

        <!-- <div
      class="chordsText align"
      class:plain
      style={plain ? null : item.align || null}
    >
      <div
        style={plain
          ? null
          : item.align
          ? item.align.replace("align-items", "justify-content")
          : null}
        class:height={item.lines?.length < 2 &&
          !item.lines?.[0]?.text[0]?.value.length}
      >
        {@html html}
      </div>
    </div> -->

        <!-- TODO: remove align..... -->
        <div class="align" class:plain style={plain ? null : item.align || null}>
            {#if item.lines?.length < 2 && !item.lines?.[0]?.text?.[0]?.value?.length}
                <span class="placeholder">
                    <T id="empty.text" />
                </span>
            {/if}
            {#if chordsMode && textElem}
                <div class="chords">
                    {#each item.lines as line, i}
                        {#if line.chords}
                            {#each line.chords as chord}
                                {#await getChordPosition(chord, { textElem, item, line: i }) then pos}
                                    <div class="context #chord chord" style={pos} on:mousedown={() => chordDown({ chord, index: i }, { showRef: ref, itemIndex: index })}>
                                        <Button style="padding: 0 15px;" on:click={() => changeKey({ item, showRef: ref, itemIndex: index, chord, lineIndex: i })}>
                                            {chord.key}
                                        </Button>
                                    </div>
                                {/await}
                            {/each}
                        {/if}
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
                contenteditable
                on:keydown={textElemKeydown}
                bind:innerHTML={html}
                style={plain ? null : item.align ? item.align.replace("align-items", "justify-content") : null}
                class:height={item.lines?.length < 2 && !item.lines?.[0]?.text[0]?.value.length}
                class:tallLines={chordsMode}
            />
            <!-- on:paste did not work on mac -->
            <!-- on:paste|preventDefault={paste} -->
        </div>
    {:else if item?.type === "list"}
        <ListView list={item.list} disableTransition />
    {:else if item?.type === "media"}
        {#if item.src}
            {#if getMediaType(getExtension(item.src)) === "video"}
                <!-- video -->
                <video src={item.src} muted={true} loop>
                    <track kind="captions" />
                </video>
            {:else}
                <Image src={item.src} alt="" style="width: 100%;height: 100%;object-fit: {item.fit || 'contain'};filter: {item.filter};{item.flipped ? 'transform: scaleX(-1);' : ''}" />
                <!-- <MediaLoader path={item.src} /> -->
            {/if}
        {/if}
    {:else if item?.type === "timer"}
        <Timer {item} id={item.timerId || ""} {today} style="font-size: {autoSize}px;" />
    {:else if item?.type === "clock"}
        <Clock {autoSize} style={false} {...item.clock} />
    {:else if item?.type === "mirror"}
        <Mirror {item} {ref} {ratio} index={$activeEdit.slide || 0} edit />
    {:else if item?.type === "icon"}
        <Icon style="zoom: {1 / ratio};" id={item.id || ""} fill white custom />
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
    .item .placeholder {
        opacity: 0.5;
        pointer-events: none;
        position: absolute;
        width: 100%;
    }
    .item:hover {
        /* .item:hover > .edit { */
        background-color: rgb(255 255 255 / 0.05);
        backdrop-filter: blur(20px);
    }

    .chordsButton {
        position: absolute;
        top: 0;
        right: 0;
        background-color: var(--focus);
    }
    .chordsButton :global(button) {
        padding: 10px !important;
        z-index: 3;
    }
    .chords {
        position: absolute;
        top: 0;
        left: 0;
    }
    .chords :global(.chord) {
        position: absolute;
        transform: translateY(-100%);
        background-color: var(--primary-darker);
        /* color: var(--text); */
        font-size: 0.8em;
        border: 10px solid var(--secondary);
        z-index: 3;
    }
    .chords .chord:hover {
        filter: brightness(1.2);
    }
    .chords .chord::after {
        content: "";
        position: absolute;
        bottom: -5px;
        left: 50%;
        transform: translate(-50%, 100%);
        width: 10px;
        height: 100px;
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
</style>
