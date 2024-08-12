<script lang="ts">
    import type { Item } from "../../../types/Show"
    import { getQuickExample } from "../../converters/txt"
    import { slidesOptions } from "../../stores"
    import { _show } from "../helpers/shows"
    import { formatText, getTextboxes } from "./formatTextEditor"
    import Notes from "./tools/Notes.svelte"

    export let currentShow: any

    let text: string = ""
    $: if (currentShow) getText()

    // slide data for editing
    let slidesData: any[] = []

    // WIP only first textbox if multiple!

    function getText() {
        let ref = _show().layouts("active").ref()[0]
        let slides = _show().get("slides")

        text = ""
        slidesData = []

        ref.forEach((refSlide) => {
            let id = refSlide.id
            let slide = slides[id]
            if (!slide) return

            let slideData: any = { id, items: slide.items, text: "", ref: refSlide }
            let data = getItems(slide.items)

            if (slide.group !== null && data.hasTextboxItem) {
                let groupId = "[" + (replaceValues(slide.group, true) || "—") + "]"
                text += groupId + "\n"
                slideData.text += groupId + "\n"
            }

            text += data.text

            slideData.text += data.plainText

            // don't add slides without textboxes
            if (data.hasTextboxItem) slidesData.push(slideData)
        })

        text = text.trim()
    }

    function getItems(items: Item[]) {
        let text = ""
        let plainText = ""
        // let selectedItem: Item = getFirstNormalTextbox(items)
        let selectedItems: Item[] = getTextboxes(items)

        if (!selectedItems.length) return { text, plainText, hasTextboxItem: false }

        selectedItems.forEach((item, i) => {
            if (selectedItems.length > 1) {
                let textboxId = "[#" + (i + 1) + "]"
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
                    if (tempText[chord.pos]) tempText = tempText.slice(0, chord.pos) + `[${chord.key}]` + tempText.slice(chord.pos)
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
</script>

<Notes style="padding: 30px;font-size: {(-1.1 * $slidesOptions.columns + 12) / 6}em;" placeholder={getQuickExample()} value={text} on:change={formatText} />
