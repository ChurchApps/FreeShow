export function pasteText(elem: any) {
    if (!elem?.classList?.contains("edit")) return

    navigator.clipboard.readText().then((clipText: string) => {
        // format html escape characters
        clipText = clipText.toString()
        if (elem.nodeName === "INPUT" || elem.nodeName === "TEXTAREA") elem.value = insertValue(elem, clipText)
        else pasteInDom(elem, clipText)
    })
}

function insertValue(elem: any, text: string) {
    const value: string = elem.value
    if (!text) return value

    const caretPos = getCaretPos(elem)

    const newValue = value.slice(0, caretPos.start) + text + value.slice(caretPos.end)

    // set new position
    const newCaretPos = caretPos.start + text.length
    setTimeout(() => {
        elem.selectionStart = elem.selectionEnd = newCaretPos
        // send event so inputs can update values
        elem.dispatchEvent(new Event("change"))
        elem.dispatchEvent(new Event("input"))
    }, 10)

    return newValue
}

function getCaretPos(elem: any) {
    // let selection = window.getSelection()
    const start = elem.selectionStart
    const end = elem.selectionEnd

    return { start, end }
}

// inset in dom
function pasteInDom(elem: any, text: any) {
    if (!elem.innerHTML || !text) return

    // const caretPos = Cursor.getCurrentCursorPosition(elem)
    // const range = Cursor._createRange(elem, caretPos)

    // previous
    elem.innerHTML += text
}
