<script lang="ts">
    import { onDestroy, onMount, tick } from "svelte"
    import type { Item, Show } from "../../../types/Show"
    import { textEditZoom } from "../../stores"
    import { newToast } from "../../utils/common"
    import { translateText } from "../../utils/language"
    import { keys as chordKeyOptions } from "../edit/values/chords"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { getGroupName, getLayoutRef } from "../helpers/show"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import { addChordAt, applyChordsToEmptySlides, deleteChord, getShowChordKeys, getShowKey, importChordSheet, moveChord, transposeShow, transposeShowToKey, updateChordKey, type ChordLoc } from "./chordEdit"
    import { getTextboxesIndexes } from "./formatTextEditor"

    export let showId: string
    export let currentShow: Show | undefined

    $: hasLockedSlide = Object.values(currentShow?.slides || {}).some((a) => a?.locked)
    $: isLocked = !!(currentShow?.locked || hasLockedSlide)

    let ref: any[] = []
    $: if (showId && currentShow) ref = getLayoutRef(showId)

    interface RenderChord {
        id: string
        pos: number
        key: string
    }
    interface RenderLine {
        lineIndex: number
        text: string
        chords: RenderChord[]
    }
    interface RenderBox {
        itemIndex: number
        lines: RenderLine[]
    }
    interface RenderSection {
        key: string
        slideId: string
        label: string | null
        color: string
        multiple: boolean
        boxes: RenderBox[]
        chordItemIndex: number
    }

    let sections: RenderSection[] = []
    $: sections = currentShow ? buildSections(currentShow, ref) : []

    function buildSections(show: Show, layoutRef: any[]): RenderSection[] {
        const result: RenderSection[] = []
        layoutRef.forEach((r, i) => {
            const slide = show.slides?.[r.id]
            if (!slide?.items) return
            const indexes = getTextboxesIndexes(slide.items)
            if (!indexes.length) return

            const boxes: RenderBox[] = []
            let chordItemIndex = -1
            indexes.forEach((itemIndex) => {
                const item: Item = slide.items[itemIndex]
                const lines: RenderLine[] = (item.lines || []).map((line, lineIndex) => ({
                    lineIndex,
                    text: (line.text || []).map((t) => t.value || "").join(""),
                    chords: (line.chords || []).slice().sort((a, b) => a.pos - b.pos)
                }))
                if (chordItemIndex === -1 && lines.some((l) => l.chords.length)) chordItemIndex = itemIndex
                boxes.push({ itemIndex, lines })
            })

            const label = getGroupName({ show, showId }, r.id, slide.group ?? null, r.layoutIndex ?? i)
            result.push({
                key: `${r.id}_${i}`,
                slideId: r.id,
                label: label || null,
                color: slide.color || "",
                multiple: boxes.length > 1,
                boxes,
                chordItemIndex
            })
        })
        return result
    }

    // KEY DETECTION + USED CHORDS
    $: usedChords = currentShow ? [...new Set(getShowChordKeys(showId))].sort((a, b) => a.localeCompare(b)) : []
    $: detectedKey = currentShow ? getShowKey(showId) : ""
    $: hasChords = usedChords.length > 0

    // MEASUREMENT — chords are positioned by measuring the real (proportional) font
    let rulerElem: HTMLElement | undefined
    function measureWidth(text: string): number {
        if (!rulerElem || !text) return 0
        rulerElem.textContent = text
        return rulerElem.getBoundingClientRect().width
    }

    // chord.id -> left offset in px
    let chordLefts: Record<string, number> = {}
    function measureAll() {
        if (!rulerElem) return
        const map: Record<string, number> = {}
        sections.forEach((s) => s.boxes.forEach((b) => b.lines.forEach((l) => l.chords.forEach((c) => (map[c.id] = measureWidth(l.text.slice(0, c.pos)))))))
        chordLefts = map
    }
    $: if (sections || $textEditZoom) scheduleMeasure()
    let measurePending = false
    function scheduleMeasure() {
        if (measurePending) return
        measurePending = true
        void tick().then(() => {
            measurePending = false
            measureAll()
        })
    }
    onMount(() => {
        measureAll()
        window.addEventListener("resize", measureAll)
    })
    onDestroy(() => window.removeEventListener("resize", measureAll))

    // convert a click x within a lyric element to the nearest character index
    function posFromClientX(elem: HTMLElement, clientX: number, maxLen: number): number {
        const text = elem.dataset.text || ""
        const rect = elem.getBoundingClientRect()
        const localX = clientX - rect.left
        const len = Math.min(text.length, maxLen)
        let lo = 0
        let hi = len
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1
            if (measureWidth(text.slice(0, mid)) <= localX) lo = mid
            else hi = mid - 1
        }
        if (lo >= len) return len
        const wLo = measureWidth(text.slice(0, lo))
        const wHi = measureWidth(text.slice(0, lo + 1))
        return localX - wLo > wHi - localX ? lo + 1 : lo
    }

    // INLINE ADD/EDIT
    interface Editing {
        loc: ChordLoc
        lineIndex: number
        lineText: string
        chordId: string | null
        pos: number
        value: string
    }
    let editing: Editing | null = null
    $: editingLeft = editing ? measureWidth(editing.lineText.slice(0, editing.pos)) : 0

    function openAdd(loc: ChordLoc, lineIndex: number, lineText: string, pos: number) {
        if (isLocked) return
        commitEdit()
        editing = { loc, lineIndex, lineText, chordId: null, pos, value: "" }
    }
    function openEdit(loc: ChordLoc, lineIndex: number, lineText: string, chord: RenderChord) {
        if (isLocked) return
        commitEdit()
        editing = { loc, lineIndex, lineText, chordId: chord.id, pos: chord.pos, value: chord.key }
    }
    function commitEdit() {
        if (!editing) return
        const ed = editing
        editing = null
        if (ed.chordId) updateChordKey(ed.loc, ed.lineIndex, ed.chordId, ed.value)
        else if (ed.value.trim()) addChordAt(ed.loc, ed.lineIndex, ed.pos, ed.value)
    }
    function cancelEdit() {
        editing = null
    }
    function inputKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault()
            commitEdit()
        } else if (e.key === "Escape") {
            e.preventDefault()
            cancelEdit()
        }
    }
    function focusSelect(node: HTMLInputElement) {
        setTimeout(() => {
            node.focus()
            node.select()
        }, 0)
    }
    function isEditingLine(slideId: string, itemIndex: number, lineIndex: number): boolean {
        return !!editing && editing.loc.slideId === slideId && editing.loc.itemIndex === itemIndex && editing.lineIndex === lineIndex
    }

    function lyricClick(e: MouseEvent, loc: ChordLoc, lineIndex: number, lineText: string) {
        const pos = posFromClientX(e.currentTarget as HTMLElement, e.clientX, lineText.length)
        openAdd(loc, lineIndex, lineText, pos)
    }

    // HOVER CARET — shows exactly where a click will place a chord
    let hoverCaret: { x: number; y: number; h: number } | null = null
    function lyricHover(e: MouseEvent, lineText: string) {
        if (isLocked || editing || drag) {
            hoverCaret = null
            return
        }
        const el = e.currentTarget as HTMLElement
        const pos = posFromClientX(el, e.clientX, lineText.length)
        const rect = el.getBoundingClientRect()
        hoverCaret = { x: rect.left + measureWidth(lineText.slice(0, pos)), y: rect.top, h: rect.height }
    }
    function lyricLeave() {
        hoverCaret = null
    }

    // DRAG TO MOVE (within the same textbox item)
    interface Drag {
        loc: ChordLoc
        fromLine: number
        chord: RenderChord
        lineText: string
        startX: number
        startY: number
        moved: boolean
    }
    let drag: Drag | null = null
    let dropBar: { x: number; y: number; h: number; line: number; pos: number } | null = null
    let dragGhost: { x: number; y: number; key: string } | null = null

    function chipPointerDown(e: PointerEvent, loc: ChordLoc, lineIndex: number, lineText: string, chord: RenderChord) {
        if (e.button !== 0 || isLocked) return
        if ((e.target as HTMLElement).closest(".chipDelete")) return
        e.preventDefault()
        e.stopPropagation()
        hoverCaret = null
        drag = { loc, fromLine: lineIndex, chord, lineText, startX: e.clientX, startY: e.clientY, moved: false }
        window.addEventListener("pointermove", onDragMove)
        window.addEventListener("pointerup", onDragUp)
    }
    function onDragMove(e: PointerEvent) {
        if (!drag) return
        if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 4) return
        drag.moved = true

        dragGhost = { x: e.clientX, y: e.clientY, key: drag.chord.key }

        const lyrics = Array.from(document.querySelectorAll<HTMLElement>(".lyric")).filter((el) => el.dataset.slideid === drag!.loc.slideId && Number(el.dataset.itemindex) === drag!.loc.itemIndex)
        if (!lyrics.length) {
            dropBar = null
            return
        }
        let best = lyrics[0]
        let bestDist = Infinity
        for (const el of lyrics) {
            const r = el.getBoundingClientRect()
            const dist = Math.abs(e.clientY - (r.top + r.height / 2))
            if (dist < bestDist) {
                bestDist = dist
                best = el
            }
        }

        const maxLen = Number(best.dataset.len || 0)
        const pos = posFromClientX(best, e.clientX, maxLen)
        const rect = best.getBoundingClientRect()
        const leftPx = measureWidth((best.dataset.text || "").slice(0, pos))
        dropBar = { x: rect.left + leftPx, y: rect.top - 2, h: rect.height + 4, line: Number(best.dataset.lineindex), pos }
    }
    function onDragUp() {
        window.removeEventListener("pointermove", onDragMove)
        window.removeEventListener("pointerup", onDragUp)
        const d = drag
        const bar = dropBar
        drag = null
        dropBar = null
        dragGhost = null
        if (!d) return
        if (!d.moved) {
            openEdit(d.loc, d.fromLine, d.lineText, d.chord)
            return
        }
        if (bar) moveChord(d.loc, d.fromLine, d.chord.id, bar.line, bar.pos)
    }

    // TRANSPOSE
    function onTransposeKey(e: Event) {
        const target = (e.target as HTMLSelectElement).value
        if (target && target !== detectedKey) transposeShowToKey(target, showId)
    }

    // APPLY CHORDS TO OTHER SLIDES
    function applyToMatching(section: RenderSection) {
        if (section.chordItemIndex === -1) return
        applyChordsToEmptySlides({ showId, slideId: section.slideId, itemIndex: section.chordItemIndex })
        newToast("edit.chords_applied")
    }

    // IMPORT CHORD SHEET
    let showImport = false
    let importText = ""
    function doImport() {
        if (!importText.trim()) return
        importChordSheet(importText, showId)
        importText = ""
        showImport = false
    }

    function windowKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            if (editing) cancelEdit()
            else if (showImport) showImport = false
        }
    }

    function lineNeedsRoom(section: RenderSection, itemIndex: number, line: RenderLine): boolean {
        return line.chords.length > 0 || isEditingLine(section.slideId, itemIndex, line.lineIndex)
    }
