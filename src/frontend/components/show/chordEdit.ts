import { get } from "svelte/store"
import { uid } from "uid"
import type { Chords, Line, Show } from "../../../types/Show"
import { activeShow } from "../../stores"
import { detectKey as detectKeyUtil, getSemitonesBetweenKeys, transposeChordKey } from "../../utils/chordTranspose"
import { clone } from "../helpers/array"
import { history } from "../helpers/history"
import { _show } from "../helpers/shows"
import { isChordLine, parseChordLine } from "../edit/scripts/chords"
import { formatText } from "./formatTextEditor"

export interface ChordLoc {
    showId: string
    slideId: string
    itemIndex: number
}

function getLines(loc: ChordLoc): Line[] {
    // items().get() returns a nested array (one array of items per slide) -> [slideIndex][itemIndex]
    const item = _show(loc.showId).slides([loc.slideId]).items([loc.itemIndex]).get()?.[0]?.[0]
    return clone(item?.lines || [])
}

// save the modified lines back to the show (undoable)
function saveLines(loc: ChordLoc, newLines: Line[]) {
    history({
        id: "SHOW_ITEMS",
        newData: { key: "lines", data: [clone(newLines)], slides: [loc.slideId], items: [loc.itemIndex], showId: loc.showId },
        location: { page: "none" }
    })
}

// total character length of a line's text
function lineLength(line: Line): number {
    return (line?.text || []).reduce((len, t) => len + (t.value?.length || 0), 0)
}

// SINGLE CHORD MUTATIONS

export function addChordAt(loc: ChordLoc, lineIndex: number, pos: number, key: string) {
    if (!key?.trim()) return
    const lines = getLines(loc)
    if (!lines[lineIndex]) return
    if (!lines[lineIndex].chords) lines[lineIndex].chords = []

    // don't stack two chords on the exact same position
    while (lines[lineIndex].chords!.some((c) => c.pos === pos)) pos++

    lines[lineIndex].chords!.push({ id: uid(5), pos, key: key.trim() })
    saveLines(loc, lines)
}

export function updateChordKey(loc: ChordLoc, lineIndex: number, chordId: string, key: string) {
    const lines = getLines(loc)
    const chord = lines[lineIndex]?.chords?.find((c) => c.id === chordId)
    if (!chord) return

    // remove chord if cleared
    if (!key?.trim()) {
        deleteChord(loc, lineIndex, chordId)
        return
    }

    chord.key = key.trim()
    saveLines(loc, lines)
}

export function deleteChord(loc: ChordLoc, lineIndex: number, chordId: string) {
    const lines = getLines(loc)
    if (!lines[lineIndex]?.chords) return
    lines[lineIndex].chords = lines[lineIndex].chords!.filter((c) => c.id !== chordId)
    if (!lines[lineIndex].chords!.length) delete lines[lineIndex].chords
    saveLines(loc, lines)
}

// move a chord within its item (can change line and position)
export function moveChord(loc: ChordLoc, fromLine: number, chordId: string, toLine: number, pos: number) {
    const lines = getLines(loc)
    const source = lines[fromLine]?.chords?.find((c) => c.id === chordId)
    if (!source || !lines[toLine]) return

    if (pos < 0) pos = 0
    const maxPos = Math.max(lineLength(lines[toLine]), 0)
    if (pos > maxPos) pos = maxPos

    // remove from source
    lines[fromLine].chords = (lines[fromLine].chords || []).filter((c) => c.id !== chordId)
    if (!lines[fromLine].chords!.length) delete lines[fromLine].chords

    // add to target (avoid exact overlap)
    if (!lines[toLine].chords) lines[toLine].chords = []
    while (lines[toLine].chords!.some((c) => c.pos === pos)) pos++
    lines[toLine].chords!.push({ ...source, pos })

    saveLines(loc, lines)
}

// WHOLE SHOW OPERATIONS

