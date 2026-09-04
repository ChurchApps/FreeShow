import { get } from "svelte/store"
import type { DetectedReference } from "../../../types/ai/AiScripture"
import { getShortBibleName, loadJsonBible } from "../../components/drawer/bible/scripture"
import { clone } from "../../components/helpers/array"
import { ai, aiSmartAction, aiSuggestions, drawerTabsData, outLocked, scriptures } from "../../stores"
import { projectDetection, resolveBookNumber } from "./projection"
import { scriptureState } from "./scriptureState"

const SUGGESTION_MAX_AGE = 5 * 60 * 1000
const SUGGESTION_LIMIT = 5
const QUOTE_MATCH_SCORE = 0.55
const QUOTE_DEMOTE_SCORE = 0.35

function canAutoProjectFor(refConfidence: number): boolean {
    const confidence = get(ai).scripture?.confidence || "ask"
    if (confidence === "ask" || get(outLocked)) return false
    return confidencePercent(refConfidence) >= confidencePercent(confidence)
}

export async function handleDetection(ref: DetectedReference): Promise<void> {
    if (!get(ai).enabled || !scriptureState.sessionActive) return

    if (ref.type === "quoted" && ref.quote && !ref.matchedBibleId) {
        await verifyQuote(ref)
    }

    if (canAutoProjectFor(ref.confidence)) {
        queueAutoProjection(ref)
    } else {
        addSuggestion(ref)
    }
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
                text += ` ${Chapter.getVerse(v).getText()}`
            }

            const score = tokenOverlapSimilarity(text, quote)
            if (score > bestScore) {
                bestScore = score
                bestId = id
            }
        } catch {
            // Skip bibles missing reference or failed loads
        }
    }

    if (bestScore >= QUOTE_MATCH_SCORE) {
        ref.matchedBibleId = bestId
    } else if (bestScore < QUOTE_DEMOTE_SCORE && ref.confidence >= 75) {
        ref.confidence = Math.max(50, ref.confidence - 25)
    }
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

    const matched = quoteTokens.reduce((count, token) => (verseTokens.has(token) ? count + 1 : count), 0)
    return matched / quoteTokens.length
}

function confidencePercent(confidence: string | number | undefined): number {
    if (typeof confidence === "number") return confidence
    switch (confidence) {
        case "highest":
            return 95
        case "high":
            return 75
        case "medium":
            return 50
        default:
            return 0
    }
}

type RefRange = Pick<DetectedReference, "bookNumber" | "chapter" | "verseStart" | "verseEnd">

function isSameReference(a: RefRange, b: RefRange) {
    return a.bookNumber === b.bookNumber && a.chapter === b.chapter && a.verseStart <= b.verseEnd && b.verseStart <= a.verseEnd
}

function getReferenceLabel(suggestion: DetectedReference, drawerBibleId: string): string {
    let label = `${suggestion.book} ${suggestion.chapter}:${suggestion.verseStart}`
    if (suggestion.verseEnd > suggestion.verseStart) label += `-${suggestion.verseEnd}`

    const bibleId = suggestion.matchedBibleId || drawerBibleId
    if (bibleId === drawerBibleId) return label

    const bible = bibleId ? get(scriptures)[bibleId] : null
    if (bible) label += ` (${getShortBibleName(bible.customName || bible.name || "")})`

    return label
}

// SMART ACTION
let smartActionTimer: NodeJS.Timeout | null = null

export function setSmartAction(action: import("../../../types/ai/Ai").AiSuggestion | null, durationMs?: number): void {
    if (smartActionTimer) {
        clearTimeout(smartActionTimer)
        smartActionTimer = null
    }
    aiSmartAction.set(action)
    if (action && durationMs) {
        smartActionTimer = setTimeout(() => {
            smartActionTimer = null
            aiSmartAction.update((cur) => (cur?.id === action.id ? null : cur))
        }, durationMs)
    }
}

// SUGGESTIONS
const SUGGESTION_SMART_ACTION_DURATION = 30 * 1000

function addSuggestion(ref: DetectedReference) {
    const confidence = confidencePercent(ref.confidence)
    if (confidence < 50) return
    const drawerBibleId = get(drawerTabsData).scripture?.activeSubTab || ""
    const label = getReferenceLabel(ref, drawerBibleId)

    const suggestionItem = {
        id: ref.id,
        action: "present" as const,
        content: label,
        timestamp: ref.timestamp,
        confidence,
        trigger: () => projectDetection(clone(ref), true)
    }

    setSmartAction(suggestionItem, SUGGESTION_SMART_ACTION_DURATION)

    aiSuggestions.update((list) => {
        const now = Date.now()
        let active = list.filter((a) => now - a.timestamp < SUGGESTION_MAX_AGE)

        if (ref.corrects) active = active.filter((a) => a.id !== ref.corrects?.id)

        if (active.some((a) => a.id === ref.id || a.content === label)) return active

        return [suggestionItem, ...active].slice(0, SUGGESTION_LIMIT)
    })
}

