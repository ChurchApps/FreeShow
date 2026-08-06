// AI AUTO SCRIPTURE
// captures microphone audio & streams it to the electron process for transcription,
// receives detected scripture references back & projects/suggests them

import { get } from "svelte/store"
import type { AiScriptureBook, AiScriptureCommandEvent, AiScriptureStartConfig, AiScriptureTranslation, AIProviderId, DetectedReference, WhisperModelId } from "../../types/AiScripture"
import { AI_PROVIDER_MODELS } from "../../types/AiScripture"
import { Main } from "../../types/IPC/Main"
import type { OutSlide } from "../../types/Show"
import type { BibleInstance } from "../components/drawer/bible/scripture"
import { getShortBibleName, loadJsonBible, outputIsScripture, playScripture } from "../components/drawer/bible/scripture"
import { clone } from "../components/helpers/array"
import { setDrawerTabData } from "../components/helpers/historyHelpers"
import { getFirstActiveOutput, setOutput } from "../components/helpers/output"
import { clearSlide } from "../components/output/clear"
import { requestMain, sendMain } from "../IPC/main"
import { AudioMicrophone } from "./audioMicrophone"
import { activeDrawerTab, activeScripture, aiScriptureAutoPaused, aiScriptureHasProjected, aiScriptureStatus, aiScriptureSuggestions, aiScriptureTranscript, drawerTabsData, openScripture, outLocked, outputs, scriptures, scripturesCache, special } from "../stores"
import aiScriptureProcessorUrl from "./aiScriptureProcessor.ts?worker&url"

const SUGGESTION_MAX_AGE = 3 * 60 * 1000
const SUGGESTION_LIMIT = 5
const QUOTE_MATCH_SCORE = 0.55
const QUOTE_DEMOTE_SCORE = 0.35

interface AiScriptureSettings {
    enabled?: boolean
    mode?: "confirm" | "auto"
    autoProjectQuoted?: boolean
    searchBibles?: string[]
    displayTranslation?: "drawer" | "matched"
    micDeviceId?: string
    provider?: AIProviderId
    model?: string // legacy single model value (kept as fallback)
    models?: { [key in AIProviderId]?: string }
    customModel?: string
    whisperModel?: WhisperModelId
    whisperCustomPath?: string
    whisperCustomModelPath?: string
    spokenLanguage?: string
    autoCooldownSeconds?: number
    refCooldownSeconds?: number
    maxVerses?: number
    voiceCommands?: boolean
}

function getSettings(): AiScriptureSettings {
    return get(special).aiScripture || {}
}

// map machine error codes to lang keys - unknown codes (e.g. raw device errors) pass through unchanged
const ERROR_LANG_KEYS: { [code: string]: string } = {
    no_scripture: "scripture.ai_error_no_scripture",
    start_failed: "scripture.ai_error_start_failed",
    microphone_access: "scripture.ai_error_microphone",
    whisper_not_installed: "settings.ai_whisper_not_installed",
    whisper_model_missing: "scripture.ai_error_model_missing",
    cancelled: "settings.ai_error_cancelled",
    unsupported_platform: "settings.ai_error_unsupported_platform",
    download_in_progress: "settings.ai_error_download_in_progress"
}

export function aiScriptureErrorText(code: string): string {
    return ERROR_LANG_KEYS[code] || code
}

let sessionActive = false
let searchBibleIds: string[] = []
let selfProjecting = false
let startInFlight: Promise<{ ok: boolean; error?: string }> | null = null
let suggestionPruneTimer: NodeJS.Timeout | null = null

let captureStream: MediaStream | null = null
let captureContext: AudioContext | null = null
let captureNode: AudioWorkletNode | null = null

let lastAutoProjectionAt = 0
let lastAutoProjectedRef: DetectedReference | null = null
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

