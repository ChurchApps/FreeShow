/** A finished piece of transcript. Timings are relative to the start of the session. */
export interface TranscriberSegment {
    text: string
    startMs: number
    endMs: number
    language?: string
    music?: boolean
    utteranceEnd?: boolean
}

export interface TranscriptionDriver {
    start(): Promise<void>
    stop(): Promise<void>
    pushAudio(buffer: Uint8Array): void
}

export interface DriverCallbacks {
    onSegment: (segment: TranscriberSegment) => void
    onError: (message: string) => void
    onInterim?: (text: string) => void
}

export const SEAM_MATCH_MAX_WORDS = 8

function normalizeWord(word: string): string {
    return word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "")
}

// Edit distance capped at `maxEdits + 1` - the exact value above the cap never matters here.
function boundedEditDistance(a: string, b: string, maxEdits: number): number {
    if (Math.abs(a.length - b.length) > maxEdits) return maxEdits + 1

    let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
        const row = [i]
        let rowMin = i
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            row[j] = Math.min(previousRow[j] + 1, row[j - 1] + 1, previousRow[j - 1] + cost)
            if (row[j] < rowMin) rowMin = row[j]
        }
        if (rowMin > maxEdits) return maxEdits + 1
        previousRow = row
    }
    return previousRow[b.length]
}

// One word is the other's leading fragment - what a decode cut short at a seam leaves behind.
function wordsPrefixPair(a: string, b: string): boolean {
    return a.length >= 4 && b.length >= 4 && a.length !== b.length && (a.startsWith(b) || b.startsWith(a))
}

/**
 * A seam word can come back slightly different from the re-decode (a cut fragment and its whole
 * word, a shifted ending) - near-equality absorbs that, while short words still have to match
 * exactly. Expects normalized (lowercased, punctuation-stripped) words.
 */
export function wordsRoughlyEqual(a: string, b: string): boolean {
    if (a === b) return true
    if (a.length < 4 || b.length < 4) return false
    if (wordsPrefixPair(a, b)) return true

    const maxEdits = Math.max(a.length, b.length) >= 7 ? 2 : 1
    return boundedEditDistance(a, b, maxEdits) <= maxEdits
}

// Drop leading words of `text` that repeat the tail of what was already emitted.
export function trimRepeatedLeadWords(previousTailWords: string[], text: string): string {
    const words = text.split(/\s+/).filter(Boolean)
    if (!words.length || !previousTailWords.length) return words.join(" ")

    const previous = previousTailWords.map(normalizeWord).filter(Boolean)
    const current = words.map(normalizeWord)

    let repeated = 0
    const max = Math.min(previous.length, words.length, SEAM_MATCH_MAX_WORDS)
    for (let length = max; length >= 1; length--) {
        let matches = true
        let anchors = 0
        for (let i = 0; i < length; i++) {
            const previousWord = previous[previous.length - length + i]
            const word = current[i]
            const anchored = Boolean(word && (previousWord === word || wordsPrefixPair(previousWord, word)))
            if (!word || (i === 0 ? !anchored : !wordsRoughlyEqual(previousWord, word))) {
                matches = false
                break
            }
            if (anchored) anchors++
        }
        if (matches && anchors >= Math.ceil(length / 2)) {
            repeated = length
            break
        }
    }

    return words.slice(repeated).join(" ")
}

// Track the emitted tail the next trim compares against.
export function appendTailWords(tail: string[], text: string): string[] {
    return [...tail, ...text.split(/\s+/).filter(Boolean)].slice(-SEAM_MATCH_MAX_WORDS)
}
