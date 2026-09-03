// AI AUTO SCRIPTURE - SESSION LIFECYCLE
// start/stop, the legacy settings migration, the mid-session watchers (LLM & library changes,
// engine errors) and the status filtering that keeps stale async updates out of the store

import { get } from "svelte/store"
import type { AiScriptureDetectionConfig } from "../../../types/ai/AiScripture"
import { Main } from "../../../types/IPC/Main"
import { sendMain } from "../../IPC/main"
import { ai, aiInterim, aiScriptureHasProjected, aiScriptureStatus, aiScriptureSuggestions, aiStatus, aiTranscript, scriptures } from "../../stores"
import { resolveSttEngine, SpeechToText } from "../stt/stt"
import { cancelPendingAutoProjection, handleDetection, pruneSuggestions } from "./detections"
import { startQuoteMatching, stopQuoteMatching } from "./quoteMatch/quoteMatchSession"
import { getSettings, scriptureState } from "./scriptureState"
import { bookTableIds, buildBookTable, buildTranslationTable, cancelSessionBiblesRefresh, cueTranslationIds, scheduleSessionBiblesRefresh, sessionBibleIds } from "./sessionBibles"
import { refreshSessionLlm, resolveSessionLlm } from "./sessionLlm"

let startInFlight: Promise<{ ok: boolean; error?: string }> | null = null
let suggestionPruneTimer: NodeJS.Timeout | null = null

// START / STOP

export function startAiScriptureListening(): Promise<{ ok: boolean; error?: string }> {
    // a start is already in progress - don't run two interleaved start sequences
    if (startInFlight) return startInFlight

    startInFlight = startSession()
        .catch((err) => {
            console.error("Failed to start AI scripture listening:", err)
            return startError("start_failed")
        })
        .finally(() => (startInFlight = null))
    return startInFlight
}

function startError(code: string): { ok: boolean; error: string } {
    // main might send an async "stopped" status right after - don't let it overwrite the error
    suppressStoppedUntil = Date.now() + 3000
    aiScriptureStatus.set({ state: "error", message: code })
    return { ok: false, error: code }
}

async function startSession(): Promise<{ ok: boolean; error?: string }> {
    stopSession()
    aiScriptureStatus.set({ state: "starting" }) // set synchronously so the panel toggle is disabled right away

    const settings = getSettings()

    scriptureState.searchBibleIds = sessionBibleIds()
    if (!bookTableIds().length) return startError("no_scripture")

    const books = await buildBookTable(bookTableIds())
    if (!books.length) return startError("no_scripture")

    // engine/model/mic settings live in the generic STT layer - seed it once from the legacy scripture fields
    seedSttSettingsFromLegacy()

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

    const detectionConfig: AiScriptureDetectionConfig = {
        books,
        llm,
        voiceCommands: !!settings.voiceCommands,
        translations: buildTranslationTable(cueTranslationIds()),
        language,
        interpretationMode,
        listenLanguage
    }

    aiTranscript.set([])
    aiInterim.set("")
    aiScriptureSuggestions.set([])

    // detection must be subscribed in the electron process before the first transcript segment arrives
    sendMain(Main.AI_SCRIPTURE_START, detectionConfig)

    // the generic layer resolves the mic & starts the engine (whisper might need a moment on first start)
    const result = await SpeechToText.enable()
    if (!result.ok) {
        sendMain(Main.AI_SCRIPTURE_STOP)
        return startError(result.error || "start_failed")
    }

    scriptureState.sessionActive = true
    aiScriptureStatus.set({ state: "listening", keyless: !llm })

    // local quote matching: recited verses are found by matching the transcript against every
    // local bible on this machine - free, keyless and private, so it always runs (an optional
    // AI provider only ADDS paraphrase detection on top). The priority order means the main &
    // favourite translations always get index slots, even when a large library would otherwise
    // crowd them past the session's memory budget
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

// settings from before the generic STT layer existed lived under ai.scripture - copy them over
// once so an updated install keeps its engine/model/mic choices without re-configuring
function seedSttSettingsFromLegacy() {
    const settings = getSettings()
    const stt = get(ai).stt || {}
    if (stt.engine || stt.engineOptions) return // already configured in the new location
    if (!settings.engine && !settings.whisperModel && !settings.micDeviceId) return // nothing legacy to migrate

    ai.update((a) => {
        if (!a.stt) a.stt = {}
        if (!a.stt.micDeviceId && settings.micDeviceId) a.stt.micDeviceId = settings.micDeviceId
        if (settings.engine) a.stt.engine = settings.engine

        const whisperOptions: { [key: string]: any } = {}
        if (settings.whisperModel) whisperOptions.model = settings.whisperModel
        if (settings.whisperCustomPath) whisperOptions.customPath = settings.whisperCustomPath
        if (settings.whisperCustomModelPath) whisperOptions.customModelPath = settings.whisperCustomModelPath
        if (settings.spokenLanguage) whisperOptions.language = settings.spokenLanguage
        if (settings.interpretationMode !== undefined) whisperOptions.interpretationMode = settings.interpretationMode
        if (settings.listenLanguage) whisperOptions.listenLanguage = settings.listenLanguage
        if (settings.spokenLanguages) whisperOptions.spokenLanguages = settings.spokenLanguages
        if (Object.keys(whisperOptions).length) a.stt.engineOptions = { whisper: whisperOptions }

        return a
    })
}

export function stopAiScriptureListening(): void {
    if (startInFlight) {
        // a start is in progress - let it finish, then stop cleanly
        startInFlight.then(() => stopSession())
        return
    }

    stopSession()
}

function stopSession(): void {
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
    aiScriptureSuggestions.set([])

    sendMain(Main.AI_SCRIPTURE_STOP)
    SpeechToText.disable()

    aiInterim.set("")
    aiScriptureStatus.set({ state: "stopped" })
}

// MID-SESSION WATCHERS

// a provider/model change in settings re-arms the running session's tier 2 on the spot
// (key saves don't touch this store - LlmOptions calls refreshSessionLlm directly)
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

// a runtime engine failure in the electron process ends the whole session
aiStatus.subscribe((status) => {
    if (status.state !== "error" || !scriptureState.sessionActive) return

    stopSession()
    suppressStoppedUntil = Date.now() + 3000
    aiScriptureStatus.set({ state: "error", message: status.message || "start_failed" })
})

// STATUS FILTERING
// main writes status events directly to the store (responsesMain) - reject updates that should not apply:
// an async "stopped" overwriting a just set local error, & any active status while the feature is disabled

let suppressStoppedUntil = 0
let lastAcceptedStatus = get(aiScriptureStatus)
let restoringStatus = false
aiScriptureStatus.subscribe((status) => {
    if (restoringStatus) return

    const ignoreDisabled = status.state !== "stopped" && !get(ai).enabled
    const ignoreStopped = status.state === "stopped" && Date.now() < suppressStoppedUntil
    if (!ignoreDisabled && !ignoreStopped) {
        lastAcceptedStatus = status
        return
    }

    restoringStatus = true
    aiScriptureStatus.set(lastAcceptedStatus)
    restoringStatus = false
})
