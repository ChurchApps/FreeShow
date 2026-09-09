export interface TranscriberSegment {
    text: string
    startMs: number
    endMs: number
    language?: string
    music?: boolean
    utteranceEnd?: boolean
    confidence?: number // 0-100, how sure the engine was of these words (streaming engine only)
    glue?: boolean // continues the previous segment's last word: a comma or a plural that arrived after it settled
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
            rowMin = Math.min(rowMin, row[j])
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

    const max = Math.min(previous.length, words.length, SEAM_MATCH_MAX_WORDS)
    for (let length = max; length >= 1; length--) {
        let matches = true
        let anchors = 0
        for (let i = 0; i < length; i++) {
            const prev = previous[previous.length - length + i]
            const curr = current[i]
            const anchored = Boolean(curr && (prev === curr || wordsPrefixPair(prev, curr)))
            if (!curr || (i === 0 ? !anchored : !wordsRoughlyEqual(prev, curr))) {
                matches = false
                break
            }
            if (anchored) anchors++
        }
        if (matches && anchors >= Math.ceil(length / 2)) {
            return words.slice(length).join(" ")
        }
    }

    return words.join(" ")
}

// Track the emitted tail the next trim compares against.
export function appendTailWords(tail: string[], text: string): string[] {
    return [...tail, ...text.split(/\s+/).filter(Boolean)].slice(-SEAM_MATCH_MAX_WORDS)
}

// REPETITION - a greedy RNN-T can lock into a cycle and emit the same phrase indefinitely.
// Preachers repeat deliberately, so the thresholds sit well above rhetorical repetition.

const MAX_PHRASE_TOKENS = 8

function minRepeatsFor(phraseTokens: number): number {
    if (phraseTokens === 1) return 8
    if (phraseTokens === 2) return 6
    return 4
}

function tokenizeWithOffsets(text: string): { text: string; at: number }[] {
    const pattern = /\S+/g
    const tokens: { text: string; at: number }[] = []
    let match: RegExpExecArray | null

    while ((match = pattern.exec(text)) !== null) {
        const normalized = match[0].toLowerCase().replace(/[^\p{L}\p{N}']/gu, "")
        if (normalized) tokens.push({ text: normalized, at: match.index })
    }
    return tokens
}

export function findRepeatedTail(text: string): number {
    const tokens = tokenizeWithOffsets(text)
    if (tokens.length < 8) return -1

    for (let size = 1; size <= MAX_PHRASE_TOKENS; size++) {
        const needed = minRepeatsFor(size)
        if (tokens.length < size * needed) continue

        const phrase = tokens
            .slice(-size)
            .map((t) => t.text)
            .join(" ")
        let repeats = 1
        let start = tokens.length - size

        while (start >= size) {
            const previous = tokens
                .slice(start - size, start)
                .map((t) => t.text)
                .join(" ")
            if (previous !== phrase) break
            start -= size
            repeats++
        }

        if (repeats >= needed) return tokens[start + size].at
    }
    return -1
}

// CONFIDENCE - the recognizer's own probability for the tokens behind a committed stretch of text.
// tokens.join("") is the result text with a leading space, so a character range of the text is
// the same range of the join shifted by that lead.

export function segmentConfidence(tokens: string[], logProbs: number[], text: string, from: number, to: number): number | undefined {
    if (!tokens.length || tokens.length !== logProbs.length || to <= from) return undefined

    const joined = tokens.join("")
    if (joined.trim() !== text) return undefined

    const lead = joined.length - joined.trimStart().length
    const start = from + lead
    const end = to + lead

    let sum = 0
    let count = 0
    let cursor = 0

    for (let i = 0; i < tokens.length; i++) {
        const next = cursor + tokens[i].length
        if (next > start && cursor < end) {
            sum += logProbs[i]
            count++
        }
        cursor = next
        if (cursor >= end) break
    }

    return count ? Math.round(Math.exp(sum / count) * 100) : undefined
}

// MUSIC - the model labels non-speech ("[MUSIC PLAYING]", "(upbeat music)") rather than inventing words for it.
// Shown in the transcript, never fed to detection.

const MUSIC_WORDS = /\b(music|musical|singing|sung|song|songs|instrumental|humming|chanting|applause|cheering)\b/i

export function isMusicAnnotation(text: string): boolean {
    if (/[♪♫]/.test(text)) return true

    // a label can arrive split across segments, so the closing bracket is optional at the end of the text
    const labels = text.match(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|[[(*][^\])*]*$/g)
    if (!labels) return false
    return labels.some((label) => MUSIC_WORDS.test(label))
}
