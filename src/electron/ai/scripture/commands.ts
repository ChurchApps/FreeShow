// AI AUTO SCRIPTURE - VOICE COMMANDS
// detects imperative spoken phrases that control the live scripture projection
// ("go to the next verse", "give me verse five", "show chapter four", "give me NIV", "give me another translation")

import type { AiScriptureCommandEvent, AiScriptureTranslation } from "../../../types/ai/AiScripture"
import { normalizeSpokenNumbers } from "./detection"

export interface CommandGrammar {
    imperatives: string[]
    articles: string[]
    verse: string[]
    chapter: string[]
    next: string[]
    previous: string[]
    translation: string[]
    another: string[]
}

// commands always match against the union of the spoken language & English,
// so English phrases keep working when whisper runs in another language.
// the non-English tables are best-effort everyday church vocabulary - native-speaker corrections are very welcome!
export const COMMAND_GRAMMAR: { [lang: string]: CommandGrammar } = {
    en: {
        imperatives: ["give me", "go to", "show", "show me", "switch to", "read", "take me to"],
        articles: ["the"],
        verse: ["verse"],
        chapter: ["chapter"],
        next: ["next"],
        previous: ["previous", "last"],
        translation: ["translation", "version", "bible"],
        another: ["another", "a different"]
    },
    es: {
        imperatives: ["dame", "vamos a", "muestra", "cambia a"],
        articles: ["el", "la"],
        verse: ["versículo"],
        chapter: ["capítulo"],
        next: ["siguiente", "próximo"],
        previous: ["anterior"],
        translation: ["traducción", "versión"],
        another: ["otra", "otro"]
    },
    pt: {
        imperatives: ["me dá", "vai para", "mostra", "muda para"],
        articles: ["o", "a"],
        verse: ["versículo"],
        chapter: ["capítulo"],
        next: ["próximo", "seguinte"],
        previous: ["anterior"],
        translation: ["tradução", "versão"],
        another: ["outra", "outro"]
    },
    de: {
        imperatives: ["gib mir", "geh zu", "zeige", "zeig mir", "wechsle zu"],
        articles: ["der", "die", "das", "den"],
        verse: ["vers"],
        chapter: ["kapitel"],
        next: ["nächster", "nächste", "nächsten"],
        previous: ["vorheriger", "vorherige", "vorherigen", "letzter", "letzten"],
        translation: ["übersetzung", "version"],
        another: ["andere", "anderen"]
    },
    fr: {
        imperatives: ["donne-moi", "va à", "montre", "montre-moi", "passe à"],
        articles: ["le", "la", "les"],
        verse: ["verset"],
        chapter: ["chapitre"],
        next: ["suivant", "prochain"],
        previous: ["précédent", "dernier"],
        translation: ["traduction", "version"],
        another: ["autre"]
    },
    no: {
        imperatives: ["gi meg", "gå til", "vis", "bytt til"],
        articles: [],
        verse: ["vers"],
        chapter: ["kapittel"],
        next: ["neste"],
        previous: ["forrige"],
        translation: ["oversettelse", "versjon"],
        another: ["en annen", "et annet"]
    }
}

// commands are short & spoken just before they should act - only the newest speech is considered
const TAIL_CHARS = 80

// leading word boundary (\b fails before accented characters like "übersetzung")
const LEAD = "(?:^|[^a-z0-9])"

// a command does not have to be phrased as an order - speakers just say "next chapter". Without an imperative the
// phrase has to END the utterance, which is what separates an instruction from narration that happens to contain
// the same words ("in the next verse paul says something amazing" keeps talking, so it is never a command).
const BARE_TAIL = "\\s*[.,!?]*\\s*$"

// ...and these still read as narration even at the end of a sentence ("we will see that in the next chapter")
const NARRATION_BEFORE = /\b(?:in|from|on|at|into|within|about|of)(?:\s+the)?\s*$/

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// escaped alternation, longest words first so "show me" wins over "show"
function alternation(words: string[]): string {
    return [...new Set(words.filter((word) => word.trim().length))]
        .sort((a, b) => b.length - a.length)
        .map((word) => escapeRegex(word).replace(/ /g, "\\s+"))
        .join("|")
}

function mergeGrammar(language: string): CommandGrammar {
    const base = COMMAND_GRAMMAR.en
    const local = COMMAND_GRAMMAR[(language || "").slice(0, 2).toLowerCase()]
    if (!local || local === base) return base

    const merge = (a: string[], b: string[]) => [...new Set([...a, ...b])]
    return {
        imperatives: merge(local.imperatives, base.imperatives),
        articles: merge(local.articles, base.articles),
        verse: merge(local.verse, base.verse),
        chapter: merge(local.chapter, base.chapter),
        next: merge(local.next, base.next),
        previous: merge(local.previous, base.previous),
        translation: merge(local.translation, base.translation),
        another: merge(local.another, base.another)
    }
}

function phraseOf(match: RegExpMatchArray): string {
    return match[0].replace(/^[^a-z0-9]+/, "").replace(/[\s.,!?]+$/, "")
}

/**
 * Match a command body either as an order ("show the next chapter", anywhere in the tail) or as a plain
 * instruction ("next chapter") that has to end the utterance. Returns null when neither reading applies.
 */
function matchCommand(tail: string, imperative: string, body: string): RegExpMatchArray | null {
    const ordered = tail.match(new RegExp(LEAD + imperative + "\\s+" + body))
    if (ordered) return ordered

    const bare = tail.match(new RegExp(LEAD + body + BARE_TAIL))
    if (!bare || bare.index === undefined) return null

    return NARRATION_BEFORE.test(tail.slice(0, bare.index)) ? null : bare
}

