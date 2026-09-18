import { getLabelId } from "../components/helpers/show"
import { findGroupMatch, similarity } from "./txt"

const SIMILARITY_THRESHOLD = 0.7

export function findPatterns(sections: string[], autoGroups: boolean) {
    let passedInstrumentalBreak = false
    const stored: { type: string; text: string }[] = []

    // get non-empty lines
    const getLines = (text: string) => text.split("\n").filter(Boolean)

    // Pre-calculate similarity counts for each section
    const similarCount = sections.map((sec, i) => {
        const matches = sections
            .map((s, j) => (i !== j && similarity(sec, s) >= SIMILARITY_THRESHOLD ? j : -1))
            .filter((j) => j !== -1)
        return { matches, count: matches.length }
    })

    const primaryChorusIndex = findPrimaryChorusIndex(sections, similarCount)
    const detectedIndexes = similarCount.map((similar, i) => analyzeSection(similar, i))

    // if all slides has the same group, set to "verse"
    const uniqueGroups = new Set(detectedIndexes)
    const indexes = uniqueGroups.size === 1 ? detectedIndexes.map(() => "verse") : detectedIndexes

    return { sections, indexes }

    // --- Dynamic Structural Helpers ---

    function findPrimaryChorusIndex(secs: string[], simCounts: { matches: number[]; count: number }[]): number {
        const refrainIndex = secs.findIndex(isRepetitiveRefrain)
        if (refrainIndex !== -1) return refrainIndex

        let bestIndex = -1
        let highestScore = -1

        for (let i = 1; i < secs.length; i++) {
            if (simCounts[i].count === 0 && simCounts.some((s) => s.count > 0)) continue
            if (similarity(secs[0], secs[i]) >= SIMILARITY_THRESHOLD) continue

            const lines = getLines(secs[i])
            const isRefrain = isInternalRepetition(secs[i]) || lines.length <= 4

            let score = simCounts[i].count * 3
            if (i === 1 && simCounts[1].count === 0) score -= 5
            else if (isRefrain) score += 5

            if (score > highestScore) {
                highestScore = score
                bestIndex = i
            }
        }
        return bestIndex
    }

    function isRepetitiveRefrain(text: string): boolean {
        const words = cleanText(text).split(/\s+/).filter(Boolean)
        if (words.length < 6) return false

        const freqMap: Record<string, number> = {}
        for (const word of words) {
            freqMap[word] = (freqMap[word] || 0) + 1
        }

        const topWordsCount = Object.values(freqMap)
            .sort((a, b) => b - a)
            .slice(0, 2)
            .reduce((sum, val) => sum + val, 0)

        return topWordsCount / words.length >= 0.5
    }

    function isInternalRepetition(text: string): boolean {
        const lines = getLines(text).map(cleanText).filter(Boolean)
        return lines.length >= 2 && new Set(lines).size <= Math.ceil(lines.length / 2)
    }

    function cleanText(text: string): string {
        return text.toLowerCase().replace(/\n/g, " ").replace(/[^\p{L}\s]/gu, "").replace(/\s+/g, " ").trim()
    }

    // --- Section Analysis ---

    function analyzeSection(similar: { matches: number[]; count: number }, i: number): string {
        const section = sections[i]
        const lines = getLines(section)
        if (!lines.length) return "break"

        const firstLine = lines[0]
        const trimmedFirstLine = firstLine.trim()
        const rawName = firstLine.replace(/[\[\]'":]+/g, "").trim()

        // 1. Explicit Header / Group Matching
        const exactMatch = findGroupMatch(rawName) || findGroupMatch(getLabelId(firstLine))
        if (exactMatch) {
            passedInstrumentalBreak = true
            return exactMatch
        }

        // 2. Single-line Section Breaks
        if (lines.length === 1 && !rawName.includes(" ")) {
            passedInstrumentalBreak = true
            return rawName.toLowerCase()
        }

        if (/^\[.*\]$/.test(trimmedFirstLine) || trimmedFirstLine.endsWith(":")) {
            passedInstrumentalBreak = true
            return rawName.replace(/x?\d+/gi, "").trim()
        }

        if (!autoGroups) return "verse"

        const storeSection = (type: string) => {
            stored.push({ type, text: section })
            return type
        }

        // --- Automatic Group Detection ---
        const repeatsInSong = similar.count > 0
        const hasTextRepetitions = similarCount.some((s) => s.count > 0)
        const hasChorus = stored.some((s) => s.type === "chorus")
        const isVerseFootprint = Boolean(sections[0] && matchesVerseStructure(section, sections[0]))

        // Priority 1: Stored Matches
        const existingMatch = checkExistingMatch(section)
        if (existingMatch) return existingMatch

        // Priority 2: Refrain Override
        if (isRepetitiveRefrain(section)) return storeSection("chorus")

        // Priority 3: Pre-Chorus
        if (checkPreChorus(i, repeatsInSong, isVerseFootprint, hasChorus)) return storeSection("pre_chorus")

        // Priority 4: Initial Verses
        if ((i === 0 || i === 1) && !repeatsInSong) return storeSection("verse")

        // Priority 5: Dynamic Chorus Assignment
        if (checkChorus(i, section, lines, repeatsInSong, hasChorus, hasTextRepetitions)) return storeSection("chorus")

        // Priority 6: Verse Footprint Matching
        if (isVerseFootprint) return storeSection("verse")

        // Priority 7: Tag
        if (checkTag(section, lines, hasChorus)) return storeSection("tag")

        // Priority 8: Bridge
        if (checkBridge(i, isVerseFootprint, hasChorus)) return storeSection("bridge")

        // Fallback
        return storeSection("verse")
    }

    function matchesVerseStructure(sec: string, verse0: string): boolean {
        const linesSec = getLines(sec)
        const linesVerse = getLines(verse0)

        if (linesSec.length !== linesVerse.length) return false

        const avgSecWords = cleanText(sec).split(/\s+/).length / linesSec.length
        const avgVerseWords = cleanText(verse0).split(/\s+/).length / linesVerse.length

        return Math.abs(avgSecWords - avgVerseWords) <= 3
    }

    function isLineSubsetMatch(s1: string, s2: string): boolean {
        const lines1 = getLines(s1).map(cleanText).filter(Boolean)
        const lines2 = getLines(s2).map(cleanText).filter(Boolean)
        if (!lines1.length || !lines2.length) return false

        const set1 = new Set(lines1)
        const set2 = new Set(lines2)

        const shared1 = lines1.filter((l) => set2.has(l)).length
        const shared2 = lines2.filter((l) => set1.has(l)).length

        return shared1 / lines1.length >= 0.75 || shared2 / lines2.length >= 0.75
    }

    // --- Priority Rule Checks ---

    function checkExistingMatch(section: string): string | null {
        const currentClean = cleanText(section)
        const match = stored.find(({ text }) => {
            const storedClean = cleanText(text)
            return (
                similarity(text, section) >= SIMILARITY_THRESHOLD ||
                (storedClean === currentClean && currentClean.length > 0) ||
                isLineSubsetMatch(text, section)
            )
        })
        return match?.type ?? null
    }

    function checkPreChorus(i: number, repeatsInSong: boolean, isVerseFootprint: boolean, hasChorus: boolean): boolean {
        if (i === 0 || hasChorus || primaryChorusIndex === -1 || i >= primaryChorusIndex) return false

        const next = sections[i + 1]
        const primary = sections[primaryChorusIndex]
        const precedesChorus = i + 1 === primaryChorusIndex || similarity(next, primary) >= SIMILARITY_THRESHOLD || isLineSubsetMatch(next, primary)

        return precedesChorus && (repeatsInSong || !isVerseFootprint)
    }

    function checkChorus(i: number, section: string, lines: string[], repeatsInSong: boolean, hasChorus: boolean, hasTextRepetitions: boolean): boolean {
        const primary = sections[primaryChorusIndex]

        if (primaryChorusIndex === i || (primaryChorusIndex !== -1 && isLineSubsetMatch(primary, section))) return true
        if (!hasChorus && !hasTextRepetitions && i === 2) return true

        const isRefrain = isInternalRepetition(section) || lines.length <= 4
        return !hasChorus && repeatsInSong && primaryChorusIndex === -1 && isRefrain
    }

    function checkTag(section: string, lines: string[], hasChorus: boolean): boolean {
        return hasChorus && isInternalRepetition(section) && lines.length <= 6
    }

    function checkBridge(i: number, isVerseFootprint: boolean, hasChorus: boolean): boolean {
        return (hasChorus && !isVerseFootprint) || i > 2 || passedInstrumentalBreak
    }
}
