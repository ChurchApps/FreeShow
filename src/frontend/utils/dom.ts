// Small DOM predicates shared by the keyboard handling.
// Kept dependency free so it can be imported from anywhere without import cycles.

/**
 * A real form field the browser owns text editing for - not our contenteditable "edit" boxes.
 * Input types without a text selection model (number/time/date/color/range/checkbox) report
 * `selectionStart === null` and are excluded, as reading or setting a range on them throws.
 */
export function isTextField(elem: Element | null): elem is HTMLInputElement | HTMLTextAreaElement {
    if (!elem) return false
    if (elem.nodeName !== "INPUT" && elem.nodeName !== "TEXTAREA") return false

    try {
        return (elem as HTMLInputElement).selectionStart !== null
    } catch {
        return false
    }
}

// inputs without a text editing model - focusing a slider or color picker must not
// swallow the global keys (Delete/F2/Enter) or the Ctrl shortcuts
const NON_TEXT_INPUT_TYPES = ["button", "checkbox", "color", "file", "image", "radio", "range", "reset", "submit"]

/**
 * Anything the user could be typing into: text fields, contenteditable, or our "edit" elements.
 * Checking the "edit" class alone is not enough as not every text field in the app has it.
 */
export function isTypingTarget(elem: Element | null) {
    if (!elem) return false
    if (elem.nodeName === "INPUT") return !NON_TEXT_INPUT_TYPES.includes((elem as HTMLInputElement).type)
    if (elem.nodeName === "TEXTAREA") return true
    if ((elem as HTMLElement).isContentEditable) return true
    return elem.classList?.contains("edit") === true
}

/** Any form field the browser owns editing for, including the ones without a text selection model. */
export function isFormField(elem: Element | null): elem is HTMLInputElement | HTMLTextAreaElement {
    return elem?.nodeName === "INPUT" || elem?.nodeName === "TEXTAREA"
}

/** The selected text inside a form field, or "" when nothing is selected. */
export function getTextFieldSelection(elem: HTMLInputElement | HTMLTextAreaElement) {
    const start = elem.selectionStart ?? 0
    const end = elem.selectionEnd ?? 0
    if (start === end) return ""

    return (elem.value || "").slice(start, end)
}
