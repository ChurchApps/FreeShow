// AI AUTO SCRIPTURE - VOICE COMMANDS
// detects imperative spoken phrases that control the live scripture projection
// ("go to the next verse", "give me verse five", "show chapter four", "give me NIV", "give me another translation")

import type { AiScriptureCommandEvent, AiScriptureTranslation } from "../../../types/ai/AiScripture"
import { normalizeSpokenNumbers, NUMBER_HOMOPHONES, parseNumberToken } from "../commands/spokenNumbers"
import { VERSE_WORD_MISHEARINGS } from "./vocabulary"

export interface CommandGrammar {
    imperatives: string[]
    addImperatives: string[] // extend the live selection ("add", "include")
    articles: string[]
    verse: string[]
    chapter: string[]
    next: string[]
    previous: string[]
    translation: string[]
    another: string[]
    rangeTo: string[] // "verses 1 TO 5"
    and: string[] // "verse 1 AND 2"
    restore: string[] // full phrases: put back what was on the output before the AI projected
    back: string[] // full phrases: return to the previously shown passage
    just: string[] // narrowing: "JUST verse 5"
    main: string[] // "the MAIN translation"
    accept: string[] // full phrases: project the newest suggestion ("yes show it")
}

// commands always match against the union of the spoken language & English,
// so English phrases keep working when whisper runs in another language.
// the non-English tables are best-effort everyday church vocabulary - native-speaker corrections are very welcome!
export const COMMAND_GRAMMAR: { [lang: string]: CommandGrammar } = {
    en: {
        imperatives: ["give me", "go to", "go back to", "come back to", "show", "show me", "switch to", "read", "take me to", "put", "put up", "project", "display"],
        addImperatives: ["add", "include"],
        articles: ["the"],
        verse: ["verse", "verses"],
        chapter: ["chapter"],
        next: ["next"],
        previous: ["previous", "last"],
        translation: ["translation", "version", "bible"],
        another: ["another", "a different"],
        rangeTo: ["to", "through", "thru", "till", "until"],
        and: ["and"],
        restore: ["bring it back", "put it back up", "put it back", "restore it", "restore that", "restore the previous"],
        back: ["go back", "take us back", "take me back", "back to the previous passage", "back to the previous scripture", "the previous passage", "back to where we were"],
        just: ["just", "only"],
        main: ["main", "preferred", "primary"],
        accept: ["yes show it", "yes put it up", "project it", "project that", "put it up", "put that up", "show that one", "show the suggestion"]
    },
    es: {
        imperatives: ["dame", "vamos a", "muestra", "cambia a"],
        addImperatives: ["añade", "agrega"],
        articles: ["el", "la", "los"],
        verse: ["versículo", "versículos"],
        chapter: ["capítulo"],
        next: ["siguiente", "próximo"],
        previous: ["anterior"],
        translation: ["traducción", "versión"],
        another: ["otra", "otro"],
        rangeTo: ["a", "al", "hasta"],
        and: ["y"],
        restore: ["restáuralo", "vuelve a lo anterior"],
        back: ["regresa", "vuelve atrás"],
        just: ["solo", "solamente"],
        main: ["principal", "preferida"],
        accept: ["proyéctalo", "muéstralo entonces"]
    },
    pt: {
        imperatives: ["me dá", "vai para", "mostra", "muda para"],
        addImperatives: ["adiciona", "acrescenta"],
        articles: ["o", "a", "os"],
        verse: ["versículo", "versículos"],
        chapter: ["capítulo"],
        next: ["próximo", "seguinte"],
        previous: ["anterior"],
        translation: ["tradução", "versão"],
        another: ["outra", "outro"],
        rangeTo: ["a", "ao", "até"],
        and: ["e"],
        restore: ["restaura isso", "volta ao anterior"],
        back: ["volta", "volta atrás"],
        just: ["só", "somente", "apenas"],
        main: ["principal", "preferida"],
        accept: ["projeta isso", "mostra então"]
    },
    de: {
        imperatives: ["gib mir", "geh zu", "zeige", "zeig mir", "wechsle zu"],
        addImperatives: ["ergänze"],
        articles: ["der", "die", "das", "den"],
        verse: ["vers", "verse"],
        chapter: ["kapitel"],
        next: ["nächster", "nächste", "nächsten"],
        previous: ["vorheriger", "vorherige", "vorherigen", "letzter", "letzten"],
        translation: ["übersetzung", "version"],
        another: ["andere", "anderen"],
        rangeTo: ["bis"],
        and: ["und"],
        restore: ["stell es wieder her"],
        back: ["geh zurück"],
        just: ["nur"],
        main: ["bevorzugte"],
        accept: ["zeig es an", "projiziere es"]
    },
    fr: {
        imperatives: ["donne-moi", "va à", "montre", "montre-moi", "passe à"],
        addImperatives: ["ajoute"],
        articles: ["le", "la", "les"],
        verse: ["verset", "versets"],
        chapter: ["chapitre"],
        next: ["suivant", "prochain"],
        previous: ["précédent", "dernier"],
        translation: ["traduction", "version"],
        another: ["autre"],
        rangeTo: ["à", "jusqu'à", "au"],
        and: ["et"],
        restore: ["remets-le"],
        back: ["reviens en arrière"],
        just: ["juste", "seulement"],
        main: ["principale", "préférée"],
        accept: ["projette-le", "affiche-le donc"]
    },
    no: {
        imperatives: ["gi meg", "gå til", "vis", "bytt til"],
        addImperatives: ["legg til"],
        articles: [],
        verse: ["vers"],
        chapter: ["kapittel"],
        next: ["neste"],
        previous: ["forrige"],
        translation: ["oversettelse", "versjon"],
        another: ["en annen", "et annet"],
        rangeTo: ["til"],
        and: ["og"],
        restore: ["ta det tilbake"],
        back: ["gå tilbake"],
        just: ["bare", "kun"],
        main: ["foretrukne"],
        accept: ["vis det da", "projiser det"]
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
        addImperatives: merge(local.addImperatives, base.addImperatives),
        articles: merge(local.articles, base.articles),
        verse: merge(local.verse, base.verse),
        chapter: merge(local.chapter, base.chapter),
        next: merge(local.next, base.next),
        previous: merge(local.previous, base.previous),
        translation: merge(local.translation, base.translation),
        another: merge(local.another, base.another),
        rangeTo: merge(local.rangeTo, base.rangeTo),
        and: merge(local.and, base.and),
        restore: merge(local.restore, base.restore),
        back: merge(local.back, base.back),
        just: merge(local.just, base.just),
        main: merge(local.main, base.main),
        accept: merge(local.accept, base.accept)
    }
}