async function startSession(): Promise<{ ok: boolean; error?: string }> {
    stopSession()
    aiScriptureStatus.set({ state: "starting" }) // set synchronously so the panel toggle is disabled right away

    const settings = getSettings()

    const activeSubTab = get(drawerTabsData).scripture?.activeSubTab || ""
    if (!activeSubTab) return startError("no_scripture")

    searchBibleIds = expandBibleIds(settings.searchBibles?.length ? settings.searchBibles : [activeSubTab])

    const books = await buildBookTable(searchBibleIds)
    if (!books.length) return startError("no_scripture")

    // only pass the LLM config when a key is saved for the provider (raw keys never leave the electron process)
    const provider = settings.provider || "anthropic"
    let llm: AiScriptureStartConfig["llm"] = null
    const status = await requestMain(Main.AI_SCRIPTURE_GET_STATUS)
    if (status?.keys?.[provider]) {
        // legacy "model" values are shared across providers - only use one that belongs to this provider
        const legacyModel = settings.model && AI_PROVIDER_MODELS[provider].models.some((a) => a.id === settings.model) ? settings.model : ""
        const model = settings.customModel || settings.models?.[provider] || legacyModel || "" // providers default internally on empty
        llm = { provider, model }
    }

    const language = settings.spokenLanguage || "en"
    const startConfig: AiScriptureStartConfig = {
        // default model must match the popup's derivation, or a non English user would request a model they never downloaded
        whisperModel: settings.whisperModel || (language.startsWith("en") ? "base.en" : "base"),
        whisperCustomPath: settings.whisperCustomPath || undefined,
        whisperCustomModelPath: settings.whisperCustomModelPath || undefined,
        language,
        books,
        llm,
        refCooldownSeconds: settings.refCooldownSeconds,
        voiceCommands: !!settings.voiceCommands,
        translations: buildTranslationTable(searchBibleIds)
    }

    aiScriptureTranscript.set([])
    aiScriptureSuggestions.set([])
    aiScriptureAutoPaused.set(false)

    // whisper might need a moment to spin up on first start
    const result = await requestMain(Main.AI_SCRIPTURE_START, startConfig, undefined, 60000)
    if (!result?.started) return startError(result?.error || "start_failed")

    const micDeviceId = await resolveMicDeviceId(settings.micDeviceId || "")
    if (micDeviceId && micDeviceId !== settings.micDeviceId) {
        // persist the auto-selected device so the settings dropdown shows what is actually capturing
        special.update((a) => ({ ...a, aiScripture: { ...(a.aiScripture || {}), micDeviceId } }))
    }

    const micError = await startMicCapture(micDeviceId)
    if (micError) {
        sendMain(Main.AI_SCRIPTURE_STOP)
        return startError(micError)
    }

    sessionActive = true

    // prune suggestions that are too old to still be relevant
    suggestionPruneTimer = setInterval(pruneSuggestions, 15000)

    return { ok: true }
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
    stopMicCapture()

    aiScriptureAutoPaused.set(false)
    aiScriptureStatus.set({ state: "stopped" })
}

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

// MICROPHONE CAPTURE

// prefer the saved device, else the system default, else the first available input -
// an unset device previously left the choice to Chromium, which can capture an input the user is not speaking into
async function resolveMicDeviceId(saved: string): Promise<string> {
    try {
        const devices = await AudioMicrophone.getList()
        if (!devices.length) return saved
        if (saved && devices.some((device) => device.deviceId === saved)) return saved

        return devices.find((device) => device.deviceId === "default")?.deviceId || devices[0].deviceId
    } catch (err) {
        console.error("Could not enumerate microphones:", err)
        return saved
    }
}

function getMicStream(deviceId: string) {
    return navigator.mediaDevices.getUserMedia({
        audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
            sampleRate: 48000
        }
    })
}

async function startMicCapture(deviceId: string): Promise<string | null> {
    let stream: MediaStream | null = null
    try {
        stream = await getMicStream(deviceId)
    } catch (err: any) {
        if (err?.name === "NotReadableError") {
            sendMain(Main.ACCESS_MICROPHONE_PERMISSION)
            return "microphone_access"
        }

        // saved device is probably unplugged - retry once with the default device
        if (err?.name === "OverconstrainedError" && deviceId) {
            try {
                stream = await getMicStream("")
            } catch (retryErr: any) {
                console.error("Failed to start AI scripture microphone:", retryErr)
                return String(retryErr?.message || retryErr?.name || retryErr)
            }
        } else {
            console.error("Failed to start AI scripture microphone:", err)
            return String(err?.message || err?.name || err)
        }
    }

    if (!stream) return "microphone_access"
    captureStream = stream

    try {
        captureContext = new AudioContext({ sampleRate: 48000 })
        const source = captureContext.createMediaStreamSource(stream)

        await captureContext.audioWorklet.addModule(aiScriptureProcessorUrl)

        captureNode = new AudioWorkletNode(captureContext, "ai-scripture-processor")
        captureNode.port.onmessage = (e) => {
            sendMain(Main.AI_SCRIPTURE_AUDIO_DATA, { buffer: e.data })
        }

        source.connect(captureNode)
        captureNode.connect(captureContext.destination) // needed for chrome to keep the node alive
    } catch (err: any) {
        console.error("Failed to start AI scripture audio processing:", err)
        stopMicCapture()
        return String(err?.message || err)
    }

    return null
}

