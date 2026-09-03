// AI AUTO SCRIPTURE - VOICE COMMAND EXECUTOR
// imperative spoken phrases ("go to the next verse") control the projection - only while a scripture is live

import { get } from "svelte/store"
import type { AiScriptureCommandEvent } from "../../../types/ai/AiScripture"
import type { BibleInstance } from "../../components/drawer/bible/scripture"
import { loadJsonBible, outputIsScripture } from "../../components/drawer/bible/scripture"
import { setDrawerTabData } from "../../components/helpers/historyHelpers"
import { activeScripture, ai, aiSuggestions, drawerTabsData, outLocked, scriptureHistory, scriptures } from "../../stores"
import { parseNumber, projectResolved, restorePrevious } from "./projection"
import { getSettings, scriptureState } from "./scriptureState"
import { cycleRank, preferredTranslationId } from "./translationPreference"

const ACCEPT_SUGGESTION_WINDOW_MS = 45000 // "yes, show it" only accepts a suggestion this fresh

export async function executeScriptureCommand(cmd: AiScriptureCommandEvent): Promise<void> {
    if (!get(ai).enabled) return

    const settings = getSettings()
    if (!scriptureState.sessionActive || !settings.voiceCommands) return
    if (get(outLocked)) return

    // accepting the newest suggestion is confirm mode by voice - it must work BEFORE anything
    // is live on the output, and only while the suggestion is still fresh
    if (cmd.type === "accept") {
        const suggestion = get(aiSuggestions)[0]
        if (!suggestion || Date.now() - suggestion.timestamp > ACCEPT_SUGGESTION_WINDOW_MS) return
        suggestion.trigger?.()
        return
    }

    if (!outputIsScripture()) return

    // output restore & passage back act on state of their own - no live reference needed
    if (cmd.type === "restore") {
        restorePrevious()
        return
    }
    if (cmd.type === "back") {
        await projectPreviousPassage(cmd.book)
        return
    }

    const current = get(activeScripture)
    const currentId = current.id || get(drawerTabsData).scripture?.activeSubTab || ""
    const reference = current.reference
    if (!currentId || !reference) return

    const chapter = parseNumber(reference.chapters[0])
    const currentVerses = (reference.verses[0] || []).map(parseNumber).filter((a) => a >= 1)
    if (!(chapter >= 1) || !currentVerses.length) return

    // collections load one version at a time - validate against the first one
    const parseId = get(scriptures)[currentId]?.collection?.versions?.[0] || currentId

    try {
        const bible = await loadJsonBible(parseId)
        if (!bible) return

        const Book = await bible.getBook(reference.book)
        const chapterCount = Book.data.chapters?.length || 0
        const maxVerseOf = async (chapterNumber: number) => {
            const Chapter = await Book.getChapter(chapterNumber)
            const chapterVerses = Chapter.data.verses || []
            return chapterVerses.length ? (chapterVerses[chapterVerses.length - 1]?.number ?? chapterVerses.length) : 0
        }

        if (cmd.type === "translation" || cmd.type === "translation_cycle" || cmd.type === "translation_main") {
            const resolved = cmd.type === "translation_main" ? { type: "translation" as const, bibleId: preferredTranslationId(), phrase: cmd.phrase } : cmd
            if (resolved.type === "translation" && !resolved.bibleId) return
            await switchTranslation(resolved, { currentId, bible, bookName: Book.data.name || "", book: reference.book, chapter, verses: currentVerses })
            return
        }

        let targetChapter = chapter
        let targetVerse = 1
        let targetVerseEnd = 0 // set for spoken ranges ("verses 1 to 5") and selection extension

        if (cmd.type === "verse_next") {
            const last = Math.max(...currentVerses)
            const maxVerse = await maxVerseOf(chapter)
            if (maxVerse && last < maxVerse) targetVerse = last + 1
            else if (chapter < chapterCount) targetChapter = chapter + 1
            else return // already at the last verse of the last chapter
        } else if (cmd.type === "verse_previous") {
            const first = Math.min(...currentVerses)
            if (first > 1) targetVerse = first - 1
            else if (chapter > 1) {
                targetChapter = chapter - 1
                targetVerse = await maxVerseOf(targetChapter)
                if (!targetVerse) return
            } else return // already at the first verse of the first chapter
        } else if (cmd.type === "chapter_next") {
            targetChapter = chapterCount ? Math.min(chapter + 1, chapterCount) : chapter + 1
        } else if (cmd.type === "chapter_previous") {
            targetChapter = Math.max(chapter - 1, 1)
        } else if (cmd.type === "verse_jump") {
            const maxVerse = await maxVerseOf(chapter)
            targetVerse = maxVerse ? Math.min(Math.max(1, cmd.verse), maxVerse) : cmd.verse
            if (cmd.verseEnd) targetVerseEnd = maxVerse ? Math.min(cmd.verseEnd, maxVerse) : cmd.verseEnd
        } else if (cmd.type === "verse_add") {
            // grow the live selection into a contiguous span: "add the next verse" / "add verse 3"
            const maxVerse = await maxVerseOf(chapter)
            let addTo = cmd.verse ?? Math.max(...currentVerses) + 1
            if (maxVerse) addTo = Math.min(Math.max(1, addTo), maxVerse)
            targetVerse = Math.min(Math.min(...currentVerses), addTo)
            targetVerseEnd = Math.max(Math.max(...currentVerses), addTo)
            // already showing exactly that span (e.g. "add the next verse" at the chapter's end)
            if (currentVerses.length === targetVerseEnd - targetVerse + 1 && targetVerse === Math.min(...currentVerses) && targetVerseEnd === Math.max(...currentVerses)) return
        } else {
            // chapter_jump
            targetChapter = chapterCount ? Math.min(Math.max(1, cmd.chapter), chapterCount) : cmd.chapter
            const requestedVerse = cmd.verse ?? 1
            const maxVerse = await maxVerseOf(targetChapter)
            targetVerse = maxVerse ? Math.min(Math.max(1, requestedVerse), maxVerse) : requestedVerse
            if (cmd.verseEnd) targetVerseEnd = maxVerse ? Math.min(cmd.verseEnd, maxVerse) : cmd.verseEnd
        }

        let targetVerses = [targetVerse]
        if (targetVerseEnd > targetVerse) {
            targetVerses = []
            for (let v = targetVerse; v <= targetVerseEnd; v++) targetVerses.push(v)
            // the spoken-range guard applies to commands too ("verses 1 to 176")
            const cap = 10
            if (targetVerses.length > cap) targetVerses = targetVerses.slice(0, cap)
        }
        await projectResolved(currentId, reference.book, targetChapter, targetVerses)
    } catch (err) {
        console.error("Error executing AI scripture voice command:", err)
    }
}

