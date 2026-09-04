// AI AUTO SCRIPTURE - SESSION LIFECYCLE
// coordinates detection, quote matching, and watches for LLM & library changes

import { get } from "svelte/store"
import type { AiScriptureBook, AiScriptureTranslation } from "../../../types/ai/AiScripture"
import { ai, aiInterim, aiScriptureHasProjected, aiScriptureStatus, aiStatus, aiSuggestions, scriptures } from "../../stores"
import type { AIProviderId } from "../models"
import { resolveSttEngine } from "../stt/stt"
import type { AiScriptureAnchor } from "./detection/coordinator"
import { DetectionCoordinator } from "./detection/coordinator"
import { cancelPendingAutoProjection, handleDetection, pruneSuggestions } from "./detections"
import { startQuoteMatching, stopQuoteMatching } from "./quoteMatch/quoteMatcherEngine"
import { scriptureState } from "./scriptureState"
import { bookTableIds, buildBookTable, buildTranslationTable, cancelSessionBiblesRefresh, cueTranslationIds, scheduleSessionBiblesRefresh, sessionBibleIds } from "./sessionBibles"
import { refreshSessionLlm, resolveSessionLlm } from "./sessionLlm"

let suggestionPruneTimer: NodeJS.Timeout | null = null

// Coordinator instance running in the frontend session
let scriptureCoordinator: DetectionCoordinator | null = null
let scriptureConfig: { language: string; translations: AiScriptureTranslation[]; books: AiScriptureBook[]; interpretationMode: boolean; listenLanguage: string } | null = null

// START / STOP

export async function startScriptureSession(): Promise<{ ok: boolean; error?: string }> {
    stopScriptureSession()

    scriptureState.searchBibleIds = sessionBibleIds()
    if (!bookTableIds().length) return { ok: false, error: "no_scripture" }

    const books = await buildBookTable(bookTableIds())
    if (!books.length) return { ok: false, error: "no_scripture" }

    const sttSettings = get(ai).stt || {}
    const engine = resolveSttEngine()
    const engineOptions = sttSettings.engineOptions?.[engine] || {}

    // the streaming engine transcribes English only, so its transcript language is fixed regardless of the whisper setting
    const language = engine === "nemotron" ? "en" : engineOptions.language || "en"
    const interpretationMode = engine === "whisper" && engineOptions.interpretationMode === true
    const listenLanguage = engineOptions.listenLanguage || language

    // "none" is the explicit STT-only choice - and even a chosen provider only travels when its
    // key is saved (raw keys never leave the electron process)
    const llm = await resolveSessionLlm()

    const translations = buildTranslationTable(cueTranslationIds())
    scriptureConfig = {
        books,
        translations,
        language,
        interpretationMode,
        listenLanguage
    }

    const coordinator = new DetectionCoordinator({
        books,
        llm,
        onDetection: (ref) => {
            handleDetection(ref)
        },
        onStatus: (state, extra) => {
            const message = extra?.message ? extra.message.replace(/\s+/g, " ").trim().slice(0, 200) : undefined
            aiScriptureStatus.set({ state, ...extra, ...(message ? { message } : {}) })
        }
    })
    scriptureCoordinator = coordinator

    scriptureState.sessionActive = true
    aiScriptureStatus.set({ state: "listening", keyless: !llm })

    // local quote matching: recited verses are found by matching the transcript against every
    // local bible on this machine - free, keyless and private, so it always runs (an optional
    // AI provider only ADDS paraphrase detection on top).
    startQuoteMatching({
        bibleIds: scriptureState.searchBibleIds,
        interpretationMode,
        listenLanguage,
        onDetection: handleDetection
    })

    // prune suggestions that are too old to still be relevant
    suggestionPruneTimer = setInterval(pruneSuggestions, 15000)

    return { ok: true }
}

export function stopScriptureSession(): void {
    scriptureState.sessionActive = false
    aiScriptureHasProjected.set(false)
    stopQuoteMatching()
    cancelSessionBiblesRefresh()
    scriptureState.lastQuoteMatchAnchor = null

    cancelPendingAutoProjection()

    if (suggestionPruneTimer) {
        clearInterval(suggestionPruneTimer)
        suggestionPruneTimer = null
    }
    aiSuggestions.set([])

    scriptureCoordinator?.stop()
    scriptureCoordinator = null
    scriptureConfig = null

    aiInterim.set("")
    aiScriptureStatus.set({ state: "stopped" })
}

export function handleScriptureTranscript(segment: { text: string; startMs: number; endMs: number; language?: string; music?: boolean }): void {
    if (!scriptureState.sessionActive || !scriptureCoordinator) return

    // music lyrics are hallucination territory - never let them trigger detections or commands
    if (segment.music) return
    // textless utterance-boundary markers only exist for the display's line grouping
    if (!segment.text) return

    const config = scriptureConfig
    const detectable = !config?.interpretationMode || !segment.language || !config?.listenLanguage || segment.language === config.listenLanguage
    if (!detectable) return

    scriptureCoordinator.onTranscriptSegment(segment)
}

export function updateScriptureCoordinatorBooks(books: AiScriptureBook[], translations: AiScriptureTranslation[]): void {
    if (scriptureConfig) {
        scriptureConfig.books = books
        scriptureConfig.translations = translations
    }
    scriptureCoordinator?.updateBooks(books)
}

export function updateScriptureCoordinatorLlm(llm: { provider: AIProviderId; model: string } | null): void {
    scriptureCoordinator?.updateLlm(llm)
}

export function updateScriptureCoordinatorContext(anchor: AiScriptureAnchor): void {
    scriptureCoordinator?.updateContext(anchor)
}

// WATCHERS

// Synchronize scripture session lifecycle with STT status and AI enabled setting
aiStatus.subscribe((status) => {
    const isAiEnabled = get(ai).enabled
    if (isAiEnabled && status.state === "listening") {
        if (!scriptureState.sessionActive) {
            void startScriptureSession()
        }
    } else if (scriptureState.sessionActive) {
        stopScriptureSession()
    }
})

// a provider/model change in settings re-arms the running session's tier 2 on the spot
let lastLlmConfigKey = ""
ai.subscribe((value) => {
    const key = `${value?.llm?.provider || ""}|${value?.llm?.model || ""}`
    if (key !== lastLlmConfigKey) {
        lastLlmConfigKey = key
        if (scriptureState.sessionActive) void refreshSessionLlm()
    }
})

// installing, deleting, renaming or (un)favouriting a bible mid-session updates the searched
// set, its priority order & the cue table
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
