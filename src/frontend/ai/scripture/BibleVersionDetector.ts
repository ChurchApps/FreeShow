import { get } from "svelte/store"
import type { MatchResult } from "../../../types/ai/Ai"
import { keysToID } from "../../components/helpers/array"
import { drawerTabsData, scriptures } from "../../stores"
import { getShortBibleName } from "../../components/drawer/bible/scripture"
import { AiManager } from "../manager/AiManager"
import { similarity } from "../../converters/txt"

interface Candidate {
    id: string
    name: string
    alias: string
    normalized: string
    isShort: boolean
}

export async function detectBibleVersion(textChunk: string, isCancelled?: () => boolean): Promise<MatchResult | null> {
    if (!textChunk || isCancelled?.()) return null

    const scripturesList = keysToID(get(scriptures)).filter((a) => !a.api && !a.collection)
    if (!scripturesList.length) return null

    // 1. Build and sort candidate match list
    const candidates = scripturesList.flatMap(buildCandidates).sort((a, b) => b.alias.length - a.alias.length)

    // Pre-calculate chunk metrics for normalized search
    const normalizedChunk = normalizeAlphaNum(textChunk)
    const activeBibleId = get(drawerTabsData)?.scripture?.activeSubTab

    // 2. Evaluate candidates against input chunk
    for (const candidate of candidates) {
        if (isCancelled?.()) return null

        // Check exact regex first, then fall back to fuzzy matching
        const aliasWords = candidate.alias.split(/\s+/).filter(Boolean)
        const pattern = aliasWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*")
        const isMatch = new RegExp(`\\b${pattern}\\b`, "i").test(textChunk) || isFuzzyMatch(normalizedChunk, candidate.normalized)

        if (isMatch) {
            if (candidate.id === activeBibleId) return null

            const scriptureData = get(scriptures)[candidate.id]
            const displayName = scriptureData?.customName || scriptureData?.name || candidate.name

            return {
                type: "scripture_version",
                content: AiManager.liveContent || displayName,
                confidence: candidate.isShort ? 85 : 95,
                scriptureTranslation: candidate.id,
                scriptureIsNewTranslation: true
            }
        }
    }

    return null
}

/// HELPERS ///

const normalizeAlphaNum = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "")

const splitCompound = (str: string): string =>
    str
        .replace(/([a-z])([A-Z])|([A-Z]+)([A-Z][a-z])|([a-zA-Z])(\d)|(\d)([a-zA-Z])/g, "$1$3$5$7 $2$4$6$8")
        .replace(/[_\-.]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()

function buildCandidates(scripture: any): Candidate[] {
    const candidates: Candidate[] = []
    const addedAliases = new Set<string>()

    const addAlias = (alias?: string, isShort = false) => {
        if (!alias) return
        const clean = alias.trim()
        const key = clean.toLowerCase()
        if (clean.length < 2 || addedAliases.has(key)) return

        addedAliases.add(key)
        candidates.push({
            id: scripture.id,
            name: scripture.customName || scripture.name,
            alias: clean,
            normalized: normalizeAlphaNum(clean),
            isShort
        })
    }

    const rawNames = [scripture.name, scripture.customName, scripture.id].filter(Boolean) as string[]

    for (const raw of rawNames) {
        addAlias(raw)

        const spaced = splitCompound(raw)
        if (spaced !== raw) addAlias(spaced)

        for (const name of [raw, spaced]) {
            const shortName = getShortBibleName(name)
            if (shortName && shortName.length >= 2) addAlias(shortName, true)
        }

        const parenMatch = raw.match(/\(([^)]+)\)/)?.[1]?.trim()
        if (parenMatch && parenMatch.length >= 2) {
            addAlias(parenMatch, parenMatch.length <= 5)
            const shortInside = getShortBibleName(parenMatch)
            if (shortInside && shortInside.length >= 2) addAlias(shortInside, true)
        }
    }

    return candidates
}

function isFuzzyMatch(text: string, candidate: string, threshold = 0.82): boolean {
    if (candidate.length < 4) return false

    // Exact match check first
    if (text.includes(candidate)) return true

    // Compare similarity across candidate-sized chunks
    for (let i = 0; i <= text.length - candidate.length; i++) {
        const slice = text.slice(i, i + candidate.length)
        if (similarity(slice, candidate) >= threshold) return true
    }

    return false
}
