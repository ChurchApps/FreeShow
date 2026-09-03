// AI AUTO SCRIPTURE - DETECTION HANDLING
// every detected reference lands here: quote verification, the suggestion list and the
// auto-projection scheduler (cooldowns, high-confidence bypass, pending timer)

import { get } from "svelte/store"
import type { DetectedReference } from "../../../types/ai/AiScripture"
import { getShortBibleName, loadJsonBible } from "../../components/drawer/bible/scripture"
import { ai, aiScriptureSuggestions, aiSuggestions, drawerTabsData, outLocked, scriptures } from "../../stores"
import AiScriptureSettings from "../components/settings/AiScriptureSettings.svelte"
import { projectDetection, resolveBookNumber } from "./projection"
import { noteExplicitDetection } from "./quoteMatch/quoteMatchSession"
import { getSettings, scriptureState } from "./scriptureState"

const SUGGESTION_MAX_AGE = 3 * 60 * 1000
const SUGGESTION_LIMIT = 5
const QUOTE_MATCH_SCORE = 0.55
const QUOTE_DEMOTE_SCORE = 0.35

export async function handleDetection(ref: DetectedReference): Promise<void> {
    if (!get(ai).enabled) return

    const settings = getSettings()
    if (!scriptureState.sessionActive) return

    // a spoken reference primes the quote matcher: the recitation that follows resolves faster
    if (ref.type === "explicit") noteExplicitDetection(ref)

    // LLM quotes are verified against the actual verse text; local quote matches arrive with
    // matchedBibleId already set because they WERE matched against it - never re-verify those
    if (ref.type === "quoted" && ref.quote && !ref.matchedBibleId) await verifyQuote(ref)

    addSuggestion(ref)

    const confidence = settings.confidence || "ask"

    // auto projection
    if (confidence === "ask") return
    if (get(outLocked)) return
    // one gate for references and quotes alike: spoken references score high by nature, and a
    // quoted verse only reaches high when the match is decisive - the slider is the single lever
    if (confidencePercent(ref.confidence) < confidencePercent(confidence)) return

    queueAutoProjection(ref)
}

async function verifyQuote(ref: DetectedReference) {
    const quote = ref.quote || ""
    let bestScore = 0
    let bestId = ""

    for (const id of scriptureState.searchBibleIds) {
        try {
            const bible = await loadJsonBible(id)
            if (!bible) continue

            const bookNumber = resolveBookNumber(bible, ref)
            if (!bookNumber) continue

            const Book = await bible.getBook(bookNumber)
            const Chapter = await Book.getChapter(ref.chapter)

            let text = ""
            for (let v = ref.verseStart; v <= Math.max(ref.verseStart, ref.verseEnd); v++) {
                text += " " + Chapter.getVerse(v).getText()
            }

            const score = tokenOverlapSimilarity(text, quote)
            if (score > bestScore) {
                bestScore = score
                bestId = id
            }
        } catch (err) {
            // skip bibles that fail to load or are missing the reference
        }
    }

    if (bestScore >= QUOTE_MATCH_SCORE) ref.matchedBibleId = bestId
    else if (bestScore < QUOTE_DEMOTE_SCORE && ref.confidence === "high") ref.confidence = "medium" // suggestion only
}

