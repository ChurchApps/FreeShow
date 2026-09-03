// AI AUTO SCRIPTURE - VOICE COMMANDS
// detects imperative spoken phrases that control the live scripture projection
// ("go to the next verse", "give me verse five", "show chapter four", "give me NIV", "give me another translation")
// and declares scripture's spec (matcher + policies) for the generic command layer

import type { AiScriptureCommandEvent, AiScriptureTranslation } from "../../../../types/ai/AiScripture"
import type { FeatureCommandSpec } from "../../commands/commandStream"
import { alternation, BARE_TAIL, CONDITIONAL_BEFORE, LEAD, matchCommand, mergeLocalizedGrammar, NARRATION_BEFORE, phraseOf, sequenceSpan, TAIL_CHARS } from "../../commands/grammar"
import { normalizeSpokenNumbers, NUMBER_HOMOPHONES, parseNumberToken } from "../../commands/spokenNumbers"
import { VERSE_WORD_MISHEARINGS } from "../vocabulary"
import { COMMAND_GRAMMAR } from "./grammar"

// a whole utterance of just "next" while a passage is live is the preacher advancing -
// inside a sentence the word never stands alone, so this cannot fire from narration
const LONE_NEXT_WHILE_ANCHORED = /^[^a-z0-9]*(?:and\s+|okay\s+|ok\s+)?next[^a-z0-9]*$/i

// "another one" / "one more" only means "cycle again" for a short while after a translation command
const TRANSLATION_FOLLOW_UP = /(?:^|[^a-z0-9])(?:and\s+)?(?:another one|one more|another)\s*[.,!?]*\s*$/i
const FOLLOW_UP_WINDOW_MS = 30000

/**
 * Scripture's registration with the generic command layer. The config getter is read per
 * segment, so mid-session table updates (Search Bibles changes) reach the matcher live.
 */
export function scriptureCommandSpec(getConfig: () => { language: string; translations: AiScriptureTranslation[]; books: { number: number; names: string[] }[] }): FeatureCommandSpec<AiScriptureCommandEvent> {
    return {
        feature: "scripture",
        cooldownMs: 3000,
        normalize: normalizeSpokenNumbers,
        match: (joinedText) => {
            const config = getConfig()
            return detectScriptureCommand(joinedText, config.language, config.translations, config.books)
        },
        contextShortcuts: [{ when: (context) => !!context.anchored, pattern: LONE_NEXT_WHILE_ANCHORED, command: (rawSegmentText) => ({ type: "verse_next", phrase: rawSegmentText.trim() }) }],
        followUps: [{ appliesAfter: (lastCommandType) => lastCommandType.startsWith("translation"), windowMs: FOLLOW_UP_WINDOW_MS, pattern: TRANSLATION_FOLLOW_UP, command: (cleanedPhrase) => ({ type: "translation_cycle", phrase: cleanedPhrase }) }]
    }
}

export function detectScriptureCommand(text: string, language: string, translations: AiScriptureTranslation[], books: { number: number; names: string[] }[] = []): AiScriptureCommandEvent | null {
    const tail = normalizeSpokenNumbers(text).slice(-TAIL_CHARS)
    const grammar = mergeLocalizedGrammar(COMMAND_GRAMMAR, language)

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
