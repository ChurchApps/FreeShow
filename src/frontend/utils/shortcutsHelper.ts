/// DOM checks for keyboard handling

export function copyFromTextField(elem: Element | null): boolean {
    if (!isTextField(elem)) return false

    const selection = getTextFieldSelection(elem)
    if (!selection) return false

    navigator.clipboard.writeText(selection)
    return true
}

// any editable form field
export function isFormField(elem: Element | null): elem is HTMLInputElement | HTMLTextAreaElement {
    return elem instanceof HTMLInputElement || elem instanceof HTMLTextAreaElement
}

// text input field, with actual editable text (excludes range, color, etc.)
function isTextField(elem: Element | null): elem is HTMLInputElement | HTMLTextAreaElement {
    if (!isFormField(elem)) return false

    try {
        return elem.selectionStart !== null
    } catch {
        return false
    }
}

// selected text in a form field
function getTextFieldSelection(elem: HTMLInputElement | HTMLTextAreaElement): string {
    const { selectionStart: start, selectionEnd: end, value } = elem
    if (!start || !end || start === end) return ""

    return value.slice(start, end)
}

const NON_TEXT_INPUT_TYPES = new Set(["button", "checkbox", "color", "file", "image", "radio", "range", "reset", "submit"])

// Anything the user could be typing into: text fields, contenteditable, or `.edit` elements.
export function isTypingTarget(elem: Element | null): boolean {
    if (!elem) return false
    if (elem instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(elem.type)
    if (elem instanceof HTMLTextAreaElement || (elem as HTMLElement).isContentEditable) return true

    return elem.classList.contains("edit")
}
