<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import { activeDropId, popupData, selected, storedChordsData } from "../../../stores"
    import { waitForPopupData } from "../../../utils/popup"
    import { clone } from "../../helpers/array"
    import { deleteAction } from "../../helpers/clipboard"
    import { history } from "../../helpers/history"
    import { addChords } from "./../scripts/chords"

    export let item: Item
    export let autoSize: number
    export let index: number
    export let ref: {
        type?: "show" | "overlay" | "template" | "stage"
        showId?: string
        id: string
    }
    export let chordsMode = false
    export let chordsAction = ""

    // CHORDS

    let chordButtons: { item: Item; showRef: any; itemIndex: number; chord: any; lineIndex: number }[] = []
    async function chordClick(e: any) {
        let add = e.target.closest(".add")
        if (add) {
            // only left click
            if (e.button !== 0) return
            if (e.ctrlKey || e.metaKey) storedChordsData.set({ romanKeysActive: !!$storedChordsData.romanKeysActive })

            let pos = add.id.split("_")
            let key = chordsAction
            if (!key) key = await waitForPopupData("choose_chord")
            if (!key) return

            addChords(item, ref, index, Number(pos[0]), Number(pos[1]), key)
            popupData.set({}) // reset for next use
            return
        }

        let btn = e.target.closest(".button")
        if (!btn) return

        let data = chordButtons[btn.id]
        if (!data) return

        // for right click or rename click
        selected.set({ id: "chord", data: [{ chord: data.chord, index: data.lineIndex, slideId: ref.id, itemIndex: index }] })

        // delete on middle mouse click
        if (e.button === 1) {
            deleteAction($selected)
            return
        }

        // rename on click (not used anymore as we have drag and drop)
        // if (e.button !== 0) return
        // // left click
        // activePopup.set("rename")
    }

    let chordLines: string[] = []
    $: if (chordsMode && (item?.lines || (item?.auto && autoSize))) createChordLines()
    function createChordLines() {
        chordLines = []
        chordButtons = []

        item.lines!.forEach((line, i) => {
            if (!line.text) return

            let chords = clone(line.chords || [])

            let html = ""
            let currentIndex = 0
            line.text.forEach((text) => {
                if (!text.value) {
                    html += "<br>"
                    return
                }

                let value = text.value.replaceAll("\n", "").replaceAll("&nbsp;", " ") || ""

                let letters = value.split("")
                letters.forEach((letter) => {
                    let chordIndex = chords.findIndex((a) => a.pos === currentIndex)
                    if (chordIndex >= 0) {
                        let chord = chords[chordIndex]
                        chordButtons.push({ item, showRef: ref, itemIndex: index, chord, lineIndex: i })
                        let buttonIndex = chordButtons.length - 1
                        html += `<span id="${buttonIndex}" draggable="true" class="context #chord chord button">${chord.key}</span>`
                        chords.splice(chordIndex, 1)
                    }

                    let style = text.style
                    if (item.auto && autoSize) style += `font-size: ${autoSize}px;`

                    // in some cases spaces will get width 0 and change text layout if at line breaks (this is not an issue)
                    html += `<span id="${i}_${currentIndex}" class="invisible add" style="${style}">${letter}</span>`

                    currentIndex++
                })
            })

            if (!html) html += `<span class="invisible add"><br></span>`

            chords.forEach((chord, ci) => {
                chordButtons.push({ item, showRef: ref, itemIndex: index, chord, lineIndex: i })
                let buttonIndex = chordButtons.length - 1
                html += `<span id="${buttonIndex}" draggable="true" class="context #chord chord button" style="transform: translate(${60 * (ci + 1)}px, -80%);">${chord.key}</span>`
            })

            if (!html) return
            chordLines[i] = html
        })
    }

    $: lineRadius = item?.specialStyle?.lineRadius || 0
    $: lineBg = item?.specialStyle?.lineBg
    $: lineStyle = (lineRadius ? `border-radius: ${lineRadius}px;` : "") + (lineBg ? `background: ${lineBg};` : "")

    // DRAG AND DROP

    let dragSourceIndex: number | null = null
    let lastDropTarget: HTMLElement | null = null
    function findAddTarget(el: any) {
        if (!el) return null
        const add = el.closest && el.closest(".add")
        return add
    }

    function handleDragStart(e: DragEvent) {
        const target = (e.target as HTMLElement)?.closest && ((e.target as HTMLElement).closest(".chord") as HTMLElement)
        if (!target) return
        const id = target.id
        if (!id) return
        dragSourceIndex = Number(id)
        try {
            e.dataTransfer?.setData("text/plain", id)
            e.dataTransfer!.effectAllowed = "move"
        } catch (err) {}
    }
    function handleDragOver(e: DragEvent) {
        const add = findAddTarget(e.target)
        if (!add) return
        e.preventDefault()
        // only update when target changed
        if (lastDropTarget && lastDropTarget !== add) lastDropTarget.classList.remove("drop-target")
        if (lastDropTarget !== (add as HTMLElement)) {
            ;(add as HTMLElement).classList.add("drop-target")
            lastDropTarget = add as HTMLElement
            activeDropId.set((add as HTMLElement).id || "")
        }
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
    }
    function handleDragLeave(e: DragEvent) {
        const add = findAddTarget(e.target)
        if (add && lastDropTarget === add) {
            lastDropTarget?.classList.remove("drop-target")
            lastDropTarget = null
            activeDropId.set("")
        }
    }
    function handleDragEnd(_e: DragEvent) {
        dragSourceIndex = null
        if (lastDropTarget) {
            lastDropTarget.classList.remove("drop-target")
            lastDropTarget = null
        }
        activeDropId.set("")
    }
    function handleDrop(e: DragEvent) {
        e.preventDefault()
        const add = findAddTarget(e.target)
        if (!add) return
        const id = (add as HTMLElement).id
        const parts = id.split("_")
        const toLine = Number(parts[0])
        const toPos = Number(parts[1])

        let sourceIdStr = ""
        try {
            sourceIdStr = e.dataTransfer?.getData("text/plain") || ""
        } catch (err) {}
        const sourceIndex = sourceIdStr ? Number(sourceIdStr) : dragSourceIndex
        if (sourceIndex == null || isNaN(sourceIndex)) return

        moveChord(sourceIndex, toLine, toPos)

        // cleanup
        if (lastDropTarget) {
            lastDropTarget.classList.remove("drop-target")
            lastDropTarget = null
        }
        activeDropId.set("")
        dragSourceIndex = null
    }

    function moveChord(buttonIndex: number, toLine: number, toPos: number) {
        const data = chordButtons[buttonIndex]
        if (!data) return
        const chord = data.chord
        const fromLine = data.lineIndex

        // remove from source
        const fromChords = item.lines![fromLine].chords || []
        const idx = fromChords.findIndex((c: any) => c.pos === chord.pos && c.key === chord.key)
        if (idx >= 0) fromChords.splice(idx, 1)

        // set new pos and insert into destination
        chord.pos = toPos
        if (!item.lines![toLine].chords) item.lines![toLine].chords = []
        item.lines![toLine].chords.push(chord)

        // keep chords sorted by pos
        item.lines![toLine].chords.sort((a: any, b: any) => (a.pos || 0) - (b.pos || 0))

        // refresh generated html
        createChordLines()
        // persist change via history so it's saved to shows/showsCache
        try {
            history({ id: "SHOW_ITEMS", newData: { key: "lines", data: clone([item.lines]), slides: [ref.id], items: [index], showId: ref.showId } })
        } catch (err) {}
    }
