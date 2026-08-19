// AI AUTO SCRIPTURE
// the scripture feature on top of the generic speech-to-text layer (ai/stt):
// starts detection in the electron process, receives detected references back & projects/suggests them

import { get } from "svelte/store"
import type { AiScriptureBook, AiScriptureCommandEvent, AiScriptureDetectionConfig, AiScriptureTranslation, DetectedReference } from "../../../types/ai/AiScripture"
import { Main } from "../../../types/IPC/Main"
import type { OutSlide } from "../../../types/Show"
import type { BibleInstance } from "../../components/drawer/bible/scripture"
import { getShortBibleName, loadJsonBible, outputIsScripture, playScripture } from "../../components/drawer/bible/scripture"
import { clone } from "../../components/helpers/array"
import { setDrawerTabData } from "../../components/helpers/historyHelpers"
import { getFirstActiveOutput, setOutput } from "../../components/helpers/output"
import { clearSlide } from "../../components/output/clear"
import { requestMain, sendMain } from "../../IPC/main"
import { activeDrawerTab, activeScripture, ai, aiScriptureAutoPaused, aiScriptureHasProjected, aiScriptureInterim, aiScriptureStatus, aiScriptureSuggestions, aiScriptureTranscript, aiStatus, drawerTabsData, openScripture, outLocked, outputs, scriptures, scripturesCache } from "../../stores"
import { AI_PROVIDER_MODELS } from "../models"
import { resolveSttEngine, SpeechToText } from "../stt/stt"
import { noteExplicitDetection, setQuoteMatchAnchor, startQuoteMatching, stopQuoteMatching, updateQuoteMatchBibles } from "./quoteMatchSession"

const SUGGESTION_MAX_AGE = 3 * 60 * 1000
const SUGGESTION_LIMIT = 5
const QUOTE_MATCH_SCORE = 0.55
const QUOTE_DEMOTE_SCORE = 0.35

function getSettings() {
    return get(ai).scripture || {}
}

/** The tier-2 LLM config as it stands right now: a chosen provider whose key is saved, or null. */
async function resolveSessionLlm(): Promise<AiScriptureDetectionConfig["llm"]> {
    const settings = getSettings()
    const provider = get(ai).llm?.provider || settings.provider || "none"
    if (provider === "none") return null

    const status = await requestMain(Main.AI_GET_STATUS, { engineId: provider })
    if (!status?.[provider]?.ready) return null

    // only a model the provider CURRENTLY lists may travel - a stale stored id (a retired model
    // kept in settings) 404s live while the popup's Test, which validates against the list,
    // passes. Anything unlisted falls through; an empty model means the provider's own default
    const listed = (id: string | undefined) => (id && AI_PROVIDER_MODELS[provider].models.some((entry) => entry.id === id) ? id : "")
    const model = listed(get(ai).llm?.model) || listed(settings.customModel) || listed(settings.models?.[provider]) || listed(settings.model) || ""
    const stored = get(ai).llm?.model || settings.customModel || settings.models?.[provider] || settings.model
    if (stored && !model) console.info(`[AiScripture] Stored ${provider} model "${stored}" is no longer offered - using the provider default`)
    return { provider, model }
}

/**
 * The AI provider was configured mid-session (key saved, provider/model picked) - arm or update
 * tier 2 in the running session instead of making the user restart listening. No-op otherwise.
 */
export async function refreshSessionLlm(): Promise<void> {
    if (!sessionActive) return
    const llm = await resolveSessionLlm()
    if (!sessionActive) return

    sendMain(Main.AI_SCRIPTURE_LLM, { llm })
    aiScriptureStatus.update((status) => (status.state === "listening" || status.state === "llm_paused" ? { ...status, state: "listening", keyless: !llm } : status))
}

// engine/session error codes -> locale keys (unknown codes pass through as-is)
const ERROR_LANG_KEYS: { [code: string]: string } = {
    no_scripture: "ai_scripture.error_no_scripture",
    start_failed: "ai_scripture.error_start_failed",
    microphone_access: "ai_scripture.error_microphone",
    whisper_not_installed: "ai.whisper_not_installed",
    whisper_model_missing: "ai_scripture.error_model_missing",
    nemotron_model_missing: "ai.nemotron_not_downloaded",
    nemotron_unsupported: "ai.nemotron_unsupported"
}

export function aiScriptureErrorText(code: string): string {
    return ERROR_LANG_KEYS[code] || code
}

let sessionActive = false
let searchBibleIds: string[] = []
let selfProjecting = false
let startInFlight: Promise<{ ok: boolean; error?: string }> | null = null
let suggestionPruneTimer: NodeJS.Timeout | null = null
let sessionBiblesRefreshTimer: NodeJS.Timeout | null = null
let sessionBiblesRefreshToken = 0
let lastQuoteMatchAnchor: { bookNumber: number; chapter: number; verseStart: number; verseEnd: number } | null = null

let lastAutoProjectionAt = 0
let lastAutoProjectedRef: DetectedReference | null = null
let lastAutoProjectedBibleId = "" // which translation's wording is on the output right now
let pendingAutoRef: DetectedReference | null = null
let autoTimer: NodeJS.Timeout | null = null

let previousState: { activeScripture: { id?: string; reference?: { book: number | string; chapters: (number | string)[]; verses: (number | string)[][] } }; outSlide: OutSlide | null } | null = null

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

