// AI AUTO SCRIPTURE - seam stitching, shared by both transcription drivers.
// Words at a decode seam (whisper's window overlap, nemotron's partial re-decodes) can be
// transcribed twice: timings shift between decodes, and word counts drift when a re-decode
// merges or splits a word. Each driver re-covers a little audio/text across the seam so no
// cut word is lost, and this trim drops the words that exactly repeat what was already emitted.

// how many words back the stitch looks for a repeated run
export const SEAM_MATCH_MAX_WORDS = 8

function normalizeWord(word: string): string {
    return word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "")
}

/** Drop leading words of `text` that exactly repeat the tail of what was already emitted. */
export function trimRepeatedLeadWords(previousTailWords: string[], text: string): string {
    const words = text.split(/\s+/).filter((word) => word.length)
    if (!words.length || !previousTailWords.length) return words.join(" ")

    const previous = previousTailWords.map(normalizeWord).filter((word) => word.length)
    const current = words.map(normalizeWord)

    // longest run of the previous tail that reappears at the head - punctuation/case insensitive
    let repeated = 0
    const max = Math.min(previous.length, words.length, SEAM_MATCH_MAX_WORDS)
    for (let length = max; length >= 1; length--) {
        let matches = true
        for (let i = 0; i < length; i++) {
            if (!current[i] || previous[previous.length - length + i] !== current[i]) {
                matches = false
                break
            }
        }
        if (matches) {
            repeated = length
            break
        }
    }

    return words.slice(repeated).join(" ")
}

/** Track the emitted tail the next trim compares against. */
export function appendTailWords(tail: string[], text: string): string[] {
    return [...tail, ...text.split(/\s+/).filter((word) => word.length)].slice(-SEAM_MATCH_MAX_WORDS)
}
