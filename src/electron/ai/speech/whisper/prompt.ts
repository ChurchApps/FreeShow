// AI AUTO SCRIPTURE - whisper vocabulary biasing
// whisper conditions its decoder on a text prompt (whisper.cpp --prompt / server "prompt" field),
// which is the one model-side lever for words live speech recognition otherwise garbles: biblical
// names ("Amalekites" heard as "analekite") and KJV archaisms (thou, whence, wast, knowest).
// The prompt re-sends with every transcription window, so it can follow the preaching passage.

import { BIBLE_NAMES_BY_BOOK, BIBLE_NAMES_RANKED } from "./bibleVocabulary"

// whisper truncates prompts around 224 tokens (half its text context). Rare names tokenize at
// 3-4 BPE tokens each, so budget by characters with a conservative chars-per-token estimate.
const PROMPT_CHAR_BUDGET = 700

// a SYNTHETIC King James style sentence - archaic pronouns, inflections and function words that
// bias the decoder toward "thou knowest"/"whence"/"wast" instead of modern near-homophones.
// Deliberately not a real verse: the echo guard below drops segments that quote the prompt
// verbatim, which must never swallow a genuine recitation.
const STYLE_SENTENCE = "And he spake unto the people, saying, Verily thou knowest whence thou camest and whither thou goest; " + "hearken, O ye children, unto thy God which hath spoken, for whosoever believeth shall be made whole, and thou wast lost, and art found."

const NAMES_LEAD_IN = " Thus saith the LORD concerning "

/**
 * Compose the decoder-conditioning prompt: the KJV style sentence plus as many biblical names as
 * the budget allows. Names from the books currently being preached from come first - that is how
 * the long tail of ~5000 names gets covered despite the token cap.
 */
export function composeBiblePrompt(activeBooks: number[] = []): string {
    const names: string[] = []
    const seen = new Set<string>()
    const push = (name: string) => {
        const key = name.toLowerCase()
        if (seen.has(key)) return
        seen.add(key)
        names.push(name)
    }

    for (const book of activeBooks) for (const name of BIBLE_NAMES_BY_BOOK[book] || []) push(name)
    for (const name of BIBLE_NAMES_RANKED) push(name)

    let prompt = STYLE_SENTENCE + NAMES_LEAD_IN
    let count = 0
    for (const name of names) {
        const addition = (count ? ", " : "") + name
        if (prompt.length + addition.length > PROMPT_CHAR_BUDGET - 1) break
        prompt += addition
        count++
    }
    return prompt + "."
}

// prompt echo guard: whisper's failure mode with a prompt is repeating prompt text over quiet or
// uncertain audio. A segment whose words all appear as one contiguous run inside the prompt is an
// echo, not speech. The minimum length keeps short genuine phrases that happen to overlap the
// synthetic sentence (the style text avoids real verse wording for the same reason).
const ECHO_MIN_WORDS = 5

export function isPromptEcho(segmentText: string, prompt: string): boolean {
    const segment = normalizeForEcho(segmentText)
    if (!segment || segment.split(" ").length < ECHO_MIN_WORDS) return false
    return normalizeForEcho(prompt).includes(segment)
}

function normalizeForEcho(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
}
