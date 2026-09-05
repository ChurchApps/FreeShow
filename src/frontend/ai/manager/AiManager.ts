import { get, type Unsubscriber } from "svelte/store"
import type { AiSuggestion } from "../../../types/ai/Ai"
import type { DetectedReference } from "../../../types/ai/AiScripture"
import { getShortBibleName } from "../../components/drawer/bible/scripture"
import { clone } from "../../components/helpers/array"
import { setDrawerTabData } from "../../components/helpers/historyHelpers"
import { getFirstActiveOutput } from "../../components/helpers/output"
import { activeDrawerTab, activePage, aiSmartAction, aiSuggestions, drawerTabsData, openScripture, outputs, scriptures } from "../../stores"

type AiSuggestType = "scripture"

export class AiManager {
    private static autoPlayLog = new Map<string, { content: string; time: number }>()
    static autoPlay(type: AiSuggestType, content: DetectedReference) {
        listenToOutput()

        const now = Date.now()
        // skip if the output was manually updated recently
        if (lastOutputUpdate && now - lastOutputUpdate < 3000) {
            this.suggest("scripture", content)
            return
        }

        const contentId = JSON.stringify(content)
        const log = this.autoPlayLog.get(type)
        if (log) {
            const now = Date.now()
            // just auto played
            if (now - log.time < 5000 && log.content === contentId) return
        }

        content = clone(content)

        this.autoPlayLog.set(type, { content: contentId, time: Date.now() })
        this.notifyAutoPresented(content)

        console.log(`Auto-playing ${type}:`, content)
        this.triggerFromType(type, content)

        setTimeout(() => {
            // reset output updates when auto played
            lastOutputUpdate = 0
        }, 1000)
    }

    static suggest(type: AiSuggestType, content: DetectedReference) {
        content = clone(content)

        const activeTranslationId = get(drawerTabsData).scripture?.activeSubTab || ""
        if (content.matchedBibleId && content.matchedBibleId !== activeTranslationId) {
            // TODO: request to change translation
            return
        }

        const label = this.labelFromType(type, content)

        const suggestion = {
            id: content.id,
            action: "present" as const,
            content: label,
            timestamp: content.timestamp,
            confidence: content.confidence,
            trigger: () => this.triggerFromType(type, content)
        }

        this.addSuggestion(suggestion)
    }

    private static labelFromType(type: AiSuggestType, content: DetectedReference) {
        if (type === "scripture") {
            return getReferenceLabel(content)
        }
        return ""
    }

    private static triggerFromType(type: AiSuggestType, content: DetectedReference) {
        if (type === "scripture") {
            this.playScripture(content)
        }
    }

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

    private static notifyAutoPresented(content: DetectedReference) {
        const label = this.labelFromType("scripture", content)
        const id = `auto_${content.id}`

        const suggestion = {
            id,
            action: "presented" as const,
            content: label,
            timestamp: Date.now(),
            confidence: content.confidence
        }

        this.addSuggestion(suggestion)
    }

    private static playScripture(content: DetectedReference) {
        const activeTranslationId = get(drawerTabsData).scripture?.activeSubTab || ""
        if (content.matchedBibleId && content.matchedBibleId !== activeTranslationId) {
            setDrawerTabData("scripture", content.matchedBibleId)
        }

        let book: number | string = content.bookNumber
        let chapter = content.chapter
        let verseStart = content.verseStart
        let verseEnd = Math.max(content.verseStart, content.verseEnd)

        const maxVerses = 10
        verseEnd = Math.min(verseEnd, verseStart + maxVerses - 1)

        const verses = Array.from({ length: verseEnd - verseStart + 1 }, (_, i) => verseStart + i)

        // WIP similar to apiHelper.ts startScripture
        if (get(activePage) !== "edit") activePage.set("show")
        activeDrawerTab.set("scripture")

        openScripture.set({ book, chapter, verses, play: true })
    }
}

function getReferenceLabel(suggestion: DetectedReference): string {
    let label = `${suggestion.book} ${suggestion.chapter}:${suggestion.verseStart}`
    if (suggestion.verseEnd > suggestion.verseStart) label += `-${suggestion.verseEnd}`

    const drawerBibleId = get(drawerTabsData).scripture?.activeSubTab || ""
    const bibleId = suggestion.matchedBibleId || drawerBibleId
    if (bibleId === drawerBibleId) return label

    const bible = bibleId ? get(scriptures)[bibleId] : null
    if (bible) label += ` (${getShortBibleName(bible.customName || bible.name || "")})`

    return label
}

let lastOutputUpdate = 0
let outputListener: Unsubscriber | null = null
function listenToOutput() {
    if (outputListener) return

    let initialized = false
    setTimeout(() => (initialized = true), 1000)

    let previousOutput = ""
    outputListener = outputs.subscribe(() => {
        const firstOutput = getFirstActiveOutput()
        const slide = firstOutput?.out?.slide || null

        const slideKey = JSON.stringify(slide)
        if (slideKey === JSON.stringify(previousOutput)) return
        previousOutput = slideKey

        if (initialized) lastOutputUpdate = Date.now()
    })
}
