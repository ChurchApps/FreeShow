import type { Item, Line, Slide } from "../../../../types/Show"
import { replaceVirtualBreaks } from "../../../show/slides"

// add new style to text by selection
export function addStyle(selection: { start: number; end: number }[], item: Item, style: string | any[]): Item {
    if (!Array.isArray(item.lines)) return item

    item.lines.forEach((line, i) => {
        const newText: any[] = []
        let pos = 0
        if (selection[i]?.start !== undefined && Array.isArray(line.text)) {
            line.text.forEach((text) => {
                const value = text.value || ""
                const length = value.length

                let from = 0
                let to = length
                if (pos < selection[i].start && pos + length > selection[i].start) from = selection[i].start - pos
                if (pos < selection[i].end && pos + length > selection[i].end) to = selection[i].end - pos

                if ((pos < selection[i].start && pos + length > selection[i].start) || (pos < selection[i].end && pos + length > selection[i].end) || (pos >= selection[i].start && pos + length <= selection[i].end)) {
                    if (from > 0) newText.push({ value: value.slice(0, from), style: text.style })
                    if (to - from > 0 && to - from <= length) {
                        let newStyle = ""
                        if (Array.isArray(style)) newStyle = addStyleString(text.style, style)
                        else newStyle = style
                        newText.push({ value: value.slice(from, to), style: newStyle })
                    }
                    if (to < length) newText.push({ value: value.slice(to, length), style: text.style })
                } else newText.push(text)

                // empty line
                if (text && !newText.length) newText.push(text)

                pos += length
            })
        } else newText.push(...(line.text || []))

        line.text = newText
    })

    return combine(item)
}

// combine duplicate styles
function combine(item: Item): Item {
    if (!Array.isArray(item.lines)) return item

    item.lines.forEach((line) => {
        if (!Array.isArray(line.text)) return
        const a = [...line.text]
        for (let i = 0; i < a.length; i++) {
            if (a[i + 1]) {
                const d1: any[] = []
                const d2: any[] = []
                let sameStyles = false
                if (a[i].style) d1.push(a[i].style)
                if (a[i + 1].style) d2.push(a[i + 1].style)
                if (d1.length === d2.length) {
                    d1.sort()
                    d2.sort()
                    sameStyles = d1.every((val, j) => val.replaceAll(" ", "").replace(";", "") === d2[j].replaceAll(" ", "").replace(";", ""))
                }

                if (sameStyles) {
                    a[i].value += a[i + 1].value
                    a.splice(i + 1, 1)
                    i--
                }
            }
        }

        line.text = a
    })
    return item
}

// add new style to string and remove old
export function addStyleString(oldStyle: string, style: any[]): string {
    if (!oldStyle) return style[1] !== null ? style.join(":") + ";" : ""
    if (typeof oldStyle !== "string") return ""

    let array: string[] = oldStyle.split(";")
    // remove last if empty
    if (!array[array.length - 1].length) array.pop()
    // remove old styles using filter to avoid index issues
    array = array.filter((s) => {
        return s.split(":")[0].trim() !== style[0] && s.length > 0
    })

    // remove font if changing family
    if (style[0] === "font-family") {
        array = array.filter((a) => !a.includes("font:"))
    }

    // add new style
    // add font to start so any font-size will override this
    if (style[0] === "font") {
        array.unshift(style.join(":"))

        // place any font-family at the start (before font, just so the dropdown knows the font)
        const fontFamilyIndex = array.findIndex((a) => a.includes("font-family"))
        array.unshift(array.splice(fontFamilyIndex, 1)[0])
    } else if (style[1] !== null) array.push(style.join(":"))

    let newStyle: string = array.join(";")
    if (newStyle.slice(-1) !== ";") newStyle += ";"
    return newStyle
}

// add new filter to string and remove old if existing
export function addFilterString(oldFilter: string, filter: any[]): string {
    let array: string[] = oldFilter.split(" ")
    // remove last if empty
    if (!array[array.length - 1].length) array.pop()

    // remove old styles
    array.forEach((s, i) => {
        if (s.split("(")[0].replace(")", "").trim() === filter[0] || !s.length) array.splice(i, 1)
    })
    // add new filter
    if (filter[1] !== null) array.push(filter.join("(") + ")")

    // transform perspective has to be first
    const perspectiveIndex = array.findIndex((a) => a.includes("perspective"))
    if (perspectiveIndex >= 0) {
        const value = array.splice(perspectiveIndex, 1)[0]
        if (!value.includes("(0px)")) array = [value, ...array]
    }

    const newFilter: string = array.join(" ")
    return newFilter
}

