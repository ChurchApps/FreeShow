import type { Item, Line, Slide } from "../../../../types/Show"
import { replaceVirtualBreaks } from "../../../show/slides"

// add new style to text by selection
export function addStyle(selection: { start: number; end: number }[], item: Item, style: string | any[]): Item {
    item.lines?.forEach((line, i) => {
        const newText: any[] = []
        let pos = 0
        if (selection[i]?.start !== undefined) {
            line.text?.forEach((text) => {
                const length: number = text.value.length
                let from = 0
                let to = length
                if (pos < selection[i].start && pos + length > selection[i].start) from = selection[i].start - pos
                if (pos < selection[i].end && pos + length > selection[i].end) to = selection[i].end - pos

                if ((pos < selection[i].start && pos + length > selection[i].start) || (pos < selection[i].end && pos + length > selection[i].end) || (pos >= selection[i].start && pos + length <= selection[i].end)) {
                    if (from > 0) newText.push({ value: text.value.slice(0, from), style: text.style })
                    if (to - from > 0 && to - from <= length) {
                        let newStyle = ""
                        if (Array.isArray(style)) newStyle = addStyleString(text.style, style)
                        else newStyle = style
                        newText.push({ value: text.value.slice(from, to), style: newStyle })
                    }
                    if (to < length) newText.push({ value: text.value.slice(to, length), style: text.style })
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
    item.lines?.forEach((line) => {
        const a = [...(line.text || [])]
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
    let array: string[] = oldStyle.split(";")
    // remove last if empty
    if (!array[array.length - 1].length) array.pop()
    // remove old styles
    array.forEach((s, i) => {
        if (s.split(":")[0].trim() === style[0] || !s.length) array.splice(i, 1)
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
    let start: null | number = null
    let end: null | number = null

    if (!selection?.anchorNode) return sel

    const parent: Element = selection.anchorNode.parentElement!.closest(".edit")!
    let startNode = selection.anchorNode.parentNode
    let endNode = selection.focusNode?.parentNode
    const startOffset = selection.anchorOffset
    let endOffset = selection.focusOffset

    // selecting empty lines
    if (endNode?.classList.contains("break")) endNode = endNode.children[0]
    if (startNode?.classList.contains("break")) startNode = startNode.children[0]

    if (!parent?.closest(".edit")) return sel

    new Array(...parent.childNodes).forEach((br, line: number) => {
        if (!sel[line]) sel[line] = {}
        let count = 0

        new Array(...br.childNodes).forEach((child: any) => {
            if (selection.containsNode(child, true)) {
                // if start not set & child is start & (child is not end or end is bigger than start)
                if (start === null && child === startNode && (child !== endNode || endOffset > startOffset)) {
                    start = count + startOffset
                    sel[line].start = start
                } else if ((start === null && child === endNode) || (child === startNode && startOffset > endOffset)) {
                    start = count + endOffset
                    sel[line].start = start
                    endNode = startNode
                    startNode = selection.focusNode?.parentNode || null
                    endOffset = startOffset
                }

                if (start !== null) {
                    if (!sel[line].start) sel[line].start = 0

                    // WIP empty lines: child is not startNode but should be (don't think it's an issue)
                    if ((child === startNode && child !== endNode) || selection.containsNode(child)) {
                        if (end === null) end = count
                        end += child.innerText?.length || 0
                        sel[line].end = end
                    } else {
                        end = count + endOffset
                        sel[line].end = end
                    }
                }
            }

            count += child.innerText?.replaceAll("\n", "")?.length || 0
        })
    })

    return sel
}

// return item style at text length pos
export function getItemStyleAtPos(lines: Line[], pos: null | { start: number; end: number }[]) {
    let style = ""
        ; (pos || lines).forEach((_a: any, i: number) => {
            let currentPos = 0
            lines[i]?.text?.some((text) => {
                // if (pos) console.log(currentPos, pos[i].end, currentPos <= pos[i].end, currentPos + text.value.length >= pos[i].end)
                if (pos?.[i] && currentPos <= pos[i].end && currentPos + text.value.length >= pos[i].end) {
                    style = text.style
                    return true
                }

                currentPos += text.value.length
                return false
            })
        })

    // filter out empty lines
    lines = lines.filter((a) => a.text.length)

    if (!style.length && lines.length) style = lines[lines.length - 1].text[lines[lines.length - 1].text.length - 1]?.style || ""

    return style
}

// get item align at selected pos
export function getLastLineAlign(item: Item, selection: any): string {
    if (!selection?.length) return item?.lines?.[0].align || ""

    let last = ""
    item?.lines?.forEach((line, i) => {
        if (!selection || selection[i]?.start !== undefined) last = line.align
    })
    return last
}

export function getTextLines(slide: Slide | { items: Item[] }) {
    const lines: string[] = []
    if (!slide?.items) return lines

    slide.items.forEach((item, i) => {
        if (!getItemText(item)?.length) return
        if (i > 0) lines.push("")

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
    })

    return lines.map((a) => replaceVirtualBreaks(a))
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
export function getItemText(item: Item): string {
    let text = ""
    if (!item?.lines) return ""

    item.lines.forEach((line) => {
        console.assert(Array.isArray(line?.text), "Text is not an array!")
        if (!Array.isArray(line?.text)) return

        line.text.forEach((content) => {
            text += content.value
        })
    })

    return text
}

export function getItemTextArray(item: Item): string[] {
    const text: string[] = []
    if (!item?.lines) return []

    item.lines.forEach((line) => {
        if (!line.text) return

        line.text.forEach((content) => {
            text.push(content.value)
        })
    })

    return text
}

export function getLineText(line: Line): string {
    let text = ""
    line?.text?.forEach((content) => {
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
        if (childElem >= 0) return
        if (pos <= currentTextLength + elem.innerText.length) {
            childElem = i
            return
        }
        currentTextLength += elem.innerText.length
    })

    // pasted on non-existent line
    if (childElem < 0) {
        childElem = lineElem.childNodes.length - 1
        pos = lineElem.childNodes[childElem].innerText.length
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
    const currentEndTextLength = lastEndChild.innerText.length

    const breakElem = lastEndChild.childNodes[0]?.nodeName === "BR"
    if (line === 0 && breakElem) return

    const startElem = lineElem.childNodes[childElem].childNodes[0]
    const endElem = lastEndChild.childNodes[0]

    range.setStart(startElem, pos - currentTextLength)
    if (toEnd) range.setEnd(endElem, currentEndTextLength)
    else range.collapse(true)

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