export function detectScriptureCommand(text: string, language: string, translations: AiScriptureTranslation[]): AiScriptureCommandEvent | null {
    const tail = normalizeSpokenNumbers(text).slice(-TAIL_CHARS)
    const grammar = mergeGrammar(language)

    const imp = "(?:" + alternation(grammar.imperatives) + ")"
    const art = "(?:(?:" + alternation(grammar.articles) + ")\\s+)?"
    const verse = "(?:" + alternation(grammar.verse) + ")"
    const chapter = "(?:" + alternation(grammar.chapter) + ")"
    const transWord = "(?:" + alternation(grammar.translation) + ")"
    const isWord = (word: string, words: string[]) => new RegExp("^(?:" + alternation(words) + ")$").test(word)

    // 1. relative movement: "go to the next verse" / "show the previous chapter" / plain "next chapter"
    const relative = matchCommand(tail, imp, art + "(" + alternation([...grammar.next, ...grammar.previous]) + ")\\s+(" + alternation([...grammar.verse, ...grammar.chapter]) + ")\\b")
    if (relative) {
        const isPrevious = isWord(relative[1], grammar.previous)
        const phrase = phraseOf(relative)
        if (isWord(relative[2], grammar.chapter)) return { type: isPrevious ? "chapter_previous" : "chapter_next", phrase }
        return { type: isPrevious ? "verse_previous" : "verse_next", phrase }
    }

    // 2. verse jump: "give me verse 5". Imperative only - a bare "verse 5" is already resolved against the
    // live passage by tier 1 detection, and matching it here too would fight that with a second action.
    const verseJump = tail.match(new RegExp(LEAD + imp + "\\s+" + art + verse + "\\s+(\\d{1,3})\\b"))
    if (verseJump) {
        const number = parseInt(verseJump[1], 10)
        if (number >= 1) return { type: "verse_jump", verse: number, phrase: phraseOf(verseJump) }
    }

    // 3. chapter jump: "show chapter 4" / "show chapter 4 verse 2". Imperative only - a bare "chapter 4" is
    // usually the tail of a spoken reference ("deuteronomy chapter 4"), which detection already handles.
    const chapterJump = tail.match(new RegExp(LEAD + imp + "\\s+" + art + chapter + "\\s+(\\d{1,3})\\b(?:\\s+" + verse + "\\s+(\\d{1,3})\\b)?"))
    if (chapterJump) {
        const chapterNumber = parseInt(chapterJump[1], 10)
        const verseNumber = chapterJump[2] !== undefined ? parseInt(chapterJump[2], 10) : 0
        if (chapterNumber >= 1 && verseNumber >= 1) return { type: "chapter_jump", chapter: chapterNumber, verse: verseNumber, phrase: phraseOf(chapterJump) }
        if (chapterNumber >= 1) return { type: "chapter_jump", chapter: chapterNumber, phrase: phraseOf(chapterJump) }
    }

    // 4. cycle: "give me another translation"
    const cycle = matchCommand(tail, imp, art + "(?:" + alternation(grammar.another) + ")\\s+" + transWord + "(?![a-z0-9])")
    if (cycle) return { type: "translation_cycle", phrase: phraseOf(cycle) }

    // 5. named translation: "give me NIV" / "switch to the King James version"
    const byToken = new Map<string, string>()
    translations.forEach((translation) => {
        translation.names.forEach((name) => {
            const token = name.trim().toLowerCase().replace(/\s+/g, " ")
            if (token && !byToken.has(token)) byToken.set(token, translation.id)
        })
    })
    if (byToken.size) {
        const nameAlt = "(" + alternation([...byToken.keys()]) + ")"
        const named = matchCommand(tail, imp, art + "(?:" + transWord + "\\s+" + art + ")?" + nameAlt + "(?:\\s+" + transWord + ")?(?![a-z0-9])")
        if (named) {
            const bibleId = byToken.get(named[1].replace(/\s+/g, " "))
            if (bibleId) return { type: "translation", bibleId, phrase: phraseOf(named) }
        }
    }

    return null
}

// STREAMING SEGMENTS

// the streaming engine emits one segment per utterance, and a pause mid-command splits it ("next" / "verse").
// joining the recent tail lets the command match once its last word arrives - and a command only fires when the
// NEWEST segment completes it, so text that already fired (or failed) never re-fires from later joins.
const SEGMENT_JOIN_MS = 4000

export class CommandStream {
    private segments: { text: string; endMs: number }[] = []

    detect(segment: { text: string; endMs: number }, language: string, translations: AiScriptureTranslation[]): AiScriptureCommandEvent | null {
        this.segments.push(segment)
        while (this.segments.length > 1 && segment.endMs - this.segments[0].endMs > SEGMENT_JOIN_MS) this.segments.shift()

        const joined = this.segments.map((entry) => entry.text).join(" ")
        const command = detectScriptureCommand(joined, language, translations)
        if (!command) return null

        // the matched phrase must reach into the newest segment - an instruction wholly inside older text already
        // had its chance when that text was newest (normalization is word-by-word, so lengths compose across the join)
        const withoutNewest = this.segments
            .slice(0, -1)
            .map((entry) => entry.text)
            .join(" ")
        const boundary = withoutNewest ? normalizeSpokenNumbers(withoutNewest).length : 0
        const at = normalizeSpokenNumbers(joined).lastIndexOf(command.phrase)
        if (at >= 0 && at + command.phrase.length <= boundary) return null

        return command
    }
}
