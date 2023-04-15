import { Cursor } from "../edit/scripts/Cursor"

export function pasteText(elem: any) {
    if (!elem?.classList?.contains("edit")) return

    navigator.clipboard.readText().then((clipText: string) => {
        // TODO: (mac) undo/redo text
        if (elem.nodeName === "INPUT" || elem.nodeName === "TEXTAREA") elem.value = insertValue(elem, clipText)
        else pasteInDom(elem, clipText)
    })
}

function insertValue(elem: any, text: string) {
    let value: string = elem.value
    if (!text) return value

    let caretPos = getCaretPos(elem)
    console.log(caretPos)

    let newValue = value.slice(0, caretPos.start) + text + value.slice(caretPos.end)

    // set new position
    let newCaretPos = caretPos.start + text.length
    setTimeout(() => {
        elem.selectionStart = elem.selectionEnd = newCaretPos
    }, 10)

    return newValue
}

function getCaretPos(elem: any) {
    // let selection = window.getSelection()
    let start = elem.selectionStart
    let end = elem.selectionEnd

    return { start, end }
}

// inset in dom
function pasteInDom(elem: any, text: any) {
    if (!elem.innerHTML || !text) return

    console.log(elem)

    let caretPos = Cursor.getCurrentCursorPosition(elem)
    console.log(caretPos)
    let range = Cursor._createRange(elem, caretPos)
    console.log(range)

    // previous
    elem.innerHTML += text
}