function phraseOf(match: RegExpMatchArray): string {
    return match[0].replace(/^[^a-z0-9]+/, "").replace(/[\s.,!?]+$/, "")
}

/**
 * A spoken number sequence ("1 to 5" / "1 and 2" / "1, 2 and 3") collapsed to its span. The
 * continuation only counts while the numbers ASCEND - "give me verse 5 and 2 chronicles says"
 * stops at 5, because a descending number is the start of something else, not part of the range.
 */
function sequenceSpan(first: number, rest: string | undefined): { start: number; end: number } {
    let end = first
    for (const digits of (rest || "").matchAll(/\d{1,3}/g)) {
        const number = parseInt(digits[0], 10)
        if (number <= end) break
        end = number
    }
    return { start: first, end }
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

export function detectScriptureCommand(text: string, language: string, translations: AiScriptureTranslation[], books: { number: number; names: string[] }[] = []): AiScriptureCommandEvent | null {
    const tail = normalizeSpokenNumbers(text).slice(-TAIL_CHARS)
    const grammar = mergeGrammar(language)

    // whisper mishears the word "verse" itself in command position ("next verse" -> "next best",
    // "verse five" -> "this five"). The misheard forms are real English words, so they only count
    // in shapes narration can't produce: with an imperative, and for a number jump also at the
    // very end of the utterance ("give me this 5" acts, "read this 5 times a day" keeps talking)
    const misheard = "(?:" + alternation(VERSE_WORD_MISHEARINGS) + ")"

    // a polite lead-in makes any imperative no less of an instruction ("can you project verses 10 to 13")
    const imp = "(?:(?:can|could|would)\\s+you\\s+(?:please\\s+)?)?(?:" + alternation(grammar.imperatives) + ")"
    const art = "(?:(?:" + alternation(grammar.articles) + ")\\s+)?"
    const verse = "(?:" + alternation(grammar.verse) + ")"
    const chapter = "(?:" + alternation(grammar.chapter) + ")"
    const transWord = "(?:" + alternation(grammar.translation) + ")"
    const isWord = (word: string, words: string[]) => new RegExp("^(?:" + alternation(words) + ")$").test(word)

    // a number sequence: "1", "1 to 5", "1 and 2", "1, 2 and 3", "1-5"
    const conn = "(?:,|[-–—]|" + alternation([...grammar.rangeTo, ...grammar.and]) + ")"
    const numberSeq = "(\\d{1,3})((?:\\s*" + conn + "\\s*\\d{1,3})*)\\b"
    // decoration a "put these together" phrasing carries - never required next to a verse word
    const decor = "(?:\\s+(?:together|on\\s+(?:the\\s+)?screen|up))?"

    // 0. extending the live selection: "add the next verse" / "include verses 6 and 7". Checked
    // first - "add the next verse" ends in "next verse", which the relative matcher below would
    // otherwise read as a plain advance and REPLACE the selection instead of growing it
    const addImp = "(?:" + alternation(grammar.addImperatives) + ")"
    const addNext = tail.match(new RegExp(LEAD + addImp + "\\s+" + art + "(?:" + alternation(grammar.next) + ")(?:\\s+(?:" + verse + "|one))?\\b"))
    if (addNext) return { type: "verse_add", phrase: phraseOf(addNext) }
    const addVerse = tail.match(new RegExp(LEAD + addImp + "\\s+" + art + verse + "\\s+" + numberSeq))
    if (addVerse) {
        const span = sequenceSpan(parseInt(addVerse[1], 10), addVerse[2])
        if (span.end >= 1) return { type: "verse_add", verse: span.end, phrase: phraseOf(addVerse) }
    }

    // 1. relative movement: "go to the next verse" / "show the previous chapter" / plain "next chapter"
    const relativeBody = (units: string) => art + "(" + alternation([...grammar.next, ...grammar.previous]) + ")\\s+(" + units + ")\\b"
    const relative = matchCommand(tail, imp, relativeBody(alternation([...grammar.verse, ...grammar.chapter]))) || tail.match(new RegExp(LEAD + imp + "\\s+" + relativeBody(alternation(VERSE_WORD_MISHEARINGS))))
    if (relative) {
        const isPrevious = isWord(relative[1], grammar.previous)
        const phrase = phraseOf(relative)
        if (isWord(relative[2], grammar.chapter)) return { type: isPrevious ? "chapter_previous" : "chapter_next", phrase }
        return { type: isPrevious ? "verse_previous" : "verse_next", phrase }
    }

    // 1b. announcing the advance while reading: "the next verse says..." - and whisper often drops
    // the word "verse" entirely, so "the next says..." counts too; the says-verb right after
    // "next (verse)" is what carries the intent. Narration inserts a subject ("in the next verse
    // PAUL says") which breaks the adjacency, and a leading preposition is checked as well
    const saysVerb = "(?:says?|said|reads?|goes|continues|tells\\s+us)"
    const advanceUnits = alternation([...grammar.verse, ...VERSE_WORD_MISHEARINGS, ...grammar.chapter])
    const advance = tail.match(new RegExp(LEAD + "(?:and\\s+)?(?:the\\s+)?next\\s+(?:(" + advanceUnits + ")\\s+)?" + saysVerb + "\\b"))
    if (advance && advance.index !== undefined && !NARRATION_BEFORE.test(tail.slice(0, advance.index))) {
        const phrase = phraseOf(advance)
        if (advance[1] && isWord(advance[1], grammar.chapter)) return { type: "chapter_next", phrase }
        return { type: "verse_next", phrase }
    }

    // 1c. output restore & passage back - whole standalone instructions, end of utterance only.
    // Restore checks first so "put it back up" never reads as a bare "back" phrase; a leading
    // conditional ("if we go back...") is a sentence being built, not an instruction
    const CONDITIONAL_BEFORE = /\b(?:if|when|whenever|before|until|as|should)\s+(?:we|you|i|they|he|she)?\s*$/
    const restore = tail.match(new RegExp(LEAD + "(?:" + alternation(grammar.restore) + ")" + BARE_TAIL))
    if (restore && restore.index !== undefined && !NARRATION_BEFORE.test(tail.slice(0, restore.index)) && !CONDITIONAL_BEFORE.test(tail.slice(0, restore.index))) {
        return { type: "restore", phrase: phraseOf(restore) }
    }
    const back = tail.match(new RegExp(LEAD + "(?:" + alternation(grammar.back) + ")" + BARE_TAIL))
    if (back && back.index !== undefined && !NARRATION_BEFORE.test(tail.slice(0, back.index)) && !CONDITIONAL_BEFORE.test(tail.slice(0, back.index))) {
        return { type: "back", phrase: phraseOf(back) }
    }

    // 1d. back to a NAMED book: "go back to ephesians" - the newest previously shown passage
    // from that book. End of utterance only; a spoken reference ("go back to ephesians two")
    // never reaches here because tier 1 detection resolves it first
    if (books.length) {
        const byBookName = new Map<string, number>()
        books.forEach((book) =>
            book.names.forEach((name) => {
                const token = name.trim().toLowerCase().replace(/\s+/g, " ")
                if (token.length > 2 && !byBookName.has(token)) byBookName.set(token, book.number)
            })
        )
        const backToBook = tail.match(new RegExp(LEAD + "(?:go\\s+back|take\\s+(?:us|me)\\s+back|come\\s+back)\\s+to\\s+" + art + "(?:book\\s+of\\s+)?(" + alternation([...byBookName.keys()]) + ")" + BARE_TAIL))
        if (backToBook) {
            const bookNumber = byBookName.get(backToBook[1].replace(/\s+/g, " "))
            if (bookNumber) return { type: "back", book: bookNumber, phrase: phraseOf(backToBook) }
        }
    }

    // 1e. accepting the newest suggestion: "yes, show it" / "project it" - confirm mode by voice.
    // Whole standalone phrases at the end of an utterance; the executor additionally requires a
    // fresh suggestion to exist, so a stray match with nothing pending does nothing
    const accept = tail.match(new RegExp(LEAD + "(?:" + alternation(grammar.accept) + ")" + BARE_TAIL))
    if (accept && accept.index !== undefined && !NARRATION_BEFORE.test(tail.slice(0, accept.index)) && !CONDITIONAL_BEFORE.test(tail.slice(0, accept.index))) {
        return { type: "accept", phrase: phraseOf(accept) }
    }

    // 1f. narrowing the live selection: "just verse 5" / "only verse 12" - end of utterance only
    const narrow = tail.match(new RegExp(LEAD + "(?:" + alternation(grammar.just) + ")\\s+" + art + verse + "\\s+(\\d{1,3})\\b" + BARE_TAIL))
    if (narrow && narrow.index !== undefined && !NARRATION_BEFORE.test(tail.slice(0, narrow.index))) {
        const number = parseInt(narrow[1], 10)
        if (number >= 1) return { type: "verse_jump", verse: number, phrase: phraseOf(narrow) }
    }

    // 2. verse jump & ranges: "give me verse 5", "show verses 1 to 5", "put verses 1 and 2
    // together". Imperative only - a bare "verse 5" is already resolved against the live passage
    // by tier 1 detection, and matching it here too would fight that with a second action.
    // The number itself also arrives as a homophone ("give me verse for") - end of utterance only
    const homophone = "(" + Object.keys(NUMBER_HOMOPHONES).join("|") + ")"
    const verseJump = tail.match(new RegExp(LEAD + imp + "\\s+" + art + verse + "\\s+" + numberSeq + decor)) || tail.match(new RegExp(LEAD + imp + "\\s+" + art + misheard + "\\s+" + numberSeq + decor + BARE_TAIL)) || tail.match(new RegExp(LEAD + imp + "\\s+" + art + "(?:" + verse + "|" + misheard + ")\\s+" + homophone + BARE_TAIL))
    if (verseJump) {
        const number = parseNumberToken(verseJump[1])
        if (number >= 1) {
            const span = sequenceSpan(number, verseJump[2])
            if (span.end > span.start) return { type: "verse_jump", verse: span.start, verseEnd: span.end, phrase: phraseOf(verseJump) }
            return { type: "verse_jump", verse: number, phrase: phraseOf(verseJump) }
        }
    }

    // 2b. a range without the word "verse" at all: "project 10 to 13 together". Bare numbers may
    // only act when BOTH an imperative and the together/on-screen tail carry the intent
    const bareRange = tail.match(new RegExp(LEAD + imp + "\\s+" + art + numberSeq + "\\s+(?:together|on\\s+(?:the\\s+)?screen)\\b"))
    if (bareRange) {
        const span = sequenceSpan(parseInt(bareRange[1], 10), bareRange[2])
        if (span.end > span.start) return { type: "verse_jump", verse: span.start, verseEnd: span.end, phrase: phraseOf(bareRange) }
    }

    // 3. chapter jump: "show chapter 4" / "show chapter 4 verses 2 to 5". Imperative only - a bare
    // "chapter 4" is usually the tail of a spoken reference ("deuteronomy chapter 4"), which
    // detection already handles.
    const chapterJump = tail.match(new RegExp(LEAD + imp + "\\s+" + art + chapter + "\\s+(\\d{1,3})\\b(?:\\s+(?:" + verse + "|" + misheard + ")\\s+" + numberSeq + ")?"))
    if (chapterJump) {
        const chapterNumber = parseInt(chapterJump[1], 10)
        const verseNumber = chapterJump[2] !== undefined ? parseInt(chapterJump[2], 10) : 0
        if (chapterNumber >= 1 && verseNumber >= 1) {
            const span = sequenceSpan(verseNumber, chapterJump[3])
            if (span.end > span.start) return { type: "chapter_jump", chapter: chapterNumber, verse: span.start, verseEnd: span.end, phrase: phraseOf(chapterJump) }
            return { type: "chapter_jump", chapter: chapterNumber, verse: verseNumber, phrase: phraseOf(chapterJump) }
        }
        if (chapterNumber >= 1) return { type: "chapter_jump", chapter: chapterNumber, phrase: phraseOf(chapterJump) }
    }

    // 4. cycle: "give me another translation"
    const cycle = matchCommand(tail, imp, art + "(?:" + alternation(grammar.another) + ")\\s+" + transWord + "(?![a-z0-9])")
    if (cycle) return { type: "translation_cycle", phrase: phraseOf(cycle) }

    // 4b. back to the preferred one: "give me the main translation", "back to our primary
    // version", "our preferred bible" - translation/version/bible interchangeably, with
    // possessives ("our", "my") welcome where an article would sit
    const mainArt = "(?:(?:the|our|my|your)\\s+)?"
    const mainBody = mainArt + "(?:" + alternation(grammar.main) + ")\\s+" + transWord + "(?![a-z0-9])"
    const mainTranslation = matchCommand(tail, imp, mainBody) || tail.match(new RegExp(LEAD + "back\\s+to\\s+" + mainBody + BARE_TAIL))
    if (mainTranslation) return { type: "translation_main", phrase: phraseOf(mainTranslation) }

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

        // 5b. announcing the wording being read - no imperative, the reading verb right after the
        // name (or a reading lead-in right before it) carries the intent: "god's word translation
        // says...", "the ERV reads...", "new living translation puts it this way", "in the NIV,
        // it says...", "according to the NIV", "reading from the message". A dictation pause and
        // a subject pronoun may sit between name and verb; a bare name mention stays narration
        const readsVerb = "(?:says?|said|reads?|goes|continues|renders?\\s+it|translates?\\s+it|puts?\\s+it(?:\\s+(?:this|that)\\s+way|\\s+like\\s+this)?|has\\s+it|tells\\s+us)"
        const announced = tail.match(new RegExp(LEAD + art + nameAlt + "(?:\\s+" + transWord + ")?\\s*[,.]?\\s*(?:it\\s+|we\\s+)?" + readsVerb + "\\b")) || tail.match(new RegExp(LEAD + "(?:according\\s+to|reading\\s+from)\\s+" + art + nameAlt + "(?:\\s+" + transWord + ")?(?![a-z0-9])"))
        if (announced) {
            const bibleId = byToken.get(announced[1].replace(/\s+/g, " "))
            if (bibleId) return { type: "translation", bibleId, phrase: phraseOf(announced) }
        }
    }

    return null
}

