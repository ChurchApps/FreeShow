/// Presentation clicker keys

// Most USB presentation clickers send PageUp/PageDown or ArrowLeft/ArrowRight, which already change slides.
// Some send ArrowUp/ArrowDown instead, which normally change the active project item (show).
const UP_DOWN_SLIDE_KEYS: { [key: string]: "ArrowLeft" | "ArrowRight" } = {
    ArrowUp: "ArrowLeft",
    ArrowDown: "ArrowRight"
}

// the previous/next slide key to use for an ArrowUp/ArrowDown press, or null if it should keep its default behaviour
export function getUpDownSlideKey(key: string, enabled: boolean) {
    if (!enabled) return null
    return UP_DOWN_SLIDE_KEYS[key] || null
}
