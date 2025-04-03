import { get } from "svelte/store"
import type { Item, Line } from "../../../../types/Show"
import { outputs, styles } from "../../../stores"
import { clone } from "../../helpers/array"
import { getActiveOutputs } from "../../helpers/output"
import { getStyles } from "../../helpers/style"

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
                        value: text.value.slice(pos > 0 ? pos : 0, text.value.length),
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

        // remove first line if empty
        if (secondLines?.[0]?.text?.[0]?.value === "") secondLines.shift()

        let defaultLine = [
            {
                align: lines[0].align || "",
                text: [{ style: lines[0].text[0]?.style || "", value: "" }],
            },
        ]
        if (!firstLines.length || !firstLines[0].text.length) firstLines = defaultLine
        if (!secondLines.length) secondLines = defaultLine

        // add chords (currently only adding full line chords, so splitting in the middle of a line might shift chords)
        let chordLines = clone(lines.map((a) => a.chords || []))
        ;[...firstLines, ...secondLines].forEach((line) => {
            let oldLineChords = chordLines.shift()
            if (oldLineChords?.length) line.chords = oldLineChords
        })

        return { firstLines, secondLines }
    }

    static getStyleHtml(item: Item, plain: boolean, currentStyle: string) {
        currentStyle = ""
        let html = ""
        let firstTextStyleArchive: string = ""
        let lineBg = item.specialStyle?.lineBg ? `background-color: ${item.specialStyle.lineBg};` : ""
        let listStyle = "" // item.list?.enabled ? `;list-style${item.list?.style?.includes("disclosure") ? "-type:" : ": inside"} ${item.list?.style || "disc"};` : ""

        item?.lines?.forEach((line, i) => {
            let align = line.align.replaceAll(lineBg, "") + ";"
            currentStyle += align + lineBg // + line.chords?.map((a) => a.key)
            let style = align || lineBg || listStyle ? 'style="' + align + lineBg + listStyle + '"' : ""
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

                let listStyle = "" // item.list?.enabled ? ";display: list-item;" : ""
                let style = a.style || listStyle ? 'style="' + this.getCustomFontSize(a.style) + listStyle + '"' : ""
                let value = a.value?.replaceAll("\n", "<br>") || "<br>"
                if (value === " ") value = "&nbsp;"

                // this will "hide" any HTML tags if any in the actual text content (not chords or text editor)
                html += `<span class="${a.customType && !a.customType.includes("jw") ? "custom" : ""}" ${plain ? "" : style} data-chords='${JSON.stringify(textChords)}'>` + value + "</span>"
            })
            html += "</div>"
        })

        // currentStyle = currentStyle.replaceAll(";;", ";")
        return { html, currentStyle }
    }

    static getTextStyle(lineText: any) {
        let style = lineText.style || ""
        return style
    }

    static getCustomFontSize(style: string) {
        if (!style) return ""
        const fontSize = Number(getStyles(style, true)["font-size"] || 100)

        // get first output style
        const outputId = getActiveOutputs()[0]
        const currentOutput = get(outputs)[outputId] || {}
        const outputStyle = get(styles)[currentOutput.style || ""] || {}
        if (!Object.keys(outputStyle).length) return ""

        const customFontSizeRatio = (outputStyle.aspectRatio?.fontSizeRatio ?? 100) / 100

        // remove custom font size
        // let customIndex = style.indexOf("--custom")
        // if (customIndex > -1) style = style.slice(0, customIndex)

        return `${style};--custom:true;font-size: ${fontSize * customFontSizeRatio}px;`
    }
}