// get selection range start to end or cursor pos
export function getSelectionRange(): { start: number; end: number }[] {
    const selection: null | Selection = window.getSelection()
    const sel: any[] = []
    if (!selection?.anchorNode) return sel

    const anchorElem = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? (selection.anchorNode as Element) : selection.anchorNode.parentElement
    const parent = anchorElem?.closest(".edit")
    if (!parent) return sel

    const lines = Array.from(parent.childNodes)
    if (!lines.length) return sel
    lines.forEach((_line, i) => (sel[i] = {}))

    const lineLength = (lineNode: Node) => {
        const text = (lineNode as HTMLElement).innerText ?? lineNode.textContent ?? ""
        return text.replaceAll("\n", "").length
    }

    const getBoundary = (node: Node, offset: number) => {
        const lineIndex = lines.findIndex((line) => line === node || line.contains(node))
        if (lineIndex < 0) return null

        const line = lines[lineIndex]
        const range = document.createRange()
        range.setStart(line, 0)

        try {
            range.setEnd(node, offset)
        } catch (_err) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const safeOffset = Math.max(0, Math.min((node as Element).childNodes.length, offset))
                range.setEnd(node, safeOffset)
            } else {
                const textLen = node.textContent?.length ?? 0
                const safeOffset = Math.max(0, Math.min(textLen, offset))
                range.setEnd(node, safeOffset)
            }
        }

        return { line: lineIndex, pos: range.toString().replaceAll("\n", "").length }
    }

    if (!selection.rangeCount) return sel
    const range = selection.getRangeAt(0)
    const start = getBoundary(range.startContainer, range.startOffset)
    const end = getBoundary(range.endContainer, range.endOffset)
    if (!start || !end) return sel

    if (selection.isCollapsed) {
        sel[start.line] = { start: start.pos, end: start.pos }
        return sel
    }

    for (let i = start.line; i <= end.line; i++) {
        if (i === start.line && i === end.line) {
            sel[i] = { start: start.pos, end: end.pos }
        } else if (i === start.line) {
            sel[i] = { start: start.pos, end: lineLength(lines[i]) }
        } else if (i === end.line) {
            sel[i] = { start: 0, end: end.pos }
        } else {
            sel[i] = { start: 0, end: lineLength(lines[i]) }
        }
    }

    return sel
}

// return item style at text length pos
export function getItemStyleAtPos(lines: Line[], pos: null | { start: number; end: number }[]) {
    let style = ""
    const iter = pos || lines
    if (!Array.isArray(iter)) return style

    iter.forEach((_a: any, i: number) => {
        let currentPos = 0
        const textArr = lines[i]?.text
        if (!Array.isArray(textArr)) return

        textArr.some((text) => {
            const value = text.value || ""

            // if (pos) console.log(currentPos, pos[i].end, currentPos <= pos[i].end, currentPos + value.length >= pos[i].end)
            if (pos?.[i] && currentPos <= pos[i].end && currentPos + value.length >= pos[i].end) {
                style = text.style || ""
                return true
            }

            currentPos += value.length
            return false
        })
    })

    // filter out empty lines
    lines = lines.filter((a) => a?.text?.length)

    if (!style.length && lines.length) style = lines[lines.length - 1].text[lines[lines.length - 1].text.length - 1]?.style || ""

    return style
}

// get item align at selected pos
export function getLastLineAlign(item: Item, selection: any): string {
    if (!selection?.length) return item?.lines?.[0]?.align || ""

    let last = ""
    if (Array.isArray(item?.lines)) {
        item.lines.forEach((line, i) => {
            if (!selection || selection[i]?.start !== undefined) last = line.align
        })
    }
    return last
}

// normally returns array of text lines: ["Line 1", "Line 2", "", "Line 1"]
// itemSeperated: ["Line 1<br>Line 2", "Line 1"]
export function getTextLines(slide: Slide | { items: Item[] }, itemSeperated: boolean = false) {
    if (!Array.isArray(slide?.items)) return []

    const items: string[][] = []
    slide.items.forEach((item) => {
        if (!getItemText(item)?.length) return
        const lines: string[] = []

        let fullText = ""
        item.lines?.forEach((line) => {
            if (!Array.isArray(line?.text)) return

            let lineText = ""
            line.text.forEach((content) => {
                // remove any dynamic values
                lineText += content.value.replace(/\{[^}]*\}/g, "")
            })

            if (lineText.length) lines.push(lineText)
            fullText += lineText
        })

        if (!fullText.length) lines.pop()
        if (lines.length || itemSeperated) items.push(lines.map((a) => replaceVirtualBreaks(a)))
    })

    if (itemSeperated) {
        // convert [["Line 1, Line 2"], ["Line 1"]] to ["Line 1<br>Line 2", "Line 1"]
        return items.map((a) => a.join("<br>"))
    }

    // flatten and push "" in between
    return items.reduce((value, item) => {
        if (value.length && item.length) value.push("")
        return [...value, ...item]
    }, [] as string[])
}

