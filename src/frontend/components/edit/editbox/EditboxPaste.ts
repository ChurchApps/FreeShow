import type { Line, Item } from "../../../../types/Show"
import { EditboxHelper } from "./EditboxHelper"
import { getSelectionRange, setCaret } from "../scripts/textStyle"
import { clone } from "../../helpers/array"

export interface EditboxPasteContext {
    item: Item
    ref: any
    textElem: HTMLElement | undefined
    lastCaretPos: { line: number; pos: number; lineLength: number }
    getNewLines: () => Line[]
    updateLines: (lines: Line[]) => void
    getStyle: () => void
    setPasting: (pasting: boolean) => void
}

export class EditboxPaste {
    static getSelectedTextElements(lines: Line[], sel: { start?: number; end?: number }[]): { value: string; style: string; customType?: string; sourceDynamicKey?: string }[] {
        let result: any[] = []

        sel.forEach((lineSel, lineIndex) => {
            if (lineSel.start === undefined || lineSel.end === undefined || !lines[lineIndex]) return

            const selStart = lineSel.start
            const selEnd = lineSel.end

            let linePos = 0
            lines[lineIndex].text?.forEach((text) => {
                let value = text.value
                let newLinePos = linePos + value.length

                const intersectStart = Math.max(selStart, linePos)
                const intersectEnd = Math.min(selEnd, newLinePos)

                if (intersectStart < intersectEnd) {
                    const selectedVal = value.slice(intersectStart - linePos, intersectEnd - linePos)
                    result.push({
                        value: selectedVal,
                        style: text.style || "",
                        customType: text.customType,
                        sourceDynamicKey: text.sourceDynamicKey
                    })
                }

                linePos = newLinePos
            })

            if (lineIndex < sel.length - 1 && sel[lineIndex + 1].start !== undefined) {
                result.push({ value: "\n", style: "" })
            }
        })

        return result
    }

    static handleCopy(e: ClipboardEvent, lines: Line[]) {
        const sel = getSelectionRange()
        const selectedElements = this.getSelectedTextElements(lines, sel)
        if (selectedElements.length > 0) {
            e.preventDefault()
            const text = selectedElements.map((el) => el.value).join("")
            const htmlString = selectedElements.map((el) => (el.value === "\n" ? "<br>" : `<span data-freeshow-text="true" style="${el.style || ""}" data-customtype="${el.customType || ""}" data-sourcedynamickey="${el.sourceDynamicKey || ""}">${el.value}</span>`)).join("")

            e.clipboardData?.setData("text/plain", text)
            e.clipboardData?.setData("text/html", htmlString)
        }
    }

    static handleCut(e: ClipboardEvent, lines: Line[], pasteFn: (e: any, text: string) => void) {
        this.handleCopy(e, lines)
        pasteFn(e, "")
    }

    static async handlePaste(e: any, ctx: EditboxPasteContext, forcePlain = false) {
        let text = ""
        let html = ""

        try {
            if (!forcePlain && navigator.clipboard?.read) {
                const items = await navigator.clipboard.read()
                let htmlPromise: Promise<string> | null = null
                let textPromise: Promise<string> | null = null

                for (const item of items) {
                    if (item.types.includes("text/html")) htmlPromise = item.getType("text/html").then((blob) => blob.text())
                    if (item.types.includes("text/plain")) textPromise = item.getType("text/plain").then((blob) => blob.text())
                }

                const resolved = await Promise.all([htmlPromise || Promise.resolve(""), textPromise || Promise.resolve("")])
                html = resolved[0]
                text = resolved[1]
            } else if (navigator.clipboard?.readText) {
                text = await navigator.clipboard.readText()
            }
        } catch (err) {
            console.warn("Could not read clipboard:", err)
            try {
                if (navigator.clipboard?.readText) text = await navigator.clipboard.readText()
            } catch (innerErr) {
                console.warn("Could not fallback read plain text:", innerErr)
            }
        }

        this.paste(e, text, html, ctx)
    }

    static parseHtmlToTextElements(html: string) {
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, "text/html")
        const body = doc.body
        const isInternal = doc.querySelector("[data-freeshow-text]") !== null
        const result: { value: string; style: string; customType?: string; sourceDynamicKey?: string }[] = []

        function traverse(node: Node, parentStyle: string, parentCustomType?: string, parentSourceDynamicKey?: string) {
            if (node.nodeType === Node.TEXT_NODE) {
                const textVal = node.textContent || ""
                if (textVal) {
                    result.push({
                        value: textVal,
                        style: parentStyle,
                        customType: parentCustomType,
                        sourceDynamicKey: parentSourceDynamicKey
                    })
                }
                return
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement
                const tagName = element.tagName.toLowerCase()

                let currentStyle = parentStyle
                let customType = parentCustomType
                let sourceDynamicKey = parentSourceDynamicKey

                if (isInternal) {
                    const styleAttr = element.getAttribute("style") || ""
                    const customIndex = styleAttr.indexOf("--custom:true")
                    currentStyle = customIndex > -1 ? styleAttr.slice(0, customIndex).replace(/;$/, "") : styleAttr
                    customType = element.getAttribute("data-customtype") || customType
                    sourceDynamicKey = element.getAttribute("data-sourcedynamickey") || sourceDynamicKey
                } else {
                    const styleLower = element.getAttribute("style")?.toLowerCase() || ""
                    const hasProp = (prop: string, tagNames: string[], regex: RegExp) => tagNames.includes(tagName) || regex.test(styleLower) || parentStyle.includes(prop)

                    let accumulatedStyle = ""
                    if (hasProp("font-weight: bold", ["b", "strong"], /font-weight:\s*(bold|700)/)) accumulatedStyle += "font-weight: bold;"
                    if (hasProp("font-style: italic", ["i", "em"], /font-style:\s*italic/)) accumulatedStyle += "font-style: italic;"
                    if (hasProp("text-decoration: underline", ["u", "ins"], /text-decoration:\s*underline/)) accumulatedStyle += "text-decoration: underline;"
                    currentStyle = accumulatedStyle
                }

                if (tagName === "br") {
                    result.push({ value: "\n", style: currentStyle, customType, sourceDynamicKey })
                    return
                }

                const isBlock = ["div", "p", "tr", "li", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)
                if (isBlock && result.length > 0 && !result[result.length - 1].value.endsWith("\n")) {
                    result.push({ value: "\n", style: currentStyle, customType, sourceDynamicKey })
                }

                node.childNodes.forEach((child) => traverse(child, currentStyle, customType, sourceDynamicKey))

                if (isBlock && result.length > 0 && !result[result.length - 1].value.endsWith("\n")) {
                    result.push({ value: "\n", style: currentStyle, customType, sourceDynamicKey })
                }
            }
        }