function normalizeTokens(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/<[^>]*>/g, " ")
        .replace(/[^\p{L}\p{N}\s']/gu, " ")
        .split(/\s+/)
        .filter((a) => a.length > 1)
}

function tokenOverlapSimilarity(verseText: string, quote: string): number {
    const verseTokens = new Set(normalizeTokens(verseText))
    const quoteTokens = normalizeTokens(quote)
    if (!quoteTokens.length || !verseTokens.size) return 0

    let matched = 0
    quoteTokens.forEach((token) => {
        if (verseTokens.has(token)) matched++
    })
    return matched / quoteTokens.length
}

// detection confidence is categorical - map the bands onto the percent scale the
// auto-show threshold uses (the settings slider shows which band a percent lands in)
function confidencePercent(confidence: AiScriptureSettings["confidence"]): number {
    // if (confidence === "ask") return 100

    if (confidence === "highest") return 95
    if (confidence === "high") return 75
    if (confidence === "medium") return 50
    return 0
}

// same book/chapter with an overlapping verse range
type RefRange = Pick<DetectedReference, "bookNumber" | "chapter" | "verseStart" | "verseEnd">

function isSameReference(a: RefRange, b: RefRange) {
    return a.bookNumber === b.bookNumber && a.chapter === b.chapter && a.verseStart <= b.verseEnd && b.verseStart <= a.verseEnd
}

// SUGGESTIONS

function addSuggestion(ref: DetectedReference) {
    const confidence = confidencePercent(ref.confidence)
    if (confidence < 50) return

    aiSuggestions.update((a) => {
        a.push({
            id: ref.id,
            action: "present",
            content: getReferenceLabel(ref),
            timestamp: ref.timestamp,
            confidence: confidence,
            trigger: () => projectDetection(ref, true)
        })
        return a
    })

    aiScriptureSuggestions.update((list) => {
        const now = Date.now()
        let active = list.filter((a) => now - a.timestamp < SUGGESTION_MAX_AGE)

        // a correction supersedes an earlier similar-passage suggestion - replace, don't stack
        if (ref.corrects) active = active.filter((a) => !isSameReference(a, ref.corrects!))

        // skip near-duplicates of an existing suggestion
        if (active.some((a) => isSameReference(a, ref))) return active

        return [ref, ...active].slice(0, SUGGESTION_LIMIT)
    })

    function getReferenceLabel(suggestion: DetectedReference, _updater: any = null) {
        const drawerBibleId = get(drawerTabsData).scripture?.activeSubTab || ""

        let label = `${suggestion.book} ${suggestion.chapter}:${suggestion.verseStart}`
        if (suggestion.verseEnd > suggestion.verseStart) label += `-${suggestion.verseEnd}`

        const bibleId = suggestion.matchedBibleId || drawerBibleId
        if (bibleId === drawerBibleId) return label

        const bible = bibleId ? get(scriptures)[bibleId] : null
        if (bible) label += ` (${getShortBibleName(bible.customName || bible.name || "")})`

        return label
    }
}

export function pruneSuggestions() {
    aiSuggestions.update((a) => {
        const now = Date.now()
        const active = a.filter((a) => now - a.timestamp < SUGGESTION_MAX_AGE)
        return active.length === a.length ? a : active
    })

    aiScriptureSuggestions.update((list) => {
        const now = Date.now()
        const active = list.filter((a) => now - a.timestamp < SUGGESTION_MAX_AGE)
        return active.length === list.length ? list : active
    })
}

export function dismissSuggestion(id: string): void {
    aiSuggestions.update((a) => a.filter((a) => a.id !== id))

    aiScriptureSuggestions.update((list) => list.filter((a) => a.id !== id))
}

// AUTO PROJECTION

let pendingAutoRef: DetectedReference | null = null
let autoTimer: NodeJS.Timeout | null = null

/** The session is stopping - drop anything still queued for auto projection. */
export function cancelPendingAutoProjection(): void {
    if (autoTimer) {
        clearTimeout(autoTimer)
        autoTimer = null
    }
    pendingAutoRef = null
}

/** The wrong verse of a similar pair is on the output right now and this detection fixes it. */
function correctsLiveProjection(ref: DetectedReference): boolean {
    return !!(ref.corrects && scriptureState.lastAutoProjectedRef && isSameReference(scriptureState.lastAutoProjectedRef, ref.corrects))
}

/**
 * The speaker announced the reference (projected in the drawer translation) and is now READING it
 * in another version: with display translation "matched", the same passage re-projects in the
 * wording actually being read instead of being suppressed as a repeat.
 */
function refinesLiveTranslation(ref: DetectedReference): boolean {
    if (!ref.matchedBibleId || ref.matchedBibleId === scriptureState.lastAutoProjectedBibleId) return false
    return !!(scriptureState.lastAutoProjectedRef && isSameReference(scriptureState.lastAutoProjectedRef, ref))
}

function queueAutoProjection(ref: DetectedReference) {
    // a correction replacing what is live doesn't wait out the display cooldown - the point is
    // to take the wrong verse DOWN as fast as the right one goes up. The same goes for switching
    // the live passage to the translation the speaker turns out to be reading from
    if (correctsLiveProjection(ref) || refinesLiveTranslation(ref)) {
        cancelPendingAutoProjection()
        projectDetection(ref)
        return
    }

    // don't re-project a reference that was just auto projected less than 30s ago
    const refCooldownMs = 30 * 1000
    if (scriptureState.lastAutoProjectedRef && Date.now() - scriptureState.lastAutoProjectionAt < refCooldownMs && isSameReference(scriptureState.lastAutoProjectedRef, ref)) return

    // HIGH means the speaker explicitly asked or the match is decisive - it acts NOW. Only
    // medium waits out the minimum display time of what is currently showing
    if (ref.confidence === "high") {
        cancelPendingAutoProjection()
        projectDetection(ref)
        return
    }

    // respect the minimum display time of the current projection
    const cooldownMs = 3000
    const elapsed = Date.now() - scriptureState.lastAutoProjectionAt
    if (!scriptureState.lastAutoProjectionAt || elapsed >= cooldownMs) {
        projectDetection(ref)
        return
    }

    // queue until the cooldown ends - the latest detection wins
    pendingAutoRef = ref
    if (autoTimer) clearTimeout(autoTimer)
    autoTimer = setTimeout(() => {
        autoTimer = null
        const pending = pendingAutoRef
        pendingAutoRef = null

        if (!pending || !scriptureState.sessionActive) return

        const settings = getSettings()
        const confidence = settings.confidence || "ask"
        if (confidence === "ask") return

        if (get(outLocked)) return

        projectDetection(pending)
    }, cooldownMs - elapsed)
}
