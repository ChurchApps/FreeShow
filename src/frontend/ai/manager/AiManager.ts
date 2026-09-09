import { get, type Unsubscriber } from "svelte/store"
import { uid } from "uid"
import type { AiSuggestion, MatchResult } from "../../../types/ai/Ai"
import type { ConfidenceLevels } from "../../../types/ai/AiSettings"
import { startScripture } from "../../components/actions/apiHelper"
import { keysToID } from "../../components/helpers/array"
import { getFirstActiveOutput } from "../../components/helpers/output"
import { ai, aiSmartAction, aiSuggestions, drawerTabsData, outputs, scriptures } from "../../stores"
import { newToast } from "../../utils/common"
import { getLLMManager } from "../llm/llmManager"
import { BibleCacheManager } from "../scripture/BibleCacheManager"
import { isReferenceWithin } from "../scripture/references"

export class AiManager {
    private static lastMatch: number = 0
    private static MAX_LLM_REQUEST_AFTER_MATCH = 5000
    private static latestSearchId: number = 0

    static async processSTTChunk(chunk: { chunkWithOverlap: string; newWordsCount: number; confidence?: number }) {
        const searchId = ++this.latestSearchId
        const isCancelled = () => searchId !== this.latestSearchId

        const stringMatch = await this.stringDetection(chunk.chunkWithOverlap, isCancelled)
        if (isCancelled()) return

        if (stringMatch) {
            this.newMatch(stringMatch)
            this.lastMatch = Date.now()
            return
        }

        if (this.lastMatch && Date.now() - this.lastMatch < this.MAX_LLM_REQUEST_AFTER_MATCH) return

        const llmManager = getLLMManager()
        if (!llmManager) return

        // only report to LLM if nothing is auto detected
        const llmMatch = await llmManager.detectMatch(chunk)
        if (llmMatch) {
            this.newMatch(llmMatch)
            this.lastMatch = Date.now()
        }
    }

    private static async stringDetection(textChunk: string, isCancelled?: () => boolean) {
        const scriptureMatch = await this.globalBibleDetection(textChunk, isCancelled)
        if (scriptureMatch) return scriptureMatch

        return null
    }

    private static scriptureAlerted: boolean = false
    private static async globalBibleDetection(textChunk: string, isCancelled?: () => boolean) {
        const activeBibleId = get(drawerTabsData)?.scripture?.activeSubTab
        if (!activeBibleId) return null

        const scriptureData = get(scriptures)[activeBibleId]
        if (scriptureData?.api) {
            if (!this.scriptureAlerted) newToast("Please use a local Bible instead of an API Bible for the auto detection!")
            this.scriptureAlerted = true
            return null
        }

        const match = await this.bibleDetection(activeBibleId, textChunk, isCancelled)
        if (!match) return null

        // reference type matches stays on the active scripture
        if (match.scriptureMatchType !== "content") return match

        let highestConfidence = match.confidence || 0

        // check other local scriptures
        const allLocalScriptures = keysToID(get(scriptures)).filter((data) => !data.api && data.id !== activeBibleId)
        allLocalScriptures.forEach(async ({ id }) => {
            const otherMatch = await this.bibleDetection(id, textChunk, isCancelled)
            if (otherMatch?.confidence && otherMatch.confidence > highestConfidence) {
                highestConfidence = otherMatch.confidence
                this.newMatch({ ...otherMatch, scriptureIsNewTranslation: true })
            }
        })

        return match
    }

    private static async bibleDetection(id: string, textChunk: string, isCancelled?: () => boolean) {
        const bibleCache = await BibleCacheManager.getCache(id)
        if (!bibleCache || isCancelled?.()) return null

        const match = await bibleCache.search(textChunk, AiManager.liveContent, isCancelled)
        if (!match) return null

        match.scriptureTranslation = id
        return match
    }

    /////

    static newMatch(match: MatchResult) {
        if (match.type === "empty" || !match.content) return
        if (AiManager.liveContent === match.content) return

        if (match.type !== "scripture") return // WIP only scripture is implemented

        let suggestionDraft: any = {
            id: uid(5),
            timestamp: Date.now(),
            content: match.content,
            confidence: match.confidence
        }
        if (match.scriptureIsNewTranslation) suggestionDraft.scriptureTranslation = match.scriptureTranslation

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
        // get suggested, but remove any suggestions that have lower confidence than the current match
        const suggested = get(aiSuggestions)
            .filter((a) => a.content !== match.content || a.confidence >= match.confidence)
            .filter((a) => !isReferenceWithin(match.content, a.content))
            .map((item) => item.content)

        return suggested.includes(match.content)
    }

    private static MAX_AUTO_PLAY_INTERVAL = 30000
    private static shouldAutoPlay(match: MatchResult): boolean {
        if (match.confidence <= 95 && this.alreadySuggested(match)) return false

        // WIP currently only auto-plays scripture matches
        if (match.type !== "scripture") return false
        if (match.type === "scripture" && match.scriptureIsNewTranslation) return false

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
        console.log("[AiManager] Triggering match action for:", match)

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