async function switchTranslation(cmd: Extract<AiScriptureCommandEvent, { type: "translation" | "translation_cycle" }>, from: { currentId: string; bible: BibleInstance; bookName: string; book: number | string; chapter: number; verses: number[] }): Promise<void> {
    let targetId = ""
    if (cmd.type === "translation") targetId = cmd.bibleId
    else {
        // cycle to the next translation: the main one, then the favourites, then common before
        // obscure. API bibles are part of the pool - they project on demand
        const main = preferredTranslationId()
        const priorityRank = (id: string) => (id === main ? -1 : 0)
        const apiIds = Object.entries(get(scriptures))
            .filter(([, bible]) => !!bible?.api)
            .map(([id]) => id)
        const ids = [...new Set([...(scriptureState.searchBibleIds.length ? scriptureState.searchBibleIds : [from.currentId]), ...apiIds])].sort((a, b) => priorityRank(a) - priorityRank(b) || cycleRank(a) - cycleRank(b))
        targetId = ids[(ids.indexOf(from.currentId) + 1) % ids.length] || ""
    }
    if (!targetId || targetId === from.currentId) return

    const targetParseId = get(scriptures)[targetId]?.collection?.versions?.[0] || targetId
    const targetBible = await loadJsonBible(targetParseId)
    if (!targetBible) return

    // map the current book to the target bible: same number when both use the 66 book canon, name match otherwise
    let targetBook: number | string = from.book
    const targetBooks = targetBible.data.books || []
    if ((from.bible.data.books || []).length !== 66 || targetBooks.length !== 66) {
        const nameLower = from.bookName.toLowerCase()
        const match = targetBooks.find((a) => a.name?.toLowerCase() === nameLower || a.abbreviation?.toLowerCase() === nameLower || a.id?.toLowerCase() === nameLower)
        if (match) targetBook = match.number
        else {
            const searched = targetBible.bookSearch(`${from.bookName} ${from.chapter}`)
            if (!searched?.book) return
            targetBook = searched.book
        }
    }

    // clamp the current chapter & verses to what exists in the target translation
    const TargetBook = await targetBible.getBook(targetBook)
    const targetChapterCount = TargetBook.data.chapters?.length || 0
    const targetChapter = targetChapterCount ? Math.min(Math.max(1, from.chapter), targetChapterCount) : from.chapter

    const TargetChapter = await TargetBook.getChapter(targetChapter)
    const targetChapterVerses = TargetChapter.data.verses || []
    const maxVerse = targetChapterVerses.length ? (targetChapterVerses[targetChapterVerses.length - 1]?.number ?? targetChapterVerses.length) : 0
    const verses = [...new Set(from.verses.map((a) => (maxVerse ? Math.min(Math.max(1, a), maxVerse) : a)))].sort((a, b) => a - b)

    setDrawerTabData("scripture", targetId)
    await projectResolved(targetId, targetBook, targetChapter, verses)
}