</script>

<svelte:window on:keydown={windowKeydown} />

<div class="chordEditor" class:locked={isLocked} style="font-size: {$textEditZoom / 9}em;">
    <span class="ruler" bind:this={rulerElem}></span>

    {#if isLocked}
        <div class="lockedInfo"><Icon id="lock" size={0.9} white /> <T id="output.state_locked" /></div>
    {/if}

    {#if !sections.length}
        <div class="empty"><T id="empty.text" /></div>
    {/if}

    {#each sections as section (section.key)}
        <div class="section" style={section.color ? `--gc: ${section.color};` : ""}>
            {#if section.label}
                <div class="sectionHeader">
                    <span class="label">{section.label}</span>
                    <span class="rule"></span>
                    {#if section.chordItemIndex !== -1 && !isLocked}
                        <button class="applyBtn" title={translateText("edit.apply_chords_matching")} on:click={() => applyToMatching(section)}>
                            <Icon id="copy" size={0.8} white />
                        </button>
                    {/if}
                </div>
            {/if}

            {#each section.boxes as box}
                {#if section.multiple}
                    <div class="boxLabel">#{box.itemIndex + 1}</div>
                {/if}
                {#each box.lines as line (line.lineIndex)}
                    {@const loc = { showId, slideId: section.slideId, itemIndex: box.itemIndex }}
                    {@const room = lineNeedsRoom(section, box.itemIndex, line)}
                    <div class="line" class:room>
                        {#if room}
                            <div class="chordRow">
                                {#each line.chords as chord (chord.id)}
                                    <span class="chip" class:dragging={drag?.moved && drag.chord.id === chord.id} style="left: {chordLefts[chord.id] || 0}px;" on:pointerdown={(e) => chipPointerDown(e, loc, line.lineIndex, line.text, chord)} title={chord.key}>
                                        <span class="chipKey">{chord.key}</span>
                                        {#if !isLocked}
                                            <span class="chipDelete" role="button" tabindex="-1" title={translateText("actions.delete")} on:pointerdown|stopPropagation on:click|stopPropagation={() => deleteChord(loc, line.lineIndex, chord.id)}>×</span>
                                        {/if}
                                    </span>
                                {/each}

                                {#if editing && isEditingLine(section.slideId, box.itemIndex, line.lineIndex)}
                                    <input class="chordInput" style="left: {editingLeft}px;" list="chordAutocomplete" bind:value={editing.value} on:keydown={inputKeydown} on:blur={commitEdit} use:focusSelect spellcheck="false" autocomplete="off" />
                                {/if}
                            </div>
                        {/if}

                        <div class="lyric" class:empty={!line.text} data-slideid={section.slideId} data-itemindex={box.itemIndex} data-lineindex={line.lineIndex} data-len={line.text.length} data-text={line.text} role="none" on:click={(e) => !isLocked && lyricClick(e, loc, line.lineIndex, line.text)} on:mousemove={(e) => lyricHover(e, line.text)} on:mouseleave={lyricLeave}>{line.text || " "}</div>
                    </div>
                {/each}
            {/each}
        </div>
    {/each}
</div>

<datalist id="chordAutocomplete">
    {#each usedChords as chord}
        <option value={chord}></option>
    {/each}
</datalist>

{#if hoverCaret && !drag && !editing}
    <div class="hoverCaret" style="left: {hoverCaret.x}px; top: {hoverCaret.y}px; height: {hoverCaret.h}px;"></div>
{/if}

{#if dropBar}
    <div class="dropIndicator" style="left: {dropBar.x}px; top: {dropBar.y}px; height: {dropBar.h}px;"></div>
{/if}

{#if dragGhost}
    <div class="dragGhost" style="left: {dragGhost.x}px; top: {dragGhost.y}px;">{dragGhost.key}</div>
{/if}

{#if showImport}
    <div class="importOverlay" role="none" on:click|self={() => (showImport = false)}>
        <div class="importBox">
            <h3><T id="edit.import_chord_sheet" /></h3>
            <p class="hint">{translateText("edit.import_chord_sheet_hint")}</p>
            <textarea bind:value={importText} placeholder={"Verse\n     G        D\nAmazing grace how sweet the sound"} spellcheck="false"></textarea>
            <div class="importActions">
                <MaterialButton variant="outlined" on:click={() => (showImport = false)}><T id="popup.cancel" /></MaterialButton>
                <MaterialButton variant="contained" on:click={doImport}><T id="actions.import" /></MaterialButton>
            </div>
        </div>
    </div>
{/if}

{#if !isLocked}
    <FloatingInputs side="left">
        <MaterialButton on:click={() => transposeShow(-1, showId)} title="edit.transpose_down" disabled={!hasChords}>
            <Icon id="remove" size={1.2} white />
        </MaterialButton>
        {#if hasChords && detectedKey}
            <div class="keySelect" title={translateText("edit.transpose_to_key")}>
                <span class="keyName">{detectedKey}</span>
                <Icon id="down" size={0.7} white />
                <select value={detectedKey} on:change={onTransposeKey}>
                    {#each chordKeyOptions as k}
                        <option value={k}>{k}</option>
                    {/each}
                </select>
            </div>
        {/if}
        <MaterialButton on:click={() => transposeShow(1, showId)} title="edit.transpose_up" disabled={!hasChords}>
            <Icon id="add" size={1.2} white />
        </MaterialButton>

        <div class="divider"></div>

        <MaterialButton on:click={() => (showImport = true)} title="edit.import_chord_sheet">
            <Icon id="paste" size={1.1} white />
        </MaterialButton>
    </FloatingInputs>
{/if}

<style>
    .chordEditor {
        --chord-color: #e9b96b; /* warm amber — distinct from the pink UI accent */
        --lyric-font: "Segoe UI", "Inter", system-ui, -apple-system, sans-serif;

        width: 100%;
        height: 100%;
        overflow: auto;
        padding: 16px 26px 70px;
        font-family: var(--lyric-font);
        line-height: 1.25;
        color: var(--text);
    }

    .ruler {
        position: absolute;
        visibility: hidden;
        white-space: pre;
        font-family: var(--lyric-font);
        font-weight: 500;
        letter-spacing: normal;
        pointer-events: none;
        top: -9999px;
        left: 0;
    }

    .empty {
        opacity: 0.4;
        padding: 20px 0;
    }

    .lockedInfo {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--secondary);
        opacity: 0.85;
        margin-bottom: 14px;
    }

    /* SECTION — subtle card panel for clear separation (no colored bars) */
    .section {
        --gc: var(--secondary);
        position: relative;
        margin-bottom: 10px;
        padding: 9px 14px 11px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--text) 4%, transparent);
        border: 1px solid color-mix(in srgb, var(--text) 5%, transparent);
    }
    .section:last-child {
        margin-bottom: 0;
    }

    .sectionHeader {
        display: flex;
        align-items: center;
        gap: 9px;
        margin-bottom: 0.3em;
    }
    .sectionHeader .label {
        font-size: 0.62em;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.13em;
        color: color-mix(in srgb, var(--gc) 60%, white);
        white-space: nowrap;
    }
    .sectionHeader .rule {
        flex: 1;
        height: 1px;
        background: linear-gradient(to right, color-mix(in srgb, var(--text) 10%, transparent), transparent);
    }
    .applyBtn {
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 5px;
        padding: 4px;
        cursor: pointer;
        opacity: 0;
        transition:
            opacity 0.12s,
            background-color 0.12s;
    }
    .section:hover .applyBtn {
        opacity: 0.5;
    }
    .applyBtn:hover {
        opacity: 1 !important;
        background-color: var(--primary-lighter);
    }

    .boxLabel {
        font-size: 0.62em;
        font-weight: 600;
        letter-spacing: 0.06em;
        opacity: 0.4;
        margin: 0.5em 0 0.1em;
    }

    /* LINE = a chord-over-lyric group. Separation lives ABOVE each line so the
       chord stays hugged to its own lyric, and pairs read as distinct units. */
    .line {
        position: relative;
        white-space: pre;
        margin-top: 0.6em;
    }
    .line.room {
        margin-top: 2em;
    }
    .section .line:first-of-type {
        margin-top: 0;
    }

    .chordRow {
        position: relative;
        height: 0.28em;
        width: 100%;
        pointer-events: none;
    }

    .chip {
        position: absolute;
        bottom: -0.46em;
        display: inline-flex;
        align-items: center;
        line-height: 1;
        color: var(--chord-color);
        font-weight: 700;
        font-size: 0.86em;
        white-space: nowrap;
        cursor: grab;
        pointer-events: auto;
        padding: 0 3px;
        margin-left: -3px;
        border-radius: 5px;
        user-select: none;
        transition: background-color 0.1s;
    }
    .chip:hover {
        background-color: color-mix(in srgb, var(--chord-color) 18%, transparent);
    }
    .chip:active {
        cursor: grabbing;
    }
    .chip.dragging {
        opacity: 0.25;
    }

    /* floating chord that follows the cursor while dragging */
    .dragGhost {
        position: fixed;
        transform: translate(-50%, -145%) rotate(-3deg);
        z-index: 300;
        pointer-events: none;
        color: #241a08;
        font-weight: 700;
        font-size: 0.92em;
        line-height: 1;
        white-space: nowrap;
        padding: 3px 8px;
        border-radius: 6px;
        background-color: var(--chord-color);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
    }
    .chipDelete {
        display: none;
        margin-left: 5px;
        color: var(--text);
        opacity: 0.5;
        font-weight: 700;
        cursor: pointer;
        line-height: 1;
    }
    .chip:hover .chipDelete {
        display: inline;
    }
    .chipDelete:hover {
        opacity: 1;
        color: #ff5b6a;
    }

    .chordInput {
        position: absolute;
        bottom: -0.15em;
        width: 6ch;
        min-width: 4.5em;
        font-family: var(--lyric-font);
        font-size: 0.86em;
        font-weight: 700;
        color: var(--chord-color);
        background-color: var(--primary-darkest);
        border: 1.5px solid var(--chord-color);
        border-radius: 5px;
        padding: 2px 5px;
        margin-left: -5px;
        outline: none;
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.35);
        z-index: 6;
    }

    .lyric {
        white-space: pre;
        cursor: text;
        line-height: 1.1;
        min-height: 1.2em;
        font-weight: 500;
        color: color-mix(in srgb, var(--text) 94%, transparent);
        border-radius: 4px;
        padding: 1px 3px;
        margin: 0 -3px;
        transition: background-color 0.1s;
    }
    .chordEditor:not(.locked) .lyric:hover {
        background-color: var(--hover);
    }
    .lyric.empty {
        opacity: 0.3;
    }
    .chordEditor.locked .lyric {
        cursor: default;
    }

    /* hover caret — a "+ here" affordance showing where a click lands a chord */
    .hoverCaret {
        position: fixed;
        width: 2px;
        margin-left: -1px;
        background-color: color-mix(in srgb, var(--chord-color) 45%, transparent);
        z-index: 40;
        pointer-events: none;
        border-radius: 2px;
    }
    .hoverCaret::before {
        content: "+";
        position: absolute;
        top: -1.15em;
        left: 50%;
        transform: translateX(-50%);
        color: var(--chord-color);
        font-size: 0.82em;
        font-weight: 700;
        line-height: 1;
    }

    .dropIndicator {
        position: fixed;
        width: 2px;
        background-color: var(--chord-color);
        z-index: 100;
        pointer-events: none;
        border-radius: 2px;
        box-shadow: 0 0 6px color-mix(in srgb, var(--chord-color) 60%, transparent);
        animation: pulse 0.9s infinite;
    }
    @keyframes pulse {
        0% {
            opacity: 0.4;
        }
        50% {
            opacity: 1;
        }
        100% {
            opacity: 0.4;
        }
    }

    /* TOOLBAR */
    .divider {
        width: 1px;
        height: 18px;
        background-color: var(--primary-lighter);
        margin: 0 3px;
    }
    .keySelect {
        position: relative;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0 12px;
        height: 100%;
        color: var(--text);
        font-weight: 700;
        cursor: pointer;
    }
    .keySelect:hover {
        background-color: var(--hover);
    }
    .keySelect .keyName {
        min-width: 1.4em;
        text-align: center;
        color: var(--chord-color);
    }
    .keySelect select {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
    }

    /* IMPORT OVERLAY */
    .importOverlay {
        position: absolute;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(2px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 200;
    }
    .importBox {
        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 12px;
        padding: 24px;
        width: 620px;
        max-width: 90%;
        display: flex;
        flex-direction: column;
        gap: 12px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    }
    .importBox h3 {
        margin: 0;
        font-size: 1.15em;
    }
    .importBox .hint {
        opacity: 0.6;
        font-size: 0.88em;
        margin: 0;
    }
    .importBox textarea {
        width: 100%;
        height: 280px;
        resize: vertical;
        font-family: "Consolas", ui-monospace, monospace;
        font-size: 0.95em;
        line-height: 1.5;
        background-color: var(--primary-darkest);
        color: var(--text);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        padding: 14px;
        outline: none;
    }
    .importBox textarea:focus {
        border-color: var(--chord-color);
    }
    .importActions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
    }
</style>