// SESSION BIBLES
// every installed local translation is searched - no list to configure. The favourited
// translations are the priority pool: they take the leading index slots and head the spoken
// cycle order. One of them (or any bible) can be picked as the MAIN translation - the
// projection/grounding target. With nothing picked, the first favourite leads; only with no
// favourites at all does the drawer's open translation fill that role, so an accidental drawer
// tab can never outrank a deliberate choice.

/** The favourited translations, common ones first (the existing cycle ranking), then by name. */
function favoriteTranslationIds(): string[] {
    return Object.entries(get(scriptures))
        .filter(([, bible]) => !!bible?.favorite)
        .sort(([idA, a], [idB, b]) => cycleRank(idA) - cycleRank(idB) || (a.customName || a.name || "").localeCompare(b.customName || b.name || ""))
        .map(([id]) => id)
}

/** The translation detections project in (unless display is "matched") and matching grounds to. */
function preferredTranslationId(): string {
    const main = getSettings().mainTranslation
    if (main && get(scriptures)[main]) return main
    return favoriteTranslationIds()[0] || get(drawerTabsData).scripture?.activeSubTab || ""
}

/** All installed local translations in priority order: main & favourites first, then the rest by name. */
function sessionBibleIds(): string[] {
    const lead = expandBibleIds([preferredTranslationId(), ...favoriteTranslationIds()].filter(Boolean))
    const rest = Object.entries(get(scriptures))
        .filter(([id, bible]) => !!bible && !bible.api && !bible.collection && !lead.includes(id))
        .sort(([, a], [, b]) => (a.customName || a.name || "").localeCompare(b.customName || b.name || ""))
        .map(([id]) => id)
    return [...lead, ...rest]
}

/** Every installed bible (api & collections included) for the spoken-cue table, priority first. */
function cueTranslationIds(): string[] {
    return [...searchBibleIds, ...Object.keys(get(scriptures)).filter((id) => !searchBibleIds.includes(id))]
}

/**
 * Ids whose book names feed tier-1 reference detection: the searched locals plus every API
 * bible - API bibles cannot be quote-matched (no local verse text to index) but their book
 * names must still be recognized when spoken, and they project on demand.
 */
function bookTableIds(): string[] {
    const api = Object.entries(get(scriptures))
        .filter(([, bible]) => !!bible?.api)
        .map(([id]) => id)
    return [...new Set([...searchBibleIds, ...api])]
}