</script>

{#if item?.lines}
    <div class="edit chords" on:mousedown={chordClick} on:dragstart={handleDragStart} on:dragover={handleDragOver} on:dragleave={handleDragLeave} on:drop={handleDrop} on:dragend={handleDragEnd}>
        {#each item.lines as line, i}
            <div class="break chordsBreak" style="{lineStyle}{line.align || ''}">
                {@html chordLines[i]}
            </div>
        {/each}
    </div>
{/if}

<style>
    .chords,
    .break {
        width: 100%;
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

        --move-up: 40%;
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
        /* this height works best as 100px font size */
        height: calc(100% + var(--move-up) - 5px);
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

    /* chords */
    .edit.chords :global(.invisible) {
        opacity: 1;
        font-size: var(--font-size);
        line-height: 1.1em;
        background-color: rgb(255 255 255 / 0.1);
    }
    .edit.chords :global(.invisible):hover {
        /* opacity: 0.8; */
        background-color: var(--secondary-opacity);
    }
    .edit.chords :global(.chord) {
        /* color: var(--chord-color);
      font-size: var(--chord-size) !important; */
        /* bottom: 0; */
        transform: translate(-50%, calc(var(--move-up) * -1));
        z-index: 2;
        font-size: 45px !important;
        /* color: #FF851B; */

        line-height: initial;
        opacity: 0.9;
    }
    .edit.chords {
        /* line-height: 0.5em; */
        /* font-size: inherit; */
        position: absolute;
        z-index: 3; /* show over line box */
        /* pointer-events: none; */
    }

    .chordsBreak {
        position: relative;
        line-height: 0;

        /* fix letter spacing */
        /* letter-spacing: 0.3px; */ /* can't be lower */
        /* font-kerning: none; */
    }

    .chordsBreak :global(.drop-target) {
        background-color: rgba(255, 255, 255, 0.15) !important;
        outline: 2px dashed var(--secondary);
    }
</style>