// STREAMING SEGMENTS

// the streaming engine emits one segment per utterance, and a pause mid-command splits it ("next" / "verse").
// joining the recent tail lets the command match once its last word arrives - and a command only fires when the
// NEWEST segment completes it, so text that already fired (or failed) never re-fires from later joins.
const SEGMENT_JOIN_MS = 4000

// "another one" only means "cycle again" for a short while after a translation command
const FOLLOW_UP_WINDOW_MS = 30000

export interface CommandContext {
    // a passage is live on the output (reading in progress) - required before a LONE "next" acts
    anchored?: boolean
}

export class CommandStream {
    private segments: { text: string; endMs: number }[] = []
    private lastCommandType = ""
    private lastCommandAtMs = 0

    detect(segment: { text: string; endMs: number }, language: string, translations: AiScriptureTranslation[], context: CommandContext = {}, books: { number: number; names: string[] }[] = []): AiScriptureCommandEvent | null {
        this.segments.push(segment)
        while (this.segments.length > 1 && segment.endMs - this.segments[0].endMs > SEGMENT_JOIN_MS) this.segments.shift()

        // a whole utterance of just "next" while a passage is live is the preacher advancing -
        // inside a sentence the word never stands alone, so this cannot fire from narration
        if (context.anchored && /^[^a-z0-9]*(?:and\s+|okay\s+|ok\s+)?next[^a-z0-9]*$/i.test(segment.text)) {
            return this.record({ type: "verse_next", phrase: segment.text.trim() }, segment.endMs)
        }

        const joined = this.segments.map((entry) => entry.text).join(" ")
        const command = detectScriptureCommand(joined, language, translations, books)
        if (!command) {
            // "another one" / "one more" right after a translation command cycles again
            const followUp = /(?:^|[^a-z0-9])(?:and\s+)?(?:another one|one more|another)\s*[.,!?]*\s*$/i.exec(joined)
            if (followUp && this.lastCommandType.startsWith("translation") && segment.endMs - this.lastCommandAtMs <= FOLLOW_UP_WINDOW_MS) {
                return this.record({ type: "translation_cycle", phrase: followUp[0].replace(/^[^a-z0-9]+/i, "").replace(/[\s.,!?]+$/, "") }, segment.endMs)
            }
            return null
        }

        // the matched phrase must reach into the newest segment - an instruction wholly inside older text already
        // had its chance when that text was newest (normalization is word-by-word, so lengths compose across the join)
        const withoutNewest = this.segments
            .slice(0, -1)
            .map((entry) => entry.text)
            .join(" ")
        const boundary = withoutNewest ? normalizeSpokenNumbers(withoutNewest).length : 0
        const at = normalizeSpokenNumbers(joined).lastIndexOf(command.phrase)
        if (at >= 0 && at + command.phrase.length <= boundary) return null

        return this.record(command, segment.endMs)
    }

    private record(command: AiScriptureCommandEvent, atMs: number): AiScriptureCommandEvent {
        this.lastCommandType = command.type
        this.lastCommandAtMs = atMs
        return command
    }
}