// transpose every chord in the show by a number of semitones (in place, preserving structure)
export function transposeShow(step: number, showId = "") {
    if (!showId) showId = get(activeShow)?.id || ""
    if (!showId || !step) return

    const show: Show = clone(_show(showId).get())
    if (!show) return

    let changed = false
    Object.values(show.slides || {}).forEach((slide) => {
        slide?.items?.forEach((item) => {
            item?.lines?.forEach((line) => {
                line.chords?.forEach((chord) => {
                    const transposed = transposeChordKey(chord.key, step)
                    if (transposed !== chord.key) {
                        chord.key = transposed
                        changed = true
                    }
                })
            })
        })
    })

    if (!changed) return
    history({ id: "UPDATE", newData: { data: show }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
}

// transpose the whole show so its detected key becomes the target key
export function transposeShowToKey(targetKey: string, showId = "") {
    if (!showId) showId = get(activeShow)?.id || ""
    if (!showId) return
    const current = getShowKey(showId)
    if (!current) return
    const step = getSemitonesBetweenKeys(current, targetKey)
    if (!step) return
    transposeShow(step, showId)
}

// list of all chord keys used in a show
export function getShowChordKeys(showId: string): string[] {
    const show = _show(showId).get()
    const keys: string[] = []
    Object.values(show?.slides || {}).forEach((slide: any) => {
        slide?.items?.forEach((item: any) => {
            item?.lines?.forEach((line: any) => {
                line?.chords?.forEach((chord: any) => keys.push(chord.key))
            })
        })
    })
    return keys
}

// detected key of the whole show
export function getShowKey(showId: string): string {
    return detectKeyUtil(getShowChordKeys(showId))
}

// copy a slide item's chords onto every text item that currently has none, aligning per line with proportional spacing
export function applyChordsToEmptySlides(loc: ChordLoc) {
    const show: Show = clone(_show(loc.showId).get())
    if (!show) return

    const sourceLines: Line[] = show.slides?.[loc.slideId]?.items?.[loc.itemIndex]?.lines || []
    const sourceHasChords = sourceLines.some((l) => l.chords?.length)
    if (!sourceHasChords) return

    let changed = false
    Object.entries(show.slides || {}).forEach(([slideId, slide]) => {
        slide?.items?.forEach((item, itemIndex) => {
            if ((item.type || "text") !== "text" || !item.lines?.length) return
            if (slideId === loc.slideId && itemIndex === loc.itemIndex) return
            // skip items that already have chords
            if (item.lines.some((l) => l.chords?.length)) return

            item.lines.forEach((line, lineIndex) => {
                const src = sourceLines[lineIndex]
                if (!src?.chords?.length) return
                const srcLen = Math.max(lineLength(src), 1)
                const tgtLen = Math.max(lineLength(line), 1)

                line.chords = src.chords.map((c) => {
                    let pos = Math.round((c.pos / srcLen) * tgtLen)
                    if (pos < 0) pos = 0
                    if (pos > tgtLen) pos = tgtLen
                    return { id: uid(5), pos, key: c.key }
                })
                changed = true
            })
        })
    })

    if (!changed) return
    history({ id: "UPDATE", newData: { data: show }, oldData: { id: loc.showId }, location: { page: "show", id: "show_key" } })
}

// IMPORT CHORD SHEET (chords above lyrics -> structured chords)

const SECTION_RE = /^\[?\s*(verse|chorus|bridge|intro|outro|tag|pre[- ]?chorus|refrain|interlude|ending)\s*\d*\s*\]?:?$/i

function titleCase(text: string): string {
    return text
        .split(/(\s|-)/)
        .map((w) => (w.length > 1 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
        .join("")
}

function chordsToBracketLine(text: string, chords: Chords[]): string {
    let result = text
    const sorted = [...chords].sort((a, b) => b.pos - a.pos)
    sorted.forEach((chord) => {
        while (result.length < chord.pos) result += " "
        result = result.slice(0, chord.pos) + `[${chord.key}]` + result.slice(chord.pos)
    })
    return result
}

// convert a pasted chords-above-lyrics sheet into FreeShow bracketed text
function chordSheetToBracketedText(sheet: string): string {
    const lines = sheet.replace(/\r/g, "").split("\n")
    const out: string[] = []
    let pending: Chords[] | null = null

    lines.forEach((raw) => {
        const line = raw.replace(/\s+$/, "")
        const trimmed = line.trim()

        // section header
        if (SECTION_RE.test(trimmed)) {
            if (pending) {
                out.push(chordsToBracketLine("", pending))
                pending = null
            }
            out.push("[" + titleCase(trimmed.replace(/[[\]:]/g, "").trim()) + "]")
            return
        }

        // chord line
        if (trimmed && isChordLine(line)) {
            if (pending) out.push(chordsToBracketLine("", pending))
            pending = parseChordLine(line)
            return
        }

        // lyric or blank line
        if (pending) {
            out.push(chordsToBracketLine(line, pending))
            pending = null
            return
        }
        out.push(line)
    })

    if (pending) out.push(chordsToBracketLine("", pending))

    return out
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

export function importChordSheet(sheet: string, showId = "") {
    if (!showId) showId = get(activeShow)?.id || ""
    if (!showId || !sheet.trim()) return
    formatText(chordSheetToBracketedText(sheet), showId)
}
