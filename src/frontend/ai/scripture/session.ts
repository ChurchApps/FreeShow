import { get } from "svelte/store"
import type { AiScriptureBook } from "../../../types/ai/AiScripture"
import { ai, aiInterim, aiLlmStatus, aiSmartAction, aiSttStatus, aiSuggestions, scriptures } from "../../stores"
import type { AIProviderId } from "../llm/llmModels"
import { llmSession } from "../llm/llmSession"
import { resolveSttEngine } from "../stt/stt"
import type { AiScriptureAnchor } from "./detection/coordinator"
import { DetectionCoordinator } from "./detection/coordinator"
import { handleDetection } from "./detections"
import { startQuoteMatching, stopQuoteMatching } from "./quoteMatch/quoteMatcherEngine"
import { scriptureState } from "./scriptureState"
import { bookTableIds, buildBookTable, cancelSessionBiblesRefresh, scheduleSessionBiblesRefresh, sessionBibleIds } from "./sessionBibles"

let suggestionPruneTimer: NodeJS.Timeout | null = null
let scriptureCoordinator: DetectionCoordinator | null = null
let scriptureConfig: { interpretationMode: boolean; listenLanguage: string } | null = null

function isListeningStatus(state?: string): boolean {
    return state === "listening" || state === "llm_paused"
}

async function startScriptureSession(): Promise<{ ok: boolean; error?: string }> {
    stopScriptureSession()

    scriptureState.searchBibleIds = sessionBibleIds()
    const tableIds = bookTableIds()
    if (!tableIds.length) return { ok: false, error: "no_scripture" }

    const books = await buildBookTable(tableIds)
    if (!books.length) return { ok: false, error: "no_scripture" }

    const sttSettings = get(ai).stt || {}
    const engine = resolveSttEngine()
    const engineOptions = sttSettings.engineOptions?.[engine] || {}

    const language = engine === "nemotron" ? "en" : engineOptions.language || "en"
    const interpretationMode = engine === "whisper" && engineOptions.interpretationMode === true
    const listenLanguage = engineOptions.listenLanguage || language

    await llmSession.refreshConfig()
    const llm = llmSession.getConfig()

    scriptureConfig = { interpretationMode, listenLanguage }

    scriptureCoordinator = new DetectionCoordinator({
        books,
        llm,
        onDetection: handleDetection,
        onStatus: (state, extra) => {
            const message = extra?.message ? extra.message.replace(/\s+/g, " ").trim().slice(0, 200) : undefined
            aiLlmStatus.set({ state, ...extra, ...(message ? { message } : {}) })
        }
    })

    scriptureState.sessionActive = true
    aiLlmStatus.set({ state: "listening", keyless: !llm })

    startQuoteMatching({
        bibleIds: scriptureState.searchBibleIds,
        interpretationMode,
        listenLanguage,
        onDetection: handleDetection
    })

    return { ok: true }
}

export function stopScriptureSession(): void {
    scriptureState.sessionActive = false
    stopQuoteMatching()
    cancelSessionBiblesRefresh()
    scriptureState.lastQuoteMatchAnchor = null

    if (suggestionPruneTimer) {
        clearInterval(suggestionPruneTimer)
        suggestionPruneTimer = null
    }
    aiSuggestions.set([])
    aiSmartAction.set(null)

    scriptureCoordinator?.stop()
    scriptureCoordinator = null
    scriptureConfig = null

    aiInterim.set("")
    aiLlmStatus.set({ state: "stopped" })
}

export function handleScriptureTranscript(segment: { text: string; startMs: number; endMs: number; language?: string; music?: boolean }): void {
    if (!scriptureState.sessionActive || !scriptureCoordinator || segment.music || !segment.text) return

    const config = scriptureConfig
    const isLanguageMatch = !config?.listenLanguage || segment.language === config.listenLanguage
    const isDetectable = !config?.interpretationMode || !segment.language || isLanguageMatch

    if (isDetectable) {
        scriptureCoordinator.onTranscriptSegment(segment)
    }
}

export function updateScriptureCoordinatorBooks(books: AiScriptureBook[]): void {
    scriptureCoordinator?.updateBooks(books)
}

export function updateScriptureCoordinatorLlm(llm: { provider: AIProviderId; model: string } | null): void {
    scriptureCoordinator?.updateLlm(llm)
}

export function updateScriptureCoordinatorContext(anchor: AiScriptureAnchor): void {
    scriptureCoordinator?.updateContext(anchor)
}

// WATCHERS
aiSttStatus.subscribe((status) => {
    const isAiEnabled = get(ai).enabled
    if (isAiEnabled && isListeningStatus(status.state)) {
        if (!scriptureState.sessionActive) void startScriptureSession()
    } else if (scriptureState.sessionActive) {
        stopScriptureSession()
    }
})

let lastLlmConfigKey = ""
ai.subscribe((value) => {
    const key = `${value?.llm?.provider || ""}|${value?.llm?.model || ""}`
    if (key !== lastLlmConfigKey) {
        lastLlmConfigKey = key
        if (scriptureState.sessionActive) {
            void llmSession.refreshConfig().then(() => {
                if (scriptureState.sessionActive) updateScriptureCoordinatorLlm(llmSession.getConfig())
            })
        }
    }
})

let lastLibraryKey: string | null = null
scriptures.subscribe((value) => {
    const key = Object.entries(value || {})
        .map(([id, bible]) => `${id}:${bible?.customName || bible?.name || ""}:${bible?.favorite ? 1 : 0}`)
        .sort()
        .join("|")
    if (key === lastLibraryKey) return
    const initial = lastLibraryKey === null
    lastLibraryKey = key
    if (!initial && scriptureState.sessionActive) scheduleSessionBiblesRefresh()
})
