import { get } from "svelte/store"
import type { DetectedReference } from "../../../types/ai/AiScripture"
import { type BibleInstance, loadJsonBible } from "../../components/drawer/bible/scripture"
import { ai } from "../../stores"
import { AiManager } from "../manager/AiManager"
import { scriptureState } from "./scriptureState"

export async function handleDetection(ref: DetectedReference): Promise<void> {
    if (!get(ai).enabled || !scriptureState.sessionActive) return

    if (ref.type === "quoted" && ref.quote && !ref.matchedBibleId) {
        await verifyQuote(ref)
    }

    if (shouldAutoPlay(ref.confidence)) {
        AiManager.autoPlay("scripture", ref)
    } else {
        AiManager.suggest("scripture", ref)
    }
}

function shouldAutoPlay(refConfidence: number): boolean {
    const confidence = get(ai).scripture?.confidence || "ask"
    if (confidence === "ask") return false
    return refConfidence > getConfidenceScore(confidence)

    function getConfidenceScore(confidence: "ask" | "highest" | "high" | "medium"): number {
        if (confidence === "highest") return 95
        if (confidence === "high") return 75
        if (confidence === "medium") return 50
        return 100
    }
}

const QUOTE_MATCH_SCORE = 0.55
const QUOTE_DEMOTE_SCORE = 0.35
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

function resolveBookNumber(bible: BibleInstance, ref: DetectedReference): number {
    const books = bible.data.books || []
    if (books.length === 0 || books.length === 66) return ref.bookNumber

    const nameLower = (ref.book || "").toLowerCase()
    const match = books.find((a) => a.name?.toLowerCase() === nameLower || a.abbreviation?.toLowerCase() === nameLower || a.id?.toLowerCase() === nameLower)
    if (match) return match.number

    if (!nameLower || /^\d+$/.test(nameLower)) return 0
    const searched = bible.bookSearch(ref.book)
    const foundName = (searched?.book ? books.find((a) => a.number === searched.book)?.name || "" : "").toLowerCase()

    if (foundName && (foundName.startsWith(nameLower.slice(0, 4)) || nameLower.startsWith(foundName.slice(0, 4)))) {
        return searched!.book
    }

    console.warn(`[AiScripture] Could not resolve book "${ref.book}" in bible`)
    return 0
}
