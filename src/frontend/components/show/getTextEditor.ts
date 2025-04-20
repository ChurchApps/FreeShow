import type { Item } from "../../../types/Show"
import { getSlideText } from "../edit/scripts/textStyle"
import { clone } from "../helpers/array"
import { getLayoutRef } from "../helpers/show"
import { _show } from "../helpers/shows"
import { getTextboxes } from "./formatTextEditor"

export function getPlainEditorText(id: string = "active") {
    let ref = getLayoutRef(id)
    let slides = _show(id).get("slides")

    // slide data for editing (WIP unused)
    let slidesData: any[] = []

    let text = ""

    ref.forEach((refSlide) => {
        let id = refSlide.id
        let slide = slides[id]
        if (!slide) return

        let slideData: any = { id, items: slide.items, text: "", ref: refSlide }
        let data = getItems(slide.items)

        if (slide.group !== null && (data.hasTextboxItem || slide.children?.find((childId: any) => getSlideText(slides[childId]).length))) {
            let groupId = "[" + (replaceValues(slide.group, true) || "—") + "]"
            text += groupId + "\n"
            slideData.text += groupId + "\n"
            // children has content
            if (!data.hasTextboxItem) {
                data = { plainText: " ", text: " \n\n", hasTextboxItem: true }
            }
        }

        text += data.text

        slideData.text += data.plainText

        // don't add slides without textboxes
        if (data.hasTextboxItem) slidesData.push(slideData)
    })

    return text.trim()
}

function getItems(items: Item[]) {
    let text = ""
    let plainText = ""
    // let selectedItem: Item = getFirstNormalTextbox(items)
    let selectedItems: Item[] = getTextboxes(clone(items)).reverse()

    if (!selectedItems.length) return { text, plainText, hasTextboxItem: false }

    selectedItems.forEach((item, i) => {
        if (selectedItems.length > 1) {
            let translation = item?.language ? `:${item.language}` : ""
            let textboxId = `[#${i + 1}${translation}]`
            text += textboxId + "\n"
            plainText += textboxId + "\n"
        }

        let filteredLines = item.lines?.filter((line) => line.text?.filter((text) => text.value.length).length) || []
        filteredLines.forEach((line, i) => {
            let tempText = ""
            line.text?.forEach((txt) => {
                tempText += txt.value
            })

            // chords (from last in line to first)
            let sortedChords = line.chords?.sort((a, b) => b.pos - a.pos) || []
            sortedChords.forEach((chord) => {
                while (!tempText[chord.pos]) tempText += " "
                tempText = tempText.slice(0, chord.pos) + `[${chord.key}]` + tempText.slice(chord.pos)
            })

            if (tempText.length) {
                text += tempText + "\n"
                plainText += tempText + (i < filteredLines.length - 1 ? "\n" : "")
            }
        })

        // remove double enters
        text = text.replaceAll("\n\n", "")
        if (i === selectedItems.length - 1) text += "\n"
    })

    return { text, plainText, hasTextboxItem: true }
}

const br = "||__$BREAK$__||"

function replaceValues(text: string, revert: boolean = false) {
    if (!text) return ""

    if (revert) return text.replaceAll(br, "\n")
    return text.replaceAll("\n", br)
}
