import type { Item, Line, Slide } from "../../../../types/Show"

// add new style to text by selection
export function addStyle(selection: { start: number; end: number }[], item: Item, style: string | any[]): Item {
    item.lines?.forEach((line, i) => {
        let newText: any[] = []
        let pos: number = 0
        if (selection[i]?.start !== undefined) {
            line.text?.forEach((text: any) => {
                const length: number = text.value.length
                let from = 0
                let to = length
                if (pos < selection[i].start && pos + length > selection[i].start) from = selection[i].start - pos
                if (pos < selection[i].end && pos + length > selection[i].end) to = selection[i].end - pos

                if ((pos < selection[i].start && pos + length > selection[i].start) || (pos < selection[i].end && pos + length > selection[i].end) || (pos >= selection[i].start && pos + length <= selection[i].end)) {
                    if (from > 0) newText.push({ value: text.value.slice(0, from), style: text.style })
                    if (to - from > 0 && to - from <= length) {
                        let newStyle: string = ""
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
        let a = [...(line.text || [])]
        for (let i = 0; i < a.length; i++) {
            if (a[i + 1]) {
                let d1: any[] = [],
                    d2: any[] = []
                let sameStyles: boolean = false
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
        let fontFamilyIndex = array.findIndex((a) => a.includes("font-family"))
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
    let perspectiveIndex = array.findIndex((a) => a.includes("perspective"))
    if (perspectiveIndex >= 0) {
        let value = array.splice(perspectiveIndex, 1)[0]
        if (!value.includes("(0px)")) array = [value, ...array]
    }

    let newFilter: string = array.join(" ")
    return newFilter
}

// get selection range start to end or cursor pos
export function getSelectionRange(): { start: number; end: number }[] {
    let selection: null | Selection = window.getSelection()
    let sel: any[] = []
    let start: null | number = null
    let end: null | number = null

    if (!selection?.anchorNode) return sel

    let parent: Element = selection.anchorNode.parentElement!.closest(".edit")!
    let startNode = selection.anchorNode.parentNode
    let endNode = selection.focusNode?.parentNode
    let startOffset = selection.anchorOffset
    let endOffset = selection.focusOffset

    // selecting empty lines
    if (endNode?.classList.contains("break")) endNode = endNode.children[0]
    if (startNode?.classList.contains("break")) startNode = startNode.children[0]

    if (!parent?.closest(".edit")) return sel

    new Array(...parent.childNodes).forEach((br: any, line: number) => {
        if (!sel[line]) sel[line] = {}
        let count: number = 0

        new Array(...br.childNodes).forEach((child: any) => {
            if (selection!.containsNode(child, true)) {
                // if start not set & child is start & (child is not end or end is bigger than start)
                if (start === null && child === startNode && (child !== endNode || endOffset > startOffset)) {
                    start = count + startOffset
                    sel[line].start = start
                } else if ((start === null && child === endNode) || (child === startNode && startOffset > endOffset)) {
                    start = count + endOffset
                    sel[line].start = start
                    endNode = startNode
                    startNode = selection!.focusNode?.parentNode!
                    endOffset = startOffset
                }

                if (start !== null) {
                    if (!sel[line].start) sel[line].start = 0

                    // WIP empty lines: child is not startNode but should be (don't think it's an issue)
                    if ((child === startNode && child !== endNode) || selection!.containsNode(child)) {
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
    let style: string = ""
    ;(pos || lines).forEach((_a: any, i: number) => {
        let currentPos: number = 0
        lines[i]?.text?.some((text): any => {
            // if (pos) console.log(currentPos, pos[i].end, currentPos <= pos[i].end, currentPos + text.value.length >= pos[i].end)
            if (pos && currentPos <= pos[i].end && currentPos + text.value.length >= pos[i].end) {
                style = text.style
                return true
            }
            currentPos += text.value.length
        })
    })

    // filter out empty lines
    lines = lines.filter((a) => a.text.length)

    if (!style.length && lines.length) style = lines[lines.length - 1].text[lines[lines.length - 1].text.length - 1]?.style || ""

    return style
}

// get item align at selected pos
export function getLastLineAlign(item: Item, selection: any): string {
    let last: string = ""
    item?.lines!.forEach((line: any, i: number) => {
        if (!selection || selection[i]?.start !== undefined) last = line.align
    })
    return last
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
    let text: string = ""
    if (!item?.lines) return ""

    item.lines.forEach((line) => {
        if (!line.text) return

        line.text.forEach((content) => {
            text += content.value
        })
    })

    return text
}

export function getItemTextArray(item: Item): string[] {
    let text: string[] = []
    if (!item?.lines) return []

    item.lines.forEach((line) => {
        if (!line.text) return

        line.text.forEach((content) => {
            text.push(content.value)
        })
    })

    return text
}

// get chords map
export function getItemChords(item: Item): string {
    let text: string = ""
    if (!Array.isArray(item?.lines)) return ""

    item.lines.forEach((line) => {
        if (!line.chords?.length) return

        line.chords.forEach((chord) => {
            text += chord.key
        })
    })

    return text
}

export function getLineText(line: any): string {
    let text: string = ""
    line?.text?.forEach((content: any) => {
        text += content.value
    })
    return text
}

// seperate text with breaks
export function getItemLines(item: Item): string[] {
    let lines: string[] = []
    item.lines?.forEach((line) => {
        let text = ""
        line.text?.forEach((content) => (text += content.value))
        lines.push(text)
    })
    return lines
}

// get caret pos (WIP)
// https://stackoverflow.com/questions/4811822/get-a-ranges-start-and-end-offsets-relative-to-its-parent-container/4812022#4812022
export function getCaretCharacterOffsetWithin(element: any) {
    var caretOffset = 0
    var doc = element.ownerDocument || element.document
    var win = doc.defaultView || doc.parentWindow
    var sel
    if (typeof win.getSelection !== "undefined") {
        sel = win.getSelection()
        if (sel.rangeCount > 0) {
            var range = win.getSelection().getRangeAt(0)
            var preCaretRange = range.cloneRange()
            preCaretRange.selectNodeContents(element)
            preCaretRange.setEnd(range.endContainer, range.endOffset)
            caretOffset = preCaretRange.toString().length
        }
    }
    return caretOffset
}

export function setCaret(element: any, { line = 0, pos = 0 }, toEnd: boolean = false) {
    if (!element) return
    var range = document.createRange()
    var sel = window.getSelection()

    let lineElem = element.childNodes[line]
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
    let lastEndChild = lastLineElem.childNodes[lastLineElem.childNodes.length - 1]
    let currentEndTextLength = lastEndChild.innerText.length

    let breakElem = lastEndChild.childNodes[0]?.nodeName === "BR"
    if (line === 0 && breakElem) return

    let startElem = lineElem.childNodes[childElem].childNodes[0]
    let endElem = lastEndChild.childNodes[0]

    range.setStart(startElem, pos - currentTextLength)
    if (toEnd) range.setEnd(endElem, currentEndTextLength)
    else range.collapse(true)

    sel?.removeAllRanges()
    sel?.addRange(range)
}

// https://stackoverflow.com/questions/6249095/how-to-set-the-caret-cursor-position-in-a-contenteditable-element-div
function createRange(node: any, pos: number, range: any = null) {
    if (!range) {
        range = document.createRange()
        range.selectNode(node)
        range.setStart(node, 0)
    }

    if (pos === 0) {
        range.setEnd(node, pos)
    } else if (node && pos > 0) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent.length < pos) {
                pos -= node.textContent.length
            } else {
                range.setEnd(node, pos)
                pos = 0
            }
        } else {
            for (var lp = 0; lp < node.childNodes.length; lp++) {
                range = createRange(node.childNodes[lp], pos, range)

                if (pos === 0) {
                    break
                }
            }
        }
    }

    return range
}
export function createRange2(node: any, selection: { start: number; end: number }[], range: any = null) {
    if (!range) {
        range = document.createRange()
        range.selectNode(node)
        range.setEnd(node, 0)
    }

    // console.log("CREATE RANGE: ", selection, range, node)

    let started = false
    let ended = false

    selection.forEach((a, i) => {
        if (a.start !== undefined && (!started || !ended)) {
            let br = node.children[i]
            let pos: null | number = 0
            if (br.childNodes.length) {
                new Array(...br.childNodes).forEach((text: any) => {
                    pos += text.innerText.length
                    if (!started && pos !== null && pos >= a.start) {
                        started = true
                        pos = null
                        range.setStart(text.firstChild, a.start)
                    }
                    if (!ended && pos !== null && pos >= a.end) {
                        ended = true
                        pos = null
                        range.setEnd(text.firstChild, a.end)
                    }
                })
            }
        }
    })

    return range
}
export function setCurrentCursorPosition(element: any, pos: number) {
    if (pos >= 0) {
        var selection = window.getSelection()

        // pos = 90
        // pos = 142
        let range: any = createRange(element, pos)

        // let range: any = createRange(element.childNodes[0], 5)

        if (range) {
            range.collapse(false)
            selection?.removeAllRanges()
            selection?.addRange(range)
        }
    }
}

export function setCaretPosition(elem: any, pos: number = 0) {
    if (elem.createTextRange) {
        var range = elem.createTextRange()
        range.move("character", pos)
        range.select()
    } else {
        elem.focus()
        if (elem.selectionStart) elem.setSelectionRange(pos, pos)
    }
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
