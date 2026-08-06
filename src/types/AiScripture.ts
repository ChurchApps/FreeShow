// AI AUTO SCRIPTURE
// shared types between the renderer & electron process (IPC payloads)

export type AIProviderId = "anthropic" | "openai" | "gemini"

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
    source: "regex" | "llm"
    quote?: string // the transcript text that triggered the detection
    matchedBibleId?: string // set when quoted verse text matched a specific translation
    timestamp: number
}

export type WhisperModelId = "tiny" | "tiny.en" | "base" | "base.en" | "small" | "small.en" | "medium" | "medium.en" | "large-v3"

// transient downloading/verifying states are sent as AI_SCRIPTURE_WHISPER_PROGRESS events,
// and custom binary paths are verified separately (renderer setting) - this is only what main knows on its own
export interface WhisperStatus {
    binary: "not_installed" | "ready_local" | "ready_system"
    binaryPath?: string
    downloadedModels: WhisperModelId[]
}

export const AI_PROVIDER_MODELS: { [id in AIProviderId]: { models: { id: string; name: string; recommended?: boolean }[]; defaultModel: string } } = {
    anthropic: {
        models: [
            { id: "claude-haiku-4-5", name: "Claude Haiku 4.5 (fast)", recommended: true },
            { id: "claude-opus-5", name: "Claude Opus 5 (best accuracy)" }
        ],
        defaultModel: "claude-haiku-4-5"
    },
    openai: {
        models: [
            { id: "gpt-4o-mini", name: "GPT-4o mini (fast)", recommended: true },
            { id: "gpt-4o", name: "GPT-4o (best accuracy)" }
        ],
        defaultModel: "gpt-4o-mini"
    },
    gemini: {
        // verified against ai.google.dev/gemini-api/docs (2026-08): gemini-2.0-flash was shut down 2026-06-01 and "gemini-2.0-pro" never existed
        models: [
            { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (fast)", recommended: true },
            { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro (best accuracy)" }
        ],
        defaultModel: "gemini-2.5-flash"
    }
}

// book table handed from the renderer at start (merged from all selected translations)
export interface AiScriptureBook {
    number: number // book number as stored in the bible the names came from
    canonNumber?: number // position in the 66 book Protestant canon - set by the renderer for 66 book bibles (equal to number), undefined otherwise
    names: string[] // name/customName/abbreviations across the selected bibles
}

export interface AiScriptureStartConfig {
    whisperModel: WhisperModelId
    whisperCustomPath?: string
    whisperCustomModelPath?: string // use an already installed ggml model file instead of a downloaded one
    language: string // spoken language code passed to whisper (e.g. "en")
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
