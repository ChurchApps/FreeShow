import type { Item, Line } from "../../../../types/Show"

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
        let result: Line[] = []
        lines.forEach((line) => {
            let splitLines = this.splitCrlf(line)
            result.push(...splitLines)
        })
        return result
    }

    static splitCrlf(line: Line) {
        const result: Line[] = []
        let newLine = { ...line }
        newLine.text = []

        line.text.forEach((text) => {
            let value = text.value
            let parts = value.replace("\r", "").split("\n")
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
        return { firstLines, secondLines }
    }

    static getSyleHtml(item: Item, plain: boolean, currentStyle: string) {
        currentStyle = ""
        let html = ""
        let firstTextStyleArchive: string = ""
        let lineBg = item.specialStyle?.lineBg ? `background-color: ${item.specialStyle.lineBg};` : ""
        item?.lines?.forEach((line, i) => {
            let align = line.align.replaceAll(lineBg, "")
            currentStyle += align + lineBg
            let style = align || lineBg ? 'style="' + align + ";" + lineBg + '"' : ""
            html += `<div class="break" ${plain ? "" : style}>`

            // fix removing all text in a line
            if (i === 0 && line.text?.[0]?.style) firstTextStyleArchive = line.text?.[0]?.style || ""
            if (!line.text?.length) line.text = [{ style: firstTextStyleArchive || "", value: "" }]

            let currentChords = line.chords || []
            let textIndex = 0

            line.text?.forEach((a, tIndex) => {
                currentStyle += this.getTextStyle(a)

                // SAVE CHORDS (WIP does not work well with more "text" per line)
                let textEnd = textIndex + a.value.length
                let textChords = currentChords.filter((a) => a.pos >= textIndex && (a.pos <= textEnd || line.text.length - 1 >= tIndex))
                textIndex = textEnd

                let style = a.style ? 'style="' + a.style + '"' : ""

                html += `<span class="${a.customType ? "custom" : ""}" ${plain ? "" : style} data-chords='${JSON.stringify(textChords)}'>` + (a.value.replaceAll("\n", "<br>") || "<br>") + "</span>"
            })
            html += "</div>"
        })
        return { html, currentStyle }
    }

    static getTextStyle(lineText: any) {
        let style = lineText.style || ""
        return style
    }
}
