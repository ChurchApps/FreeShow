import { uid } from "uid"
import type { Chords, Item, Slide } from "../../../../types/Show"
import { selected } from "../../../stores"
import { clone } from "../../helpers/array"
import { _show } from "../../helpers/shows"
import { keys } from "../values/chords"

export function createChord(pos: number, key: string, id: string = uid(5)): Chords {
    return { id, pos, key }
}

export function addChords(item: Item, showRef, itemIndex, line = 0, pos = 0, key = keys[0]) {
    const newLines = clone(item.lines || [])
    if (!newLines[line].chords) newLines[line].chords = []
    const id = uid(5)

    // get first empty
    newLines[line]
        .chords!.sort((a, b) => a.pos - b.pos)
        .forEach(chord => {
            if (chord.pos === pos) pos++
        })

    newLines[line].chords!.push(createChord(pos, key || keys[0], id))

    _show(showRef.showId)
        .slides([showRef.id])
        .items([itemIndex])
        .set({ key: "lines", values: [newLines] })

    selected.set({ id: "chord", data: [{ chord: { id }, index: line, slideId: showRef.id, itemIndex }] })
}

// get all chords in a textbox
export function loadChords(item: Item) {
    const chordsList: string[] = []
    if (!item) return chordsList

    item.lines?.forEach(line => {
        line.chords?.forEach(chord => {
            chordsList.push(chord.key)
        })
    })

    return chordsList
}

// get a list of unique chords used in a slide
export function getUsedChords(slide: Slide) {
    if (!slide?.items?.length) return []
    const itemChords = slide.items.reduce((value: string[], item) => (value = [...value, ...loadChords(item)]), [])
    return [...new Set(itemChords)].sort((a, b) => a?.localeCompare(b))
}

// IMPORT CHORD TEXT LINES

export function isChordLine(text: string) {
    const words = text.trim().split(/\s+/)
    return words.every(word => /^[A-G][#b]?m?\d?(7|9|13)?$/.test(word))
    // text.trim().match(/^[A-G][#b]?m?\d?7?\s+.*$/)
}

export function parseChordLine(text: string) {
    const chords: Chords[] = []
    let chordStart = -1

    for (let i = 0; i <= text.length; i++) {
        const char = text[i]

        if (char !== " " && chordStart === -1) {
            chordStart = i
        } else if ((char === " " || i === text.length) && chordStart !== -1) {
            chords.push({ id: uid(5), key: text.slice(chordStart, i), pos: chordStart })
            chordStart = -1
        }
    }

    return chords
}
