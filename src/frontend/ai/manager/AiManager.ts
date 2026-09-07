import { get, type Unsubscriber } from "svelte/store"
import { uid } from "uid"
import type { AiSuggestion } from "../../../types/ai/Ai"
import type { ConfidenceLevels } from "../../../types/ai/AiSettings"
import { startScripture } from "../../components/actions/apiHelper"
import { getFirstActiveOutput } from "../../components/helpers/output"
import { ai, aiSmartAction, aiSuggestions, drawerTabsData, outputs } from "../../stores"
import { getLLMManager } from "../llm/llmManager"
import { BibleCacheManager } from "../scripture/BibleCacheManager"

export interface MatchResult {
    type: "scripture" | "lyrics" | "quote" | "announcement" | "empty"
    content: string // "scripture" = reference (e.g., "Genesis 1:1")
    confidence: number // 1-100
}

export class AiManager {
    private static lastMatch: number = 0
    private static MAX_LLM_REQUEST_AFTER_MATCH = 5000
    private static latestSearchId: number = 0

    static async processSTTChunk(chunk: { chunkWithOverlap: string; newWordsCount: number; confidence?: number }) {
        const searchId = ++this.latestSearchId
        const isCancelled = () => searchId !== this.latestSearchId

        // a match is only as sure as the words it was read from
        const cap = (match: MatchResult): MatchResult => (chunk.confidence === undefined ? match : { ...match, confidence: Math.min(match.confidence, chunk.confidence) })

        const stringMatch = await this.stringDetection(chunk.chunkWithOverlap, isCancelled)
        if (isCancelled()) return

        if (stringMatch) {
            this.newMatch(cap(stringMatch))
            this.lastMatch = Date.now()
            return
        }

        if (this.lastMatch && Date.now() - this.lastMatch < this.MAX_LLM_REQUEST_AFTER_MATCH) return

        const llmManager = getLLMManager()
        if (!llmManager) return

        // only report to LLM if nothing is auto detected
        const llmMatch = await llmManager.detectMatch(chunk)
        if (isCancelled()) return

        if (llmMatch) {
            this.newMatch(cap(llmMatch))
            this.lastMatch = Date.now()
        }
    }

    private static async stringDetection(textChunk: string, isCancelled?: () => boolean) {
        const scriptureMatch = await this.bibleDetection(textChunk, isCancelled)
        return scriptureMatch
    }

    private static async bibleDetection(textChunk: string, isCancelled?: () => boolean) {
        const activeBibleId = get(drawerTabsData)?.scripture?.activeSubTab
        if (!activeBibleId) return null

        const bibleCache = await BibleCacheManager.getCache(activeBibleId)
        if (!bibleCache || isCancelled?.()) return null

        return bibleCache.search(textChunk, AiManager.liveContent, isCancelled)
    }

    /////

    static newMatch(match: MatchResult) {
        if (match.type === "empty" || !match.content) return
        if (AiManager.liveContent === match.content) return

        let suggestionDraft: any = {
            id: uid(5),
            timestamp: Date.now(),
            content: match.content,
            confidence: match.confidence
        }

        const trigger = () => this.triggerMatchAction(match)

        if (this.shouldAutoPlay(match)) {
            const suggestion = { ...suggestionDraft, action: "presented" }
            this.addSuggestion(suggestion)

            console.info(`Auto-playing ${match.type}:`, match.content)
            trigger()
            return
        }

        const suggestion = { ...suggestionDraft, action: "present", trigger }
        this.addSuggestion(suggestion)
    }

    private static alreadySuggested(match: MatchResult): boolean {
        // const currentlyPresented = AiManager.liveContent

        // get suggested, but remove any suggestions that have lower confidence than the current match
        const suggested = get(aiSuggestions)
            .filter((a) => a.content !== match.content || a.confidence >= match.confidence)
            .map((item) => item.content)
        return suggested.includes(match.content)

        // TODO: filter out "Matthew 7:1-2" if outputted is "Matthew 7:1-6"?
    }

    private static MAX_AUTO_PLAY_INTERVAL = 30000
    private static shouldAutoPlay(match: MatchResult): boolean {
        if (match.confidence <= 95 && this.alreadySuggested(match)) return false

        // WIP currently only auto-plays scripture matches
        if (match.type !== "scripture") return false

        // never auto-play low confidence matches
        if (match.confidence <= 50) return false

        const now = Date.now()
        // skip if the output was manually updated recently
        if (this.lastOutputUpdate && now - this.lastOutputUpdate < this.MAX_AUTO_PLAY_INTERVAL) return false

        const confidence = get(ai)[match.type]?.confidence || "ask"
        if (confidence === "ask") return false

        const autoPlay = match.confidence > this.getConfidenceScore(confidence)
        if (autoPlay) this.listenToOutput()
        return autoPlay
    }

    private static getConfidenceScore(confidence: ConfidenceLevels): number {
        if (confidence === "highest") return 95
        if (confidence === "high") return 75
        if (confidence === "medium") return 50
        return 100
    }

    static liveContent: string = ""
    private static triggerMatchAction(match: MatchResult) {
        if (match.type === "scripture") {
            startScripture({ reference: match.content })
        }

        this.liveContent = match.content

        setTimeout(() => {
            // reset output updates when not "manually" played
            this.lastOutputUpdate = 0
        }, 500)
    }

    /////

    private static smartActionTimer: NodeJS.Timeout | null = null
    private static SMART_ACTION_DURATION = 30 * 1000 // 30 seconds
    private static setSmartAction(content: AiSuggestion) {
        aiSmartAction.set(content)

        const TIMEOUT = content.action === "presented" ? 4000 : this.SMART_ACTION_DURATION

        if (this.smartActionTimer) {
            clearTimeout(this.smartActionTimer)
            this.smartActionTimer = null
        }
        this.smartActionTimer = setTimeout(() => {
            this.smartActionTimer = null
            aiSmartAction.update((a) => (a?.id === content.id ? null : a))
        }, TIMEOUT)
    }

    private static SUGGESTION_MAX_AGE = 5 * 60 * 1000 // 5 minutes
    private static SUGGESTION_LIMIT = 5
    private static addSuggestion(content: AiSuggestion) {
        this.setSmartAction(content)

        aiSuggestions.update((list) => {
            const now = Date.now()

            // remove timed out suggestions
            let active = list.filter((a) => now - a.timestamp < this.SUGGESTION_MAX_AGE)

            // remove duplicate suggestions
            active = active.filter((a) => a.id !== content.id && a.content !== content.content)

            return [content, ...active].slice(0, this.SUGGESTION_LIMIT)
        })
    }

    /////

    private static lastOutputUpdate = 0
    private static outputListener: Unsubscriber | null = null
    private static listenToOutput() {
        if (this.outputListener) return

        let initialized = false
        setTimeout(() => (initialized = true), 1000)

        let previousOutput = ""
        this.outputListener = outputs.subscribe(() => {
            const firstOutput = getFirstActiveOutput()
            const slide = firstOutput?.out?.slide || null

            const slideKey = JSON.stringify(slide)
            if (slideKey === JSON.stringify(previousOutput)) return
            previousOutput = slideKey

            if (initialized) this.lastOutputUpdate = Date.now()
        })
    }
}