function stopMicCapture() {
    if (captureStream) {
        captureStream.getTracks().forEach((t) => t.stop())
        captureStream = null
    }
    if (captureNode) {
        captureNode.port.onmessage = null
        captureNode.disconnect()
        captureNode = null
    }
    if (captureContext) {
        captureContext.close().catch(() => null)
        captureContext = null
    }
}

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

    if (ref.type === "quoted" && ref.quote) await verifyQuote(ref)

    addSuggestion(ref)

    // auto projection
    if (settings.mode !== "auto") return
    if (get(aiScriptureAutoPaused) || get(outLocked)) return
    if (ref.confidence !== "high") return
    if (ref.type === "quoted" && !settings.autoProjectQuoted) return

    queueAutoProjection(ref, settings)
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

// same book/chapter with an overlapping verse range
function isSameReference(a: DetectedReference, b: DetectedReference) {
    return a.bookNumber === b.bookNumber && a.chapter === b.chapter && a.verseStart <= b.verseEnd && b.verseStart <= a.verseEnd
}

function addSuggestion(ref: DetectedReference) {
    aiScriptureSuggestions.update((list) => {
        const now = Date.now()
        const active = list.filter((a) => now - a.timestamp < SUGGESTION_MAX_AGE)

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

function queueAutoProjection(ref: DetectedReference, settings: AiScriptureSettings) {
    // don't re-project a reference that was just auto projected
    const refCooldownMs = (settings.refCooldownSeconds ?? 90) * 1000
    if (lastAutoProjectedRef && Date.now() - lastAutoProjectionAt < refCooldownMs && isSameReference(lastAutoProjectedRef, ref)) return

    // respect the minimum display time of the current projection
    const cooldownMs = (settings.autoCooldownSeconds ?? 10) * 1000
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

    const drawerTabId = get(drawerTabsData).scripture?.activeSubTab || ""
    const targetId = settings.displayTranslation === "matched" && detection.matchedBibleId ? detection.matchedBibleId : drawerTabId
    if (!targetId) return false

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

    // "matched" display mode projects from the matched translation
    if (targetId !== drawerTabId) setDrawerTabData("scripture", targetId)

    const verses: number[] = []
    for (let v = verseStart; v <= verseEnd; v++) verses.push(v)

    await projectResolved(targetId, book, chapter, verses)
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

        sendMain(Main.AI_SCRIPTURE_CONTEXT, { book: name, bookNumber, chapter, verseStart: Math.min(...verses), verseEnd: Math.max(...verses) })
    } catch (err) {
        // the anchor is best effort - a failed load just leaves the previous anchor in place
    }
}

function resolveBookNumber(bible: BibleInstance, ref: DetectedReference): number {
    const books = bible.data.books || []

    // 66 book bibles use the standard Protestant canon numbering
    if (books.length === 66) return ref.bookNumber

    const nameLower = (ref.book || "").toLowerCase()
    const match = books.find((a) => a.name?.toLowerCase() === nameLower || a.abbreviation?.toLowerCase() === nameLower || a.id?.toLowerCase() === nameLower)
    if (match) return match.number

    const searched = bible.bookSearch(`${ref.book} ${ref.chapter}`)
    return searched?.book || 0
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

async function switchTranslation(cmd: Extract<AiScriptureCommandEvent, { type: "translation" | "translation_cycle" }>, from: { currentId: string; bible: BibleInstance; bookName: string; book: number | string; chapter: number; verses: number[] }): Promise<void> {
    let targetId = ""
    if (cmd.type === "translation") targetId = cmd.bibleId
    else {
        // cycle to the next selected translation
        const ids = searchBibleIds.length ? searchBibleIds : [from.currentId]
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
    aiScriptureAutoPaused.set(false)
}

export async function showInDrawer(detection: DetectedReference): Promise<void> {
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
    activeDrawerTab.set("scripture")
}

// MANUAL OVERRIDE WATCHER
// pause auto projection when the operator manually projects something else

let lastActiveSlideKey: string | null = null
outputs.subscribe((allOutputs) => {
    const outputList = Object.values(allOutputs || {})
    const active = outputList.find((a) => a.enabled === true && a.active === true && !a.stageOutput) || outputList.find((a) => a.enabled === true && !a.stageOutput)
    const slide = active?.out?.slide || null

    // light fingerprint - customDynamicValues includes the scripture reference for "temp" slides
    const key = slide ? JSON.stringify({ id: slide.id, layout: slide.layout, index: slide.index, values: slide.customDynamicValues || null }) : null

    const changed = key !== lastActiveSlideKey
    lastActiveSlideKey = key

    if (!changed || !sessionActive || selfProjecting) return
    if (key === null) return // slide cleared (possibly by us or "restore previous") - not a manual override

    // an operator-initiated scripture play moves the sermon anchor too
    if (slide?.id === "temp") updateAnchorFromActiveScripture()

    if (getSettings().mode !== "auto") return // nothing to pause in confirm mode

    aiScriptureAutoPaused.set(true)
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
