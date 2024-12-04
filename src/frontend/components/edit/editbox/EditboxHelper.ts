import type { Item, Line } from "../../../../types/Show"
import { clone } from "../../helpers/array"

export class EditboxHelper {
    //Compare text of all the new lines to determine if it's truly a modification or just an index change.
    //Set the cursor to the start of the last line that was modified.
    static determineCaretLine(oldLines: Line[], newLines: Line[]) {
        const oldTexts: string[] = []
        const newTexts: string[] = []

        oldLines?.forEach((line) => {
            oldTexts.push(line.text[0].value)
        })

        newLines.forEach((line) => {
            newTexts.push(line.text[0].value)
        })

        let lastLineChanged = -1
        if (oldTexts.length === newTexts.length) return lastLineChanged
        for (let i = 0; i < newTexts.length; i++) {
            const nt = newTexts[i]
            const index = oldTexts.indexOf(nt)
            if (index === -1) lastLineChanged = i
            else oldTexts.splice(index, 1)
        }
        return lastLineChanged
    }

    static splitAllCrlf(lines: Line[]) {
        const result: Line[] = []
        lines.forEach((line) => {
            const splitLines = this.splitCrlf(line)
            result.push(...splitLines)
        })
        return result
    }

    static splitCrlf(line: Line) {
        const result: Line[] = []
        let newLine = { ...line }
        newLine.text = []

        line.text.forEach((text) => {
            const value = text.value
            const parts = value.replace("\r", "").split("\n")
            newLine.text.push({ style: text.style, value: parts[0] })
            if (parts.length > 1) {
                for (let i = 1; i < parts.length; i++) {
                    result.push(newLine)
                    newLine = { ...line }
                    newLine.text = [{ style: text.style, value: parts[i] }]
                }
            }
        })
        result.push(newLine)
        return result
    }

    static cutLinesInTwo({ sel, lines, currentIndex, textPos, start }) {
        let firstLines: Line[] = []
        let secondLines: Line[] = []

        lines.forEach((line: Line, i: number) => {
            if (start > -1 && currentIndex >= start) secondLines.push({ align: line.align, text: [] })
            else firstLines.push({ align: line.align, text: [] })

            textPos = 0
            line.text?.forEach((text) => {
                currentIndex += text.value.length
                if (sel[i]?.start !== undefined) start = sel[i].start

                if (start > -1 && currentIndex >= start) {
                    if (!secondLines.length) secondLines.push({ align: line.align, text: [] })
                    const pos = sel[i].start - textPos
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

        const defaultLine = [
            {
                align: lines[0].align || "",
                text: [{ style: lines[0].text[0]?.style || "", value: "" }],
            },
        ]
        if (!firstLines.length || !firstLines[0].text.length) firstLines = defaultLine
        if (!secondLines.length) secondLines = defaultLine

        // add chords (currently only adding full line chords, so splitting in the middle of a line might shift chords)
        const chordLines = clone(lines.map((a) => a.chords || []))
        ;[...firstLines, ...secondLines].forEach((line) => {
            const oldLineChords = chordLines.shift()
            if (oldLineChords?.length) line.chords = oldLineChords
        })

        return { firstLines, secondLines }
    }

    static getSyleHtml(item: Item, plain: boolean, currentStyle: string) {
        currentStyle = ""
        let html = ""
        let firstTextStyleArchive = ""
        const lineBg = item.specialStyle?.lineBg ? `background-color: ${item.specialStyle.lineBg};` : ""
        item?.lines?.forEach((line, i) => {
            const align = line.align.replaceAll(lineBg, "")
            currentStyle += align + lineBg // + line.chords?.map((a) => a.key)
            const style = align || lineBg ? 'style="' + align + ";" + lineBg + '"' : ""
            html += `<div class="break" ${plain ? "" : style}>`

            // fix removing all text in a line
            if (i === 0 && line.text?.[0]?.style) firstTextStyleArchive = line.text?.[0]?.style || ""
            if (!line.text?.length) line.text = [{ style: firstTextStyleArchive || "", value: "" }]

            const currentChords = line.chords || []
            let textIndex = 0

            line.text?.forEach((a, tIndex) => {
                currentStyle += this.getTextStyle(a)

                // SAVE CHORDS (WIP does not work well with more "text" per line)
                const textEnd = textIndex + a.value.length
                const textChords = currentChords.filter((a) => a.pos >= textIndex && (a.pos <= textEnd || line.text.length - 1 >= tIndex))
                textIndex = textEnd

                const style = a.style ? 'style="' + a.style + '"' : ""
                let value = a.value.replaceAll("\n", "<br>") || "<br>"
                if (value === " ") value = "&nbsp;"

                // this will "hide" any HTML tags if any in the actual text content (not chords or text editor)
                html += `<span class="${a.customType && !a.customType.includes("jw") ? "custom" : ""}" ${plain ? "" : style} data-chords='${JSON.stringify(textChords)}'>` + value + "</span>"
            })
            html += "</div>"
        })
        return { html, currentStyle }
    }

    static getTextStyle(lineText: any) {
        const style = lineText.style || ""
        return style
    }
}