        body.childNodes.forEach((child) => traverse(child, "", undefined, undefined))
        return result
    }

    static paste(e: any, clipboardText = "", clipboardHtml = "", ctx: EditboxPasteContext) {
        const htmlData = clipboardHtml || e.clipboardData?.getData("text/html")
        let pastedElements = htmlData ? this.parseHtmlToTextElements(htmlData) : []
        let clipboard = pastedElements.map((el) => el.value).join("")

        if (!pastedElements.length) {
            clipboard = clipboardText || e.clipboardData?.getData("text/plain") || ""
            if (!clipboard) return
            pastedElements = [{ value: clipboard, style: "" }]
        }

        ctx.setPasting(true)

        let sel = getSelectionRange()
        if (!sel.length && ctx.lastCaretPos.line > -1) {
            const linesLength = ctx.getNewLines().length
            sel = [...Array(linesLength)].map((_, i) => (i === ctx.lastCaretPos.line ? { start: ctx.lastCaretPos.pos, end: ctx.lastCaretPos.pos } : ({} as any)))
        }
        let caret = { line: 0, pos: 0 }
        let emptySelection = !sel.filter((a) => Object.keys(a).length).length

        let lines: Line[] = ctx.getNewLines()
        let newLines: any[] = []
        let pastingIndex = -1
        sel.forEach((lineSel, lineIndex) => {
            if (!lines[lineIndex]) return
            if (lineSel.start === undefined && (!emptySelection || lineIndex < sel.length - 1)) {
                newLines.push(lines[lineIndex])
                return
            }

            if (pastingIndex < 0) {
                pastingIndex = lineIndex
                let splitted = clipboard.split("\n")
                let lastPastedLine = pastingIndex + (splitted.length - 1)
                let pos = lineSel.start + clipboard.length
                if (splitted.length > 1) pos = splitted[splitted.length - 1].trim().length
                caret = { line: lastPastedLine, pos }
            }

            let lineText: any[] = []
            let linePos = 0
            let pasteOverflow = 0
            let hasPasted = true

            lines[lineIndex].text?.forEach((text) => {
                let value = text.value
                let newLinePos = linePos + value.length
                if (newLinePos < lineSel.start || linePos > lineSel.end) {
                    lineText.push(text)
                    linePos = newLinePos
                    return
                }

                if (pasteOverflow > 0) {
                    let newValue = value.slice(pasteOverflow)
                    pasteOverflow = pasteOverflow - value.length
                    if (!newValue.length) return

                    text.value = newValue
                    lineText.push(text)
                    return
                }

                let caretPos = lineSel.start - linePos
                let removeText = lineSel.end - lineSel.start
                removeText = removeText > 0 ? removeText : 0
                pasteOverflow = caretPos + removeText - value.length

                const beforeVal = value.slice(0, caretPos)
                const afterVal = value.slice(caretPos + removeText)

                if (pastingIndex === lineIndex && hasPasted) {
                    if (beforeVal.length > 0) {
                        lineText.push({ ...text, value: beforeVal })
                    }

                    pastedElements.forEach((pEl) => {
                        lineText.push({
                            style: pEl.style || text.style || "",
                            value: pEl.value,
                            customType: pEl.customType || text.customType,
                            sourceDynamicKey: pEl.sourceDynamicKey || text.sourceDynamicKey
                        })
                    })

                    if (afterVal.length > 0) {
                        lineText.push({ ...text, value: afterVal })
                    }
                    hasPasted = false
                } else {
                    let newValue = beforeVal + afterVal
                    if (newValue.length > 0) {
                        lineText.push({ ...text, value: newValue })
                    }
                }

                linePos = newLinePos
            })

            if (pastingIndex < 0) {
                newLines.push(lines[lineIndex])
                return
            }

            if (!newLines[pastingIndex]?.text) {
                newLines[pastingIndex] = clone(lines[lineIndex])
                newLines[pastingIndex].text = lineText
            } else {
                newLines[pastingIndex].text.push(...lineText)
            }
        })

        lines = newLines

        lines = EditboxHelper.splitAllCrlf(lines)
        ctx.updateLines(lines)
        setTimeout(() => {
            ctx.getStyle()
            setTimeout(() => {
                if (ctx.textElem) setCaret(ctx.textElem, caret)
                ctx.setPasting(false)
            }, 10)
        }, 10)
    }
}