async function startSession(): Promise<{ ok: boolean; error?: string }> {
    stopSession()
    aiScriptureStatus.set({ state: "starting" }) // set synchronously so the panel toggle is disabled right away

    const settings = getSettings()

    searchBibleIds = sessionBibleIds()
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
        refCooldownSeconds: settings.refCooldownSeconds,
        voiceCommands: !!settings.voiceCommands,
        translations: buildTranslationTable(cueTranslationIds()),
        language,
        interpretationMode,
        listenLanguage
    }

    aiScriptureTranscript.set([])
    aiScriptureInterim.set("")
    aiScriptureSuggestions.set([])
    aiScriptureAutoPaused.set(false)

    // detection must be subscribed in the electron process before the first transcript segment arrives
    sendMain(Main.AI_SCRIPTURE_START, detectionConfig)

    // the generic layer resolves the mic & starts the engine (whisper might need a moment on first start)
    const result = await SpeechToText.enable()
    if (!result.ok) {
        sendMain(Main.AI_SCRIPTURE_STOP)
        return startError(result.error || "start_failed")
    }

    sessionActive = true
    aiScriptureStatus.set({ state: "listening", keyless: !llm })

    // local quote matching: recited verses are found by matching the transcript against every
    // local bible on this machine - free, keyless and private, so it always runs (an optional
    // AI provider only ADDS paraphrase detection on top). The priority order means the main &
    // favourite translations always get index slots, even when a large library would otherwise
    // crowd them past the session's memory budget
    startQuoteMatching({
        bibleIds: searchBibleIds,
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
    sessionActive = false
    aiScriptureHasProjected.set(false)
    stopQuoteMatching()
    if (sessionBiblesRefreshTimer) {
        clearTimeout(sessionBiblesRefreshTimer)
        sessionBiblesRefreshTimer = null
    }
    lastQuoteMatchAnchor = null

    if (autoTimer) {
        clearTimeout(autoTimer)
        autoTimer = null
    }
    pendingAutoRef = null

    if (suggestionPruneTimer) {
        clearInterval(suggestionPruneTimer)
        suggestionPruneTimer = null
    }
    aiScriptureSuggestions.set([])

    sendMain(Main.AI_SCRIPTURE_STOP)
    SpeechToText.disable()

    aiScriptureInterim.set("")
    aiScriptureAutoPaused.set(false)
    aiScriptureStatus.set({ state: "stopped" })
}

// a provider/model change in settings re-arms the running session's tier 2 on the spot
// (key saves don't touch this store - LlmOptions calls refreshSessionLlm directly)
let lastLlmConfigKey = ""
let lastMainTranslationKey: string | null = null
ai.subscribe((value) => {
    const key = `${value?.llm?.provider || ""}|${value?.llm?.model || ""}`
    if (key !== lastLlmConfigKey) {
        lastLlmConfigKey = key
        if (sessionActive) void refreshSessionLlm()
    }

    // changing the main translation re-prioritizes the running session's matching & projection
    const mainKey = value?.scripture?.mainTranslation || ""
    if (mainKey !== lastMainTranslationKey) {
        const initial = lastMainTranslationKey === null
        lastMainTranslationKey = mainKey
        if (!initial && sessionActive) scheduleSessionBiblesRefresh()
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
    if (!initial && sessionActive) scheduleSessionBiblesRefresh()
})

// SESSION BIBLES LIVE REFRESH

// several changes usually land in a row (starring, imports) - one refresh after they settle
const SESSION_BIBLES_REFRESH_DELAY = 1200

function scheduleSessionBiblesRefresh(): void {
    if (sessionBiblesRefreshTimer) clearTimeout(sessionBiblesRefreshTimer)
    sessionBiblesRefreshTimer = setTimeout(() => {
        sessionBiblesRefreshTimer = null
        void refreshSessionBibles()
    }, SESSION_BIBLES_REFRESH_DELAY)
}

async function refreshSessionBibles(): Promise<void> {
    if (!sessionActive) return
    const token = ++sessionBiblesRefreshToken

    searchBibleIds = sessionBibleIds()

    // the electron tier-1 tables (spoken book names, translation cues) follow the same set - the
    // book table build also loads any newly installed bibles into the cache, which the quote
    // match index build reads verse text from
    const books = await buildBookTable(bookTableIds())
    // a slow load can outlive the session or a newer change - only the latest refresh may apply
    if (!sessionActive || token !== sessionBiblesRefreshToken) return
    sendMain(Main.AI_SCRIPTURE_TABLES, { books, translations: buildTranslationTable(cueTranslationIds()) })

    updateQuoteMatchBibles(searchBibleIds)
    // only the full-start fallback (matcher not ready yet) loses the anchor - re-seed it
    if (lastQuoteMatchAnchor) setQuoteMatchAnchor(lastQuoteMatchAnchor)
}

// a runtime engine failure in the electron process ends the whole session
aiStatus.subscribe((status) => {
    if (status.state !== "error" || !sessionActive) return

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

    const ignoreDisabled = status.state !== "stopped" && !getSettings().enabled
    const ignoreStopped = status.state === "stopped" && Date.now() < suppressStoppedUntil
    if (!ignoreDisabled && !ignoreStopped) {
        lastAcceptedStatus = status
        return
    }

    restoringStatus = true
    aiScriptureStatus.set(lastAcceptedStatus)
    restoringStatus = false
})

// BOOK TABLE

function expandBibleIds(ids: string[]): string[] {
    const expanded: string[] = []
    ids.forEach((id) => {
        const versions = get(scriptures)[id]?.collection?.versions
        const list = versions?.length ? versions : [id]
        list.forEach((a) => {
            if (a && !expanded.includes(a)) expanded.push(a)
        })
    })
    return expanded
}

async function buildBookTable(bibleIds: string[]): Promise<AiScriptureBook[]> {
    const namesByNumber: Map<number, string[]> = new Map()
    const canonNumbers: Set<number> = new Set() // book numbers matching the 66 book Protestant canon
    const addName = (number: number, name: string | undefined) => {
        const trimmed = (name || "").trim()
        if (!number || !trimmed) return
        const list = namesByNumber.get(number) || []
        if (!list.some((a) => a.toLowerCase() === trimmed.toLowerCase())) list.push(trimmed)
        namesByNumber.set(number, list)
    }

    for (const id of bibleIds) {
        try {
            const bible = await loadJsonBible(id)
            const books = bible?.data.books || []
            const isCanon = books.length === 66
            books.forEach((book) => {
                addName(book.number, book.name)
                addName(book.number, book.abbreviation)
                addName(book.number, book.id)
                if (isCanon) canonNumbers.add(book.number)
            })
        } catch (err) {
            console.error("Error loading Bible for AI scripture book table:", id, err)
        }

        const cachedBooks = get(scripturesCache)[id]?.books || []
        const cachedIsCanon = cachedBooks.length === 66
        cachedBooks.forEach((book) => {
            addName(book.number, book.name)
            addName(book.number, (book as any).customName) // many XML book names are not correct
            addName(book.number, book.abbreviation)
            if (cachedIsCanon) canonNumbers.add(book.number)
        })
    }

    return Array.from(namesByNumber.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([number, names]) => ({ number, names, canonNumber: canonNumbers.has(number) ? number : undefined }))
}

// installed translation names for spoken translation switching ("give me NIV")
function buildTranslationTable(bibleIds: string[]): AiScriptureTranslation[] {
    const translationTable: AiScriptureTranslation[] = []
    bibleIds.forEach((id) => {
        const bible = get(scriptures)[id]
        if (!bible) return

        const names: string[] = []
        const candidates = [bible.name, bible.customName, getShortBibleName(bible.name)]
        candidates.forEach((name) => {
            const trimmed = (name || "").trim()
            if (trimmed && !names.some((a) => a.toLowerCase() === trimmed.toLowerCase())) names.push(trimmed)
        })

        if (names.length) translationTable.push({ id, names })
    })
    return translationTable
}

// DETECTION HANDLING

export async function handleDetection(ref: DetectedReference): Promise<void> {
    const settings = getSettings()
    if (!sessionActive || !settings.enabled) return

    // a spoken reference primes the quote matcher: the recitation that follows resolves faster
    if (ref.type === "explicit") noteExplicitDetection(ref)

    // LLM quotes are verified against the actual verse text; local quote matches arrive with
    // matchedBibleId already set because they WERE matched against it - never re-verify those
    if (ref.type === "quoted" && ref.quote && !ref.matchedBibleId) await verifyQuote(ref)

    addSuggestion(ref)

    // auto projection
    if (settings.mode !== "auto") return
    if (get(aiScriptureAutoPaused) || get(outLocked)) return
    if (confidencePercent(ref.confidence) < (typeof settings.autoMinConfidence === "number" ? settings.autoMinConfidence : 80)) return
    // quoted verses are separately gated - except follow-along continuations, which only ever
    // advance the passage already live on the output within its own chapter, corrections
    // replacing the very verse this feature just projected, and re-projections of the live
    // passage in the translation the speaker turns out to be reading from
    if (ref.type === "quoted" && !settings.autoProjectQuoted && !ref.continuation && !correctsLiveProjection(ref) && !refinesLiveTranslation(ref)) return

    queueAutoProjection(ref)
}

async function verifyQuote(ref: DetectedReference) {
    const quote = ref.quote || ""
    let bestScore = 0
    let bestId = ""

    for (const id of searchBibleIds) {
        try {
            const bible = await loadJsonBible(id)
            if (!bible) continue

            const bookNumber = resolveBookNumber(bible, ref)
            if (!bookNumber) continue

            const Book = await bible.getBook(bookNumber)
            const Chapter = await Book.getChapter(ref.chapter)

            let text = ""
            for (let v = ref.verseStart; v <= Math.max(ref.verseStart, ref.verseEnd); v++) {
                text += " " + Chapter.getVerse(v).getText()
            }

            const score = tokenOverlapSimilarity(text, quote)
            if (score > bestScore) {
                bestScore = score
                bestId = id
            }
        } catch (err) {
            // skip bibles that fail to load or are missing the reference
        }
    }

    if (bestScore >= QUOTE_MATCH_SCORE) ref.matchedBibleId = bestId
    else if (bestScore < QUOTE_DEMOTE_SCORE && ref.confidence === "high") ref.confidence = "medium" // suggestion only
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

    let matched = 0
    quoteTokens.forEach((token) => {
        if (verseTokens.has(token)) matched++
    })
    return matched / quoteTokens.length
}

// detection confidence is categorical - map the bands onto the percent scale the
// auto-show threshold uses (the settings slider shows which band a percent lands in)
export function confidencePercent(confidence: DetectedReference["confidence"]): number {
    if (confidence === "high") return 90
    if (confidence === "medium") return 65
    return 35
}

// same book/chapter with an overlapping verse range
type RefRange = Pick<DetectedReference, "bookNumber" | "chapter" | "verseStart" | "verseEnd">

function isSameReference(a: RefRange, b: RefRange) {
    return a.bookNumber === b.bookNumber && a.chapter === b.chapter && a.verseStart <= b.verseEnd && b.verseStart <= a.verseEnd
}

function addSuggestion(ref: DetectedReference) {
    aiScriptureSuggestions.update((list) => {
        const now = Date.now()
        let active = list.filter((a) => now - a.timestamp < SUGGESTION_MAX_AGE)

        // a correction supersedes an earlier similar-passage suggestion - replace, don't stack
        if (ref.corrects) active = active.filter((a) => !isSameReference(a, ref.corrects!))

        // skip near-duplicates of an existing suggestion
        if (active.some((a) => isSameReference(a, ref))) return active

        return [ref, ...active].slice(0, SUGGESTION_LIMIT)
    })
}

function pruneSuggestions() {
    aiScriptureSuggestions.update((list) => {
        const now = Date.now()
        const active = list.filter((a) => now - a.timestamp < SUGGESTION_MAX_AGE)
        return active.length === list.length ? list : active
    })
}

export function dismissSuggestion(id: string): void {
    aiScriptureSuggestions.update((list) => list.filter((a) => a.id !== id))
}

// AUTO PROJECTION

/** The wrong verse of a similar pair is on the output right now and this detection fixes it. */
function correctsLiveProjection(ref: DetectedReference): boolean {
    return !!(ref.corrects && lastAutoProjectedRef && isSameReference(lastAutoProjectedRef, ref.corrects))
}

/**
 * The speaker announced the reference (projected in the drawer translation) and is now READING it
 * in another version: with display translation "matched", the same passage re-projects in the
 * wording actually being read instead of being suppressed as a repeat.
 */
function refinesLiveTranslation(ref: DetectedReference): boolean {
    if (getSettings().displayTranslation !== "matched") return false
    if (!ref.matchedBibleId || ref.matchedBibleId === lastAutoProjectedBibleId) return false
    return !!(lastAutoProjectedRef && isSameReference(lastAutoProjectedRef, ref))
}

function queueAutoProjection(ref: DetectedReference) {
    const settings = getSettings()

    // a correction replacing what is live doesn't wait out the display cooldown - the point is
    // to take the wrong verse DOWN as fast as the right one goes up. The same goes for switching
    // the live passage to the translation the speaker turns out to be reading from
    if (correctsLiveProjection(ref) || refinesLiveTranslation(ref)) {
        if (autoTimer) clearTimeout(autoTimer)
        autoTimer = null
        pendingAutoRef = null
        projectDetection(ref)
        return
    }

    // don't re-project a reference that was just auto projected
    const refCooldownMs = (settings.refCooldownSeconds ?? 90) * 1000
    if (lastAutoProjectedRef && Date.now() - lastAutoProjectionAt < refCooldownMs && isSameReference(lastAutoProjectedRef, ref)) return

    // HIGH means the speaker explicitly asked or the match is decisive - it acts NOW. Only
    // medium waits out the minimum display time of what is currently showing
    if (ref.confidence === "high") {
        if (autoTimer) clearTimeout(autoTimer)
        autoTimer = null
        pendingAutoRef = null
        projectDetection(ref)
        return
    }

    // respect the minimum display time of the current projection
    const cooldownMs = (settings.autoCooldownSeconds ?? 5) * 1000
    const elapsed = Date.now() - lastAutoProjectionAt
    if (!lastAutoProjectionAt || elapsed >= cooldownMs) {
        projectDetection(ref)
        return
    }

    // queue until the cooldown ends - the latest detection wins
    pendingAutoRef = ref
    if (autoTimer) clearTimeout(autoTimer)
    autoTimer = setTimeout(() => {
        autoTimer = null
        const pending = pendingAutoRef
        pendingAutoRef = null

        if (!pending || !sessionActive) return
        if (getSettings().mode !== "auto") return
        if (get(aiScriptureAutoPaused) || get(outLocked)) return

        projectDetection(pending)
    }, cooldownMs - elapsed)
}

// PROJECTION

export async function projectDetection(detection: DetectedReference, manual?: boolean): Promise<boolean> {
    const settings = getSettings()

    // arm the cooldown before any awaits so parallel detections can't project concurrently
    if (!manual) {
        lastAutoProjectionAt = Date.now()
        lastAutoProjectedRef = detection
    }

    const targetId = settings.displayTranslation === "matched" && detection.matchedBibleId ? detection.matchedBibleId : preferredTranslationId()
    if (!targetId) return false
    lastAutoProjectedBibleId = targetId

    // collections load one version at a time - validate against the first one
    const parseId = get(scriptures)[targetId]?.collection?.versions?.[0] || targetId

    let book: number | string = detection.bookNumber
    let chapter = detection.chapter
    let verseStart = detection.verseStart
    let verseEnd = Math.max(detection.verseStart, detection.verseEnd)

    let bible: BibleInstance | null = null
    try {
        bible = await loadJsonBible(parseId)
    } catch (err) {
        console.error("Error loading Bible for AI scripture projection:", parseId, err)
    }

    if (bible) {
        const resolvedBook = resolveBookNumber(bible, detection)
        if (!resolvedBook) return false
        book = resolvedBook

        // clamp chapter/verses to what actually exists in the target translation
        try {
            const Book = await bible.getBook(book)
            const chapterCount = Book.data.chapters?.length || 0
            if (chapterCount) chapter = Math.min(Math.max(1, chapter), chapterCount)
            // a clamp here means the target bible disagrees about the book's structure - the
            // projected label would no longer match the detected reference, so say it loudly
            if (chapter !== detection.chapter) console.warn(`[AiScripture] ${detection.book} ${detection.chapter} clamped to chapter ${chapter} in "${parseId}" (${chapterCount} chapters found) - the projected label will not match the detection`)

            const Chapter = await Book.getChapter(chapter)
            const chapterVerses = Chapter.data.verses || []
            const maxVerse = chapterVerses.length ? (chapterVerses[chapterVerses.length - 1]?.number ?? chapterVerses.length) : 0
            if (maxVerse) {
                verseStart = Math.min(Math.max(1, verseStart), maxVerse)
                verseEnd = Math.min(Math.max(verseStart, verseEnd), maxVerse)
            }
        } catch (err) {
            // API bibles fetch chapters on demand - a network failure should not block manual projections
            if (!manual) return false
        }
    } else if (!manual) {
        return false
    }

    const maxVerses = settings.maxVerses ?? 6
    if (maxVerses > 0) verseEnd = Math.min(verseEnd, verseStart + maxVerses - 1)

    // navigate the drawer's scripture view to the projected translation (star 1 or the match)
    if (targetId !== (get(drawerTabsData).scripture?.activeSubTab || "")) setDrawerTabData("scripture", targetId)

    const verses: number[] = []
    for (let v = verseStart; v <= verseEnd; v++) verses.push(v)

    // one line per projection makes "why did THIS fire" reports diagnosable after the fact
    console.info(`[AiScripture] Projecting ${detection.book} ${chapter}:${verseStart}${verseEnd > verseStart ? "-" + verseEnd : ""} in "${targetId}" [${detection.type}/${detection.confidence}${manual ? "/manual" : ""}${detection.matchedBibleId ? " matched:" + detection.matchedBibleId : ""}]`)
    await projectResolved(targetId, book, chapter, verses)

    // follow along in the drawer so the operator tracks the passage - without ever yanking
    // them off whatever drawer tab they are actually working in
    if (settings.followInDrawer !== false) void showInDrawer(detection, false)

    return true
}

// shared by detection projections & voice command projections - the selfProjecting wrap
// keeps the manual-override output watcher from treating our own projection as an operator action
async function projectResolved(targetId: string, book: number | string, chapter: number, verses: number[]): Promise<void> {
    // snapshot the current state so the operator can restore it
    previousState = {
        activeScripture: clone(get(activeScripture)),
        outSlide: clone(getFirstActiveOutput()?.out?.slide || null)
    }

    selfProjecting = true
    try {
        activeScripture.set({ id: targetId, reference: { book, chapters: [chapter], verses: [verses] } })
        await playScripture()
    } finally {
        selfProjecting = false
    }

    aiScriptureHasProjected.set(true)

    // the projected passage becomes the sermon anchor, so bare "verse N" mentions resolve against it
    sendAnchorContext(targetId, book, chapter, verses)
}

// SESSION CONTEXT (anchor passage)
// tells the electron process what passage is live on the output right now

async function sendAnchorContext(targetId: string, book: number | string, chapter: number, verses: number[]): Promise<void> {
    if (!verses.length) return

    try {
        const parseId = get(scriptures)[targetId]?.collection?.versions?.[0] || targetId
        const bible = await loadJsonBible(parseId)
        if (!bible) return

        const Book = await bible.getBook(book)
        const name = Book.data.name || String(book)
        // 66 book bibles use the standard Protestant canon numbering, so the local number doubles as the canon number
        const bookNumber = Number(Book.data.number ?? book)
        if (!name || !Number.isFinite(bookNumber) || bookNumber < 1) return

        const anchor = { book: name, bookNumber, chapter, verseStart: Math.min(...verses), verseEnd: Math.max(...verses) }
        sendMain(Main.AI_SCRIPTURE_CONTEXT, anchor)
        setQuoteMatchAnchor(anchor)
        lastQuoteMatchAnchor = anchor
    } catch (err) {
        // the anchor is best effort - a failed load just leaves the previous anchor in place
    }
}

function resolveBookNumber(bible: BibleInstance, ref: DetectedReference): number {
    const books = bible.data.books || []

    // 66 book bibles use the standard Protestant canon numbering, and with no book list at all
    // the canon number is the only sensible read
    if (books.length === 66) return ref.bookNumber
    if (!books.length) return ref.bookNumber

    const nameLower = (ref.book || "").toLowerCase()
    const match = books.find((a) => a.name?.toLowerCase() === nameLower || a.abbreviation?.toLowerCase() === nameLower || a.id?.toLowerCase() === nameLower)
    if (match) return match.number

    // a fuzzy search is a last resort, and NEVER on a numeric "name" - searching "40 26" once
    // resolved a Matthew match to Proverbs and projected the wrong book entirely. The search is
    // by name alone (a chapter number only muddies it), and the result counts only when it
    // plausibly IS the asked-for book
    if (!nameLower || /^\d+$/.test(nameLower)) return 0
    const searched = bible.bookSearch(ref.book)
    const foundName = (searched?.book ? books.find((a) => a.number === searched.book)?.name || "" : "").toLowerCase()
    if (foundName && (foundName.startsWith(nameLower.slice(0, 4)) || nameLower.startsWith(foundName.slice(0, 4)))) return searched!.book

    console.warn(`[AiScripture] Could not resolve book "${ref.book}" in this bible - skipping the projection instead of guessing`)
    return 0
}

// VOICE COMMANDS
// imperative spoken phrases ("go to the next verse") control the projection - only while a scripture is live

// chapter/verse values can be strings, including split ids like "12_1" - parseInt reads the leading number
function parseNumber(value: number | string | undefined): number {
    if (typeof value === "number") return value
    const parsed = parseInt(String(value ?? ""), 10)
    return Number.isFinite(parsed) ? parsed : 0
}

export async function executeScriptureCommand(cmd: AiScriptureCommandEvent): Promise<void> {
    const settings = getSettings()
    if (!sessionActive || !settings.enabled || !settings.voiceCommands) return
    if (get(outLocked) || get(aiScriptureAutoPaused)) return
    if (!outputIsScripture()) return

    const current = get(activeScripture)
    const currentId = current.id || get(drawerTabsData).scripture?.activeSubTab || ""
    const reference = current.reference
    if (!currentId || !reference) return

    const chapter = parseNumber(reference.chapters[0])
    const currentVerses = (reference.verses[0] || []).map(parseNumber).filter((a) => a >= 1)
    if (!(chapter >= 1) || !currentVerses.length) return

    // collections load one version at a time - validate against the first one
    const parseId = get(scriptures)[currentId]?.collection?.versions?.[0] || currentId

    try {
        const bible = await loadJsonBible(parseId)
        if (!bible) return

        const Book = await bible.getBook(reference.book)
        const chapterCount = Book.data.chapters?.length || 0
        const maxVerseOf = async (chapterNumber: number) => {
            const Chapter = await Book.getChapter(chapterNumber)
            const chapterVerses = Chapter.data.verses || []
            return chapterVerses.length ? (chapterVerses[chapterVerses.length - 1]?.number ?? chapterVerses.length) : 0
        }

        if (cmd.type === "translation" || cmd.type === "translation_cycle") {
            await switchTranslation(cmd, { currentId, bible, bookName: Book.data.name || "", book: reference.book, chapter, verses: currentVerses })
            return
        }

        let targetChapter = chapter
        let targetVerse = 1

        if (cmd.type === "verse_next") {
            const last = Math.max(...currentVerses)
            const maxVerse = await maxVerseOf(chapter)
            if (maxVerse && last < maxVerse) targetVerse = last + 1
            else if (chapter < chapterCount) targetChapter = chapter + 1
            else return // already at the last verse of the last chapter
        } else if (cmd.type === "verse_previous") {
            const first = Math.min(...currentVerses)
            if (first > 1) targetVerse = first - 1
            else if (chapter > 1) {
                targetChapter = chapter - 1
                targetVerse = await maxVerseOf(targetChapter)
                if (!targetVerse) return
            } else return // already at the first verse of the first chapter
        } else if (cmd.type === "chapter_next") {
            targetChapter = chapterCount ? Math.min(chapter + 1, chapterCount) : chapter + 1
        } else if (cmd.type === "chapter_previous") {
            targetChapter = Math.max(chapter - 1, 1)
        } else if (cmd.type === "verse_jump") {
            const maxVerse = await maxVerseOf(chapter)
            targetVerse = maxVerse ? Math.min(Math.max(1, cmd.verse), maxVerse) : cmd.verse
        } else {
            // chapter_jump
            targetChapter = chapterCount ? Math.min(Math.max(1, cmd.chapter), chapterCount) : cmd.chapter
            const requestedVerse = cmd.verse ?? 1
            const maxVerse = await maxVerseOf(targetChapter)
            targetVerse = maxVerse ? Math.min(Math.max(1, requestedVerse), maxVerse) : requestedVerse
        }

        await projectResolved(currentId, reference.book, targetChapter, [targetVerse])
    } catch (err) {
        console.error("Error executing AI scripture voice command:", err)
    }
}

// "another translation" visits the familiar ones first - however the search selection is ordered.
// Each entry lists the abbreviation AND full-name phrasings, since libraries store either
// ("NASB" / "New American Standard Bible"). NKJV ranks before KJV so its full name is not
// swallowed by the "KING JAMES" alias
const CYCLE_PREFERENCE: string[][] = [
    ["NASB", "NEW AMERICAN STANDARD BIBLE"],
    ["NLT", "NEW LIVING TRANSLATION"],
    ["AMP", "AMPLIFIED BIBLE"],
    ["AMPC", "AMPLIFIED BIBLE CLASSIC"],
    ["MSG", "THE MESSAGE BIBLE"],
    ["CEV", "CONTEMPORARY ENGLISH VERSION"],
    ["CEB", "COMMON ENGLISH BIBLE"],
    ["NIV", "NEW INTERNATIONAL VERSION"],
    ["NIRV", "NEW INTERNATIONAL READERS' VERSION"],
    ["ERV", "EASY-TO-READ VERSION", "EASY TO READ VERSION"],
    ["ESV", "ENGLISH STANDARD VERSION"],
    ["GNT", "GOOD NEWS TRANSLATION"],
    ["NKJV", "NEW KING JAMES VERSION"],
    ["KJV", "KING JAMES VERSION"]
]

function cycleRank(id: string): number {
    const bible = get(scriptures)[id]
    const names = [bible?.customName, bible?.name, getShortBibleName(bible?.name || "")].map((name) => (name || "").toUpperCase())
    const rank = CYCLE_PREFERENCE.findIndex((aliases) => aliases.some((alias) => names.some((name) => name === alias || name.includes(alias))))
    return rank < 0 ? CYCLE_PREFERENCE.length : rank
}

async function switchTranslation(cmd: Extract<AiScriptureCommandEvent, { type: "translation" | "translation_cycle" }>, from: { currentId: string; bible: BibleInstance; bookName: string; book: number | string; chapter: number; verses: number[] }): Promise<void> {
    let targetId = ""
    if (cmd.type === "translation") targetId = cmd.bibleId
    else {
        // cycle to the next translation: the main one, then the favourites, then common before
        // obscure. API bibles are part of the pool - they project on demand
        const main = preferredTranslationId()
        const favorites = favoriteTranslationIds()
        const priorityRank = (id: string) => {
            if (id === main) return -1
            const rank = favorites.indexOf(id)
            return rank < 0 ? favorites.length : rank
        }
        const apiIds = Object.entries(get(scriptures))
            .filter(([, bible]) => !!bible?.api)
            .map(([id]) => id)
        const ids = [...new Set([...(searchBibleIds.length ? searchBibleIds : [from.currentId]), ...apiIds])].sort((a, b) => priorityRank(a) - priorityRank(b) || cycleRank(a) - cycleRank(b))
        targetId = ids[(ids.indexOf(from.currentId) + 1) % ids.length] || ""
    }
    if (!targetId || targetId === from.currentId) return

    const targetParseId = get(scriptures)[targetId]?.collection?.versions?.[0] || targetId
    const targetBible = await loadJsonBible(targetParseId)
    if (!targetBible) return

    // map the current book to the target bible: same number when both use the 66 book canon, name match otherwise
    let targetBook: number | string = from.book
    const targetBooks = targetBible.data.books || []
    if ((from.bible.data.books || []).length !== 66 || targetBooks.length !== 66) {
        const nameLower = from.bookName.toLowerCase()
        const match = targetBooks.find((a) => a.name?.toLowerCase() === nameLower || a.abbreviation?.toLowerCase() === nameLower || a.id?.toLowerCase() === nameLower)
        if (match) targetBook = match.number
        else {
            const searched = targetBible.bookSearch(`${from.bookName} ${from.chapter}`)
            if (!searched?.book) return
            targetBook = searched.book
        }
    }

    // clamp the current chapter & verses to what exists in the target translation
    const TargetBook = await targetBible.getBook(targetBook)
    const targetChapterCount = TargetBook.data.chapters?.length || 0
    const targetChapter = targetChapterCount ? Math.min(Math.max(1, from.chapter), targetChapterCount) : from.chapter

    const TargetChapter = await TargetBook.getChapter(targetChapter)
    const targetChapterVerses = TargetChapter.data.verses || []
    const maxVerse = targetChapterVerses.length ? (targetChapterVerses[targetChapterVerses.length - 1]?.number ?? targetChapterVerses.length) : 0
    const verses = [...new Set(from.verses.map((a) => (maxVerse ? Math.min(Math.max(1, a), maxVerse) : a)))].sort((a, b) => a - b)

    setDrawerTabData("scripture", targetId)
    await projectResolved(targetId, targetBook, targetChapter, verses)
}

export function restorePrevious(): void {
    if (!previousState) return
    if (get(outLocked)) return

    const previous = previousState
    previousState = null

    selfProjecting = true
    try {
        activeScripture.set(previous.activeScripture)
        if (previous.outSlide) setOutput("slide", previous.outSlide)
        else clearSlide()
    } finally {
        selfProjecting = false
    }

    aiScriptureHasProjected.set(false)
}

export function resumeAutoProjection(): void {
    if (autoResumeTimer) {
        clearTimeout(autoResumeTimer)
        autoResumeTimer = null
    }
    aiScriptureAutoPaused.set(false)
}

export async function showInDrawer(detection: DetectedReference, focusTab = true): Promise<void> {
    const verses: number[] = []
    for (let v = detection.verseStart; v <= Math.max(detection.verseStart, detection.verseEnd); v++) verses.push(v)

    // map the canon book number to the drawer bible's own numbering
    let book: number = detection.bookNumber
    const drawerTabId = get(drawerTabsData).scripture?.activeSubTab || ""
    if (drawerTabId) {
        const parseId = get(scriptures)[drawerTabId]?.collection?.versions?.[0] || drawerTabId

        // 66 book bibles use the standard Protestant canon numbering - skip loading in that case
        const cachedBooks = get(scripturesCache)[parseId]?.books
        if (cachedBooks?.length !== 66) {
            try {
                const bible = await loadJsonBible(parseId)
                if (bible) book = resolveBookNumber(bible, detection) || detection.bookNumber
            } catch (err) {
                console.error("Error resolving AI scripture drawer book:", parseId, err)
            }
        }
    }

    openScripture.set({ book, chapter: detection.chapter, verses: [verses], play: false })
    // the automatic follow must never yank the operator away from another drawer tab -
    // only the explicit "show in drawer" button switches tabs
    if (focusTab) activeDrawerTab.set("scripture")
}

// MANUAL OVERRIDE WATCHER
// pause auto projection when the operator manually projects something else

let lastActiveSlideKey: string | null = null
const AUTO_RESUME_MS = 60 * 1000
let autoResumeTimer: NodeJS.Timeout | null = null
let ourLiveSlideKey: string | null = null // fingerprint of the slide the AI itself projected

outputs.subscribe((allOutputs) => {
    const outputList = Object.values(allOutputs || {})
    const active = outputList.find((a) => a.enabled === true && a.active === true && !a.stageOutput) || outputList.find((a) => a.enabled === true && !a.stageOutput)
    const slide = active?.out?.slide || null

    // light fingerprint - customDynamicValues includes the scripture reference for "temp" slides
    const key = slide ? JSON.stringify({ id: slide.id, layout: slide.layout, index: slide.index, values: slide.customDynamicValues || null }) : null

    const changed = key !== lastActiveSlideKey
    const previousKey = lastActiveSlideKey
    lastActiveSlideKey = key

    if (!changed || !sessionActive) return

    if (selfProjecting) {
        ourLiveSlideKey = key // remember what we put on the output, so only overriding THAT pauses auto
        return
    }

    // an operator-initiated scripture play moves the sermon anchor too
    if (key !== null && slide?.id === "temp") updateAnchorFromActiveScripture()

    if (getSettings().mode !== "auto") return // nothing to pause in confirm mode

    // ordinary output use (songs, slides, clearing) must NOT pause auto projection -
    // only the operator replacing/clearing a scripture the AI itself projected counts as an override
    if (!previousKey || previousKey !== ourLiveSlideKey) return
    ourLiveSlideKey = null

    aiScriptureAutoPaused.set(true)

    // the override is temporary - resume on its own so a missed chip can't silently disable auto mode for the rest of the service
    if (autoResumeTimer) clearTimeout(autoResumeTimer)
    autoResumeTimer = setTimeout(() => aiScriptureAutoPaused.set(false), AUTO_RESUME_MS)
})

function updateAnchorFromActiveScripture(): void {
    try {
        const current = get(activeScripture)
        const id = current.id || get(drawerTabsData).scripture?.activeSubTab || ""
        const reference = current.reference
        if (!id || !reference) return

        const chapter = parseNumber(reference.chapters[0])
        const verses = (reference.verses[0] || []).map(parseNumber).filter((a) => a >= 1)
        if (!(chapter >= 1) || !verses.length) return

        sendAnchorContext(id, reference.book, chapter, verses)
    } catch (err) {
        // skip unparsable states - the previous anchor stays
    }
}
