// Credit to Liam (Stack Overflow)
// https://stackoverflow.com/a/41034697/3480193
export class Cursor {
    static getCurrentCursorPosition(parentElement: any) {
        const selection = window.getSelection()
        let charCount = -1
        let node

        if (selection?.focusNode) {
            if (Cursor._isChildOf(selection.focusNode, parentElement)) {
                node = selection.focusNode
                charCount = selection.focusOffset

                while (node) {
                    if (node === parentElement) {
                        break
                    }

                    if (node.previousSibling) {
                        node = node.previousSibling
                        charCount += node.textContent!.length
                    } else {
                        node = node.parentNode
                        if (node === null) {
                            break
                        }
                    }
                }
            }
        }

        return charCount
    }

    static setCurrentCursorPosition(chars: number, element: any) {
        if (chars >= 0) {
            const selection = window.getSelection()

            const range = Cursor._createRange(element, { count: chars })

            if (range) {
                range.collapse(false)
                selection!.removeAllRanges()
                selection!.addRange(range)
            }
        }
    }

    static _createRange(node: any, chars: any, range: any = null) {
        if (!range) {
            range = document.createRange()
            range.selectNode(node)
            range.setStart(node, 0)
        }

        if (chars.count === 0) {
            range.setEnd(node, chars.count)
        } else if (node && chars.count > 0) {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.textContent.length < chars.count) {
                    chars.count -= node.textContent.length
                } else {
                    range.setEnd(node, chars.count)
                    chars.count = 0
                }
            } else {
                for (const childNode of node.childNodes) {
                    range = Cursor._createRange(childNode, chars, range)

                    if (chars.count === 0) {
                        break
                    }
                }
            }
        }

        return range
    }

    static _isChildOf(node: any, parentElement: any) {
        while (node !== null) {
            if (node === parentElement) {
                return true
            }
            node = node.parentNode
        }

        return false
    }
}
