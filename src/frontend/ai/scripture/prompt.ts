// AI AUTO SCRIPTURE - whisper vocabulary biasing
// whisper conditions its decoder on a text prompt (whisper.cpp --prompt / server "prompt" field),
// which is the one model-side lever for words live speech recognition otherwise garbles: biblical
// names ("Amalekites" heard as "analekite") and KJV archaisms (thou, whence, wast, knowest).
// The prompt re-sends with every transcription window, so it can follow the preaching passage.

import { BIBLE_NAMES_BY_BOOK, BIBLE_NAMES_RANKED } from "./bibleVocabulary"

// whisper truncates prompts around 224 tokens (half its text context) - but long before that
// limit, a heavy prompt becomes hallucination PRESSURE: on degraded audio the decoder happily
// emits the rare names it was conditioned on. The budget is deliberately small: enough to bias,
// not enough to put words in whisper's mouth.
const PROMPT_CHAR_BUDGET = 300

// how many names from the global hardest-to-transcribe ranking may fill the prompt when no
// passage is being preached from - the deep vocabulary arrives via the context books instead
const GLOBAL_NAMES_MAX = 12

// a SYNTHETIC King James style clause - archaic pronouns and inflections that bias the decoder
// toward "thou knowest"/"whence" instead of modern near-homophones. Deliberately not a real
// verse: the echo guard below drops segments that quote the prompt verbatim, which must never
// swallow a genuine recitation.
const STYLE_SENTENCE = "And he spake unto the people, saying, Verily thou knowest whence thou camest and whither thou goest."

const NAMES_LEAD_IN = " Thus saith the LORD concerning "

/**
 * Compose the decoder-conditioning prompt: the KJV style clause plus biblical names. Names from
 * the books currently being preached from come first and may fill the whole budget - the global
 * ranking only contributes a small fixed number, so an idle prompt stays light.
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
    let globalNames = 0
    for (const name of BIBLE_NAMES_RANKED) {
        if (globalNames >= GLOBAL_NAMES_MAX) break
        const before = names.length
        push(name)
        if (names.length > before) globalNames++
    }

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