/**
 * The spoken "go back": walk the scripture usage history to the previously shown passage.
 * The history records every projection per translation - the walk groups entries by PASSAGE
 * (translation-agnostic), so a verse shown in the NIV and again in the KJV is one stop, and
 * repeating the command steps one distinct passage further back each time.
 */
async function projectPreviousPassage(bookNumber?: number): Promise<void> {
    const entries = get(scriptureHistory)
    if (!entries.length) return

    const versesOf = (verse: any): number[] =>
        (Array.isArray(verse) ? verse : [verse])
            .map((v) => parseInt(String(v), 10))
            .filter((v) => v >= 1)
            .sort((a, b) => a - b)
    const keyOf = (entry: any) => `${parseNumber(entry.book)}.${parseNumber(entry.chapter)}.${versesOf(entry.verse).join(",")}`

    // distinct passages, newest first (each entry's newest occurrence decides its translation)
    const seen = new Set<string>()
    const stops: any[] = []
    for (let i = entries.length - 1; i >= 0; i--) {
        const key = keyOf(entries[i])
        if (seen.has(key)) continue
        seen.add(key)
        stops.push(entries[i])
    }

    // "go back to ephesians": the newest previously shown passage from the named book
    if (bookNumber) {
        const target = stops.find((entry) => parseNumber(entry.book) === bookNumber)
        if (!target) return
        const verses = versesOf(target.verse)
        if (!target.id || !verses.length) return
        console.info(`[AiScripture] Voice command: going back to ${target.reference || keyOf(target)}`)
        await projectResolved(target.id, target.book, parseNumber(target.chapter), verses)
        return
    }

    // stops[0] is what is showing right now - the walk starts one behind it
    const depth = scriptureState.backDepth
    const target = stops[depth + 1]
    if (!target) return

    const verses = versesOf(target.verse)
    if (!target.id || !verses.length) return

    console.info(`[AiScripture] Voice command: going back to ${target.reference || keyOf(target)}`)
    await projectResolved(target.id, target.book, parseNumber(target.chapter), verses)
    scriptureState.backDepth = depth + 1 // projectResolved reset it - the walk continues from here
}