export function pruneSuggestions() {
    aiSuggestions.update((list) => {
        const now = Date.now()
        const active = list.filter((a) => now - a.timestamp < SUGGESTION_MAX_AGE)
        return active.length === list.length ? list : active
    })
}

export function dismissSuggestion(id: string): void {
    const timer = autoDismissTimers.get(id)
    if (timer) {
        clearTimeout(timer)
        autoDismissTimers.delete(id)
    }
    aiSmartAction.update((cur) => (cur?.id === id ? null : cur))
    aiSuggestions.update((list) => list.filter((a) => a.id !== id))
}

// AUTO PROJECTION
let pendingAutoRef: DetectedReference | null = null
let autoTimer: NodeJS.Timeout | null = null

export function cancelPendingAutoProjection(): void {
    if (autoTimer) {
        clearTimeout(autoTimer)
        autoTimer = null
    }
    pendingAutoRef = null
    setSmartAction(null)
    for (const timer of autoDismissTimers.values()) {
        clearTimeout(timer)
    }
    autoDismissTimers.clear()
}

function correctsLiveProjection(ref: DetectedReference): boolean {
    return !!(ref.corrects && scriptureState.lastAutoProjectedRef && isSameReference(scriptureState.lastAutoProjectedRef, ref.corrects))
}
function refinesLiveTranslation(ref: DetectedReference): boolean {
    if (!ref.matchedBibleId || ref.matchedBibleId === scriptureState.lastAutoProjectedBibleId) return false
    return !!(scriptureState.lastAutoProjectedRef && isSameReference(scriptureState.lastAutoProjectedRef, ref))
}

const AUTO_PRESENT_MESSAGE_DURATION = 4000
const autoDismissTimers = new Map<string, NodeJS.Timeout>()

function notifyAutoPresented(ref: DetectedReference) {
    const confidence = confidencePercent(ref.confidence)
    const drawerBibleId = get(drawerTabsData).scripture?.activeSubTab || ""
    const label = getReferenceLabel(ref, drawerBibleId)
    const id = `auto_${ref.id}`

    const notificationItem = {
        id,
        action: "presented" as const,
        content: label,
        timestamp: Date.now(),
        confidence
    }

    setSmartAction(notificationItem, AUTO_PRESENT_MESSAGE_DURATION)

    aiSuggestions.update((list) => {
        let active = list.filter((a) => a.id !== id && a.id !== ref.id)
        if (ref.corrects) active = active.filter((a) => a.id !== ref.corrects?.id && a.id !== `auto_${ref.corrects?.id}`)

        return [notificationItem, ...active].slice(0, SUGGESTION_LIMIT)
    })

    const existingTimer = autoDismissTimers.get(id)
    if (existingTimer) clearTimeout(existingTimer)

    const timer = setTimeout(() => {
        autoDismissTimers.delete(id)
        dismissSuggestion(id)
    }, AUTO_PRESENT_MESSAGE_DURATION)

    autoDismissTimers.set(id, timer)
}

function queueAutoProjection(ref: DetectedReference) {
    if (correctsLiveProjection(ref) || refinesLiveTranslation(ref)) {
        cancelPendingAutoProjection()
        projectDetection(ref)
        notifyAutoPresented(ref)
        return
    }

    const refCooldownMs = 30 * 1000
    if (scriptureState.lastAutoProjectedRef && Date.now() - scriptureState.lastAutoProjectionAt < refCooldownMs && isSameReference(scriptureState.lastAutoProjectedRef, ref)) {
        return
    }

    if (ref.confidence >= 75) {
        cancelPendingAutoProjection()
        projectDetection(ref)
        notifyAutoPresented(ref)
        return
    }

    const cooldownMs = 3000
    const elapsed = Date.now() - scriptureState.lastAutoProjectionAt
    if (!scriptureState.lastAutoProjectionAt || elapsed >= cooldownMs) {
        projectDetection(ref)
        notifyAutoPresented(ref)
        return
    }

    pendingAutoRef = clone(ref)
    if (autoTimer) clearTimeout(autoTimer)
    autoTimer = setTimeout(() => {
        autoTimer = null
        const pending = pendingAutoRef
        pendingAutoRef = null

        if (pending && scriptureState.sessionActive && canAutoProjectFor(pending.confidence)) {
            projectDetection(pending)
            notifyAutoPresented(pending)
        }
    }, cooldownMs - elapsed)
}
