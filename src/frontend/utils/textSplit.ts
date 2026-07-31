// Helpers for choosing where to break a long line of text across slides.

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
        if (breakPos >= text.length) continue

        bestDistance = distance
        best = breakPos
    }

    return best
}

/**
 * Move a break position past any closing quote or bracket, so a line never
 * starts with an orphaned 」 or ）.
 */
export function includeTrailingClosing(text: string, index: number) {
    while (index < text.length && CLOSING_PUNCTUATION.includes(text[index])) index++
    return index
}

const CLOSING_PUNCTUATION = ["」", "』", "）", "》", "〉", "】", "〕"]
