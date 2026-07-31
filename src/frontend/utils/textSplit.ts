// Helpers for choosing where to break a long line of text across slides.
//
// Latin text can always fall back on spaces, so half-width punctuation was
// enough. Chinese and Japanese have no word spaces at all: without the
// full-width forms there is no break candidate anywhere in the line and the
// split lands mid-clause. See https://github.com/ChurchApps/FreeShow/issues/3550

/** Full-width sentence punctuation (Chinese, Japanese). */
export const CJK_SPLIT_PUNCTUATION = ["，", "。", "；", "：", "！", "？", "、"]

/** Half-width and full-width sentence punctuation. */
export const SPLIT_PUNCTUATION_REGEX = new RegExp(`[.,;:!?${CJK_SPLIT_PUNCTUATION.join("")}]`)

/**
 * Index just after the last sentence punctuation at or before `limit`, or -1.
 * Candidates that would leave nothing after the break are skipped. Used for
 * text with no spaces to break on.
 */
export function lastPunctuationBreak(text: string, limit: number) {
    for (let i = Math.min(limit, text.length - 1); i >= 0; i--) {
        if (!SPLIT_PUNCTUATION_REGEX.test(text[i])) continue

        const breakPos = includeTrailingClosing(text, i + 1)
        if (leavesContentOnBothSides(text, breakPos)) return breakPos
    }
    return -1
}

/**
 * Index just after the punctuation closest to `center`, searching only within
 * `margin` of it, or -1 when there is none. The index skips any closing quote
 * or bracket so those are never orphaned onto the next line.
 */
export function nearestPunctuationBreak(text: string, chars: string[], center: number, margin: number) {
    let best = -1
    let bestDistance = Infinity

    const from = Math.max(0, Math.floor(center - margin))
    const to = Math.min(text.length - 1, Math.ceil(center + margin))

    for (let i = from; i <= to; i++) {
        if (!chars.includes(text[i])) continue

        const distance = Math.abs(i - center)
        if (distance >= bestDistance) continue

        const breakPos = includeTrailingClosing(text, i + 1)
        if (!leavesContentOnBothSides(text, breakPos)) continue

        bestDistance = distance
        best = breakPos
    }

    return best
}

/** Whether there is anything here besides whitespace and punctuation. */
export function hasContent(text: string) {
    return HAS_CONTENT.test(text)
}

/**
 * A break is only useful if both sides still hold something to read — breaking
 * before a leading "，" would put that mark on a slide of its own.
 */
function leavesContentOnBothSides(text: string, breakPos: number) {
    return hasContent(text.slice(0, breakPos)) && hasContent(text.slice(breakPos))
}

const HAS_CONTENT = /[^\s.,;:!?，。；：！？、「」『』（）《》〈〉【】〔〕]/

/**
 * Move a break position past any closing quote or bracket, so a line never
 * starts with an orphaned 」 or ）.
 */
export function includeTrailingClosing(text: string, index: number) {
    while (index < text.length && CLOSING_PUNCTUATION.includes(text[index])) index++
    return index
}

const CLOSING_PUNCTUATION = ["」", "』", "）", "》", "〉", "】", "〕"]