// get text of slides
export function getSlidesText(slides: { [key: string]: Slide }) {
    return Object.values(slides).reduce((value, slide) => (value += getSlideText(slide)), "")
}

// get text of slide
export function getSlideText(slide: Slide) {
    if (!slide?.items?.length) return ""
    return slide.items.reduce((value, item) => (value += getItemText(item)), "")
}

// get text of item.text...
export function getItemText(item: Item | null): string {
    let text = ""

    const lines = item?.lines
    if (Array.isArray(lines)) {
        for (const line of lines) {
            const textArr = line.text
            if (Array.isArray(textArr)) {
                for (const t of textArr) {
                    if (t.value) text += t.value
                }
            }
        }
    }

    return text
}

export function getItemTextArray(item: Item): string[] {
    const text: string[] = []
    if (!Array.isArray(item?.lines)) return []

    item.lines.forEach((line) => {
        if (!Array.isArray(line?.text)) return

        line.text.forEach((content) => {
            text.push(content.value)
        })
    })

    return text
}

export function getLineText(line: Line): string {
    let text = ""
    const textArr = line?.text
    if (!Array.isArray(textArr)) return ""
    textArr.forEach((content) => {
        text += content.value
    })
    return text
}

export function setCaret(element: any, { line = 0, pos = 0 }, toEnd = false) {
    if (!element) return
    const range = document.createRange()
    const sel = window.getSelection()

    const lineElem = element.childNodes[line]
    if (!lineElem) return

    // get child elem
    let childElem = -1
    let currentTextLength = 0
    lineElem.childNodes.forEach((elem, i) => {
        if (!elem?.innerText || childElem >= 0) return
        if (pos <= currentTextLength + elem.innerText.length) {
            childElem = i
            return
        }
        currentTextLength += elem.innerText.length
    })

    // pasted on non-existent line
    if (childElem < 0) {
        childElem = lineElem.childNodes.length - 1
        pos = lineElem.childNodes[childElem]?.innerText?.length ?? 0
        currentTextLength = 0
    }

    // get end elem
    let endElemIndex = element.childNodes.length - 1
    let lastLineElem = element.childNodes[endElemIndex]
    while (!lastLineElem.childNodes.length && endElemIndex > 0) {
        endElemIndex--
        lastLineElem = element.childNodes[endElemIndex]
    }

    // get end child elem
    const lastEndChild = lastLineElem.childNodes[lastLineElem.childNodes.length - 1]
    if (!lastEndChild) return
    let currentEndTextLength = lastEndChild.innerText?.length ?? 0

    const breakElem = lastEndChild.childNodes[0]?.nodeName === "BR"
    if (line === 0 && breakElem) return

    const startElem = lineElem.childNodes[childElem]?.childNodes[0]
    const endElem = lastEndChild.childNodes[0]

    // If startElem is a BR element, set caret before it and not inside it
    if (startElem?.nodeName === "BR") {
        const parentSpan = lineElem.childNodes[childElem]
        try {
            range.setStart(parentSpan, 0)
        } catch {
            return
        }
    } else if (startElem) {
        const offset = pos - currentTextLength
        const startElemLength = startElem.length ?? startElem.textContent?.length ?? 0
        const safeStartOffset = Math.max(0, Math.min(startElemLength, offset))
        try {
            range.setStart(startElem, safeStartOffset)
        } catch {
            return
        }
    }
    if (toEnd) {
        let safeEndOffset = 0
        if (endElem?.nodeType === Node.TEXT_NODE) {
            safeEndOffset = Math.max(0, Math.min(endElem.length ?? endElem.textContent?.length ?? 0, currentEndTextLength))
        } else if (endElem?.nodeType === Node.ELEMENT_NODE) {
            safeEndOffset = Math.max(0, Math.min(endElem.childNodes.length, currentEndTextLength))
        }
        try {
            range.setEnd(endElem, safeEndOffset)
        } catch {
            return
        }
    } else range.collapse(true)

    sel?.removeAllRanges()
    sel?.addRange(range)
}

export function setCaretAtEnd(elem: any) {
    const range = document.createRange()
    range.selectNodeContents(elem)
    range.collapse(false)

    const sel = window.getSelection()
    if (!sel) return

    sel.removeAllRanges()
    sel.addRange(range)
}
