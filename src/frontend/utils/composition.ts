/**
 * A key press that belongs to an IME candidate window rather than to the text.
 *
 * While a Chinese/Japanese/Korean IME is composing, Enter and Space pick a
 * candidate and Backspace edits the pre-edit buffer — none of them are text or
 * line edits, and none of them should reach an app shortcut.
 * `keyCode === 229` is the fallback for engines that leave `isComposing` unset
 * on keydown.
 */
export function isComposingKey(e: KeyboardEvent): boolean {
    return e.isComposing || e.keyCode === 229
}
