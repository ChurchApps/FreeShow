// AI AUTO SCRIPTURE

export type AIProviderId = "anthropic" | "openai" | "gemini" | "ollama"

export type AIErrorCode = "invalid_key" | "forbidden" | "model_not_found" | "rate_limited" | "invalid_request" | "server_error" | "timeout" | "network" | "refusal" | "bad_response"

export interface AIError {
    code: AIErrorCode
    message?: string
}

export interface DetectedReference {
    id: string
    book: string // canonical English book name (LLM) / matched book name (local)
    bookNumber: number // position in the 66 book Protestant canon when known, otherwise the matched bible's own book number
    chapter: number
    verseStart: number
    verseEnd: number
    confidence: "high" | "medium" | "low"
    type: "explicit" | "quoted"
    source: "regex" | "llm" | "local" // "local" = the renderer's quote matcher (no LLM involved)
    quote?: string // the transcript text that triggered the detection
    matchedBibleId?: string // set when quoted verse text matched a specific translation
    continuation?: boolean // a recitation flowing into the next verse of the live passage (follow-along)
    timestamp: number
}

export type WhisperModelId = "tiny" | "tiny.en" | "base" | "base.en" | "small" | "small.en" | "medium" | "medium.en" | "large-v3"

// transient downloading/verifying states are sent as AI_DOWNLOAD_PROGRESS events,
// and custom binary paths are verified separately (renderer setting) - this is only what main knows on its own
export interface WhisperStatus {
    binary: "not_installed" | "ready_local" | "ready_system"
    binaryPath?: string
    downloadedModels: WhisperModelId[]
}

// the streaming engine has no binary to install - only the optional native addon and the downloaded model
export interface NemotronStatus {
    supported: boolean // the sherpa-onnx native addon loaded on this platform
    ready: boolean // model files + the VAD gate are downloaded
}

// book table handed from the renderer at start (merged from all selected translations)
export interface AiScriptureBook {
    number: number // book number as stored in the bible the names came from
    canonNumber?: number // position in the 66 book Protestant canon - set by the renderer for 66 book bibles (equal to number), undefined otherwise
    names: string[] // name/customName/abbreviations across the selected bibles
}

/** Which transcription engine a session runs on. */
export type AiScriptureEngine = "whisper" | "nemotron"

export interface AiScriptureStartConfig {
    engine?: AiScriptureEngine // defaults to whisper
    whisperModel: WhisperModelId
    whisperCustomPath?: string
    whisperCustomModelPath?: string // use an already installed ggml model file instead of a downloaded one
    language: string // spoken language code passed to whisper (e.g. "en")
    interpretationMode?: boolean // live interpretation: transcribe everything (auto language), only detect from listenLanguage
    listenLanguage?: string // language code scripture detection listens to when interpretationMode is on
    spokenLanguages?: string[] // interpretation mode: the languages actually being spoken - whisper guesses outside this set are double-checked against listenLanguage
    books: AiScriptureBook[]
    llm: { provider: AIProviderId; model: string } | null
    refCooldownSeconds?: number // suppress re-emitting an intersecting reference within this window
    voiceCommands?: boolean
    translations?: AiScriptureTranslation[] // selected translations, for spoken translation switching
}

export type AiScriptureState = "starting" | "listening" | "stopped" | "error" | "llm_paused"

// VOICE COMMANDS

// installed translations handed from the renderer at start, so spoken names ("NIV") can be resolved in the electron process
export interface AiScriptureTranslation {
    id: string
    names: string[]
}

export type AiScriptureCommand = { type: "verse_next" } | { type: "verse_previous" } | { type: "chapter_next" } | { type: "chapter_previous" } | { type: "verse_jump"; verse: number } | { type: "chapter_jump"; chapter: number; verse?: number } | { type: "translation"; bibleId: string } | { type: "translation_cycle" }

export type AiScriptureCommandEvent = AiScriptureCommand & { phrase: string }
