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
        .forEach((chord) => {
            if (chord.pos === pos) pos++
        })

    newLines[line].chords!.push(createChord(pos, key || keys[0], id))

    _show(showRef.showId)
        .slides([showRef.id])
        .items([itemIndex])
        .set({ key: "lines", values: [newLines] })

    selected.set({ id: "chord", data: [{ chord: { id }, index: line, slideId: showRef.id, itemIndex }] })
}

export function changeKey({ item, showRef, itemIndex, chord, lineIndex }: { item: Item; showRef: any; itemIndex: number; chord: any; lineIndex: number }) {
    let nextKeyIndex = keys.findIndex((a) => a === chord.key) + 1
    if (nextKeyIndex >= keys.length) nextKeyIndex = 0
    const nextKey = keys[nextKeyIndex]

    const newLines = [...item.lines!]
    const currentChordIndex = newLines[lineIndex].chords?.findIndex((a) => a.id === chord.id) ?? -1
    if (currentChordIndex < 0) return

    newLines[lineIndex].chords![currentChordIndex].key = nextKey

    _show(showRef.showId)
        .slides([showRef.id])
        .items([itemIndex])
        .set({ key: "lines", values: [newLines] })

    // setTimeout(() => (chordDrag = null), 100);
}

// WIP unused:
// TODO: transpose chords
let chordDrag: any = null
export function chordDown(chordData, { showRef, itemIndex }) {
    selected.set({
        id: "chord",
        data: [{ slideId: showRef.id, itemIndex, ...chordData }],
    })
    chordDrag = chordData
    // setTimeout(() => (chordDrag = chordData), 10);
}
export function chordUp({ showRef, itemIndex, item }) {
    if (chordDrag === null) return
    chordDrag = null
    if (showRef.type === "show") {
        // TODO: only update if different!!
        _show(showRef.showId)
            .slides([showRef.id])
            .items([itemIndex])
            .set({ key: "lines", values: [[...item.lines!]] })
    }
}

export function chordMove(e: any, { textElem, item }: { textElem: HTMLElement; item: Item }) {
    if (chordDrag === null) return

    // let elemBox = textElem.getBoundingClientRect();
    // console.log(e.clientX, elemBox.left);
    // let mouse = { x: e.clientX - elemBox.left, y: e.clientY - elemBox.top };
    const mouse = { x: e.offsetX, y: e.offsetY + e.target.offsetTop }

    // get closest line
    const lines = [...textElem.children] as HTMLElement[]
    let closestLine = { index: 0, elem: lines[0] }
    lines.forEach((lineElem, i) => {
        const currentLine = { index: i, elem: lineElem }
        const top = lineElem.offsetTop
        const height = lineElem.offsetHeight
        // console.log(lineElem.offsetTop, lineElem.offsetHeight, mouse.y);
        // if (mouse.y >= top && mouse.y <= top + height) closestLine = currentLine;
        if (mouse.y >= top - height * 1.2) closestLine = currentLine
    })
    if (!closestLine.elem) return

    const lineElems = [...textElem.children[closestLine.index].children] as HTMLElement[]
    const totalLineWidth = lineElems.reduce((value, elem) => (value += elem.offsetWidth), 0)
    const lineLetters = item.lines![closestLine.index].text?.reduce((value, text) => (value += text.value.length), 0)
    if (!lineLetters) return
    // times temp value because offset values are not matching
    const charWidth = totalLineWidth / (lineLetters * 2.5)

    // get closest char
    // let lineLeft = lineElems[0].offsetLeft;
    // let pos = Math.floor((mouse.x - lineLeft) / charWidth);
    // console.log(mouse.x, lineLeft);
    // if (mouse.x < lineLeft) pos = 0;
    // if (mouse.x > lineElems[0].offsetWidth) pos = lineLetters;
    const pos = Math.floor(mouse.x / charWidth)
    console.log(pos)
    if (pos > lineLetters) return

    const newLines = [...item.lines!]
    const currentChordIndex = newLines[chordDrag.index].chords?.findIndex((a) => a.id === chordDrag.chord.id) ?? -1
    if (currentChordIndex < 0) return

    if (chordDrag.index !== closestLine.index) {
        // remove from current line
        newLines[chordDrag.index].chords!.splice(currentChordIndex, 1)
        chordDrag.index = closestLine.index
        // add to new line
        if (!newLines[chordDrag.index].chords) newLines[chordDrag.index].chords = []
        newLines[chordDrag.index].chords!.push({ ...chordDrag.chord, pos })
    } else {
        newLines[chordDrag.index].chords![currentChordIndex].pos = pos
    }
    return newLines
}

// chords getting wrong position if not waiting
const delay = (ms) => new Promise((res) => setTimeout(res, ms))
export async function getChordPosition(chord: any, { textElem, item, line }) {
    if (!chordDrag) await delay(1)

    if (!textElem || !textElem.children[line]) return "display: none;"
    const lineElems = [...textElem.children[line].children]
    if (!lineElems?.length) return "display: none;"

    const totalLineWidth = lineElems.reduce((value, elem) => (value += elem.offsetWidth), 0)

    const lineLetters = item.lines![line].text?.reduce((value, text) => (value += text.value.length), 0)
    if (!lineLetters) return "display: none;"
    const charWidth = totalLineWidth / lineLetters

    return `inset-inline-start: ${lineElems[0].offsetLeft + chord.pos * charWidth}px;top: ${lineElems[0].offsetTop}px;`
}

// get all chords in a textbox
export function loadChords(item: Item) {
    const chordsList: string[] = []
    if (!item) return chordsList

    item.lines?.forEach((item) => {
        item.chords?.forEach((chord) => {
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
    return words.every((word) => /^[A-G][#b]?m?\d?(7|9|13)?$/.test(word))
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
