// AI AUTO SCRIPTURE
// shared types between the renderer & electron process (IPC payloads)

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
    source: "regex" | "llm"
    quote?: string // the transcript text that triggered the detection
    matchedBibleId?: string // set when quoted verse text matched a specific translation
    timestamp: number
}

export type WhisperModelId = "tiny" | "tiny.en" | "base" | "base.en" | "small" | "small.en" | "medium" | "medium.en" | "large-v3"

// curated list of languages whisper transcribes well, alphabetical by English name
export const WHISPER_LANGUAGES: { code: string; name: string }[] = [
    { code: "am", name: "Amharic" },
    { code: "ar", name: "Arabic" },
    { code: "bg", name: "Bulgarian" },
    { code: "zh", name: "Chinese" },
    { code: "cs", name: "Czech" },
    { code: "da", name: "Danish" },
    { code: "nl", name: "Dutch" },
    { code: "en", name: "English" },
    { code: "fi", name: "Finnish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "el", name: "Greek" },
    { code: "he", name: "Hebrew" },
    { code: "hi", name: "Hindi" },
    { code: "hu", name: "Hungarian" },
    { code: "is", name: "Icelandic" },
    { code: "id", name: "Indonesian" },
    { code: "it", name: "Italian" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "ms", name: "Malay" },
    { code: "no", name: "Norwegian" },
    { code: "pl", name: "Polish" },
    { code: "pt", name: "Portuguese" },
    { code: "ro", name: "Romanian" },
    { code: "ru", name: "Russian" },
    { code: "sr", name: "Serbian" },
    { code: "sk", name: "Slovak" },
    { code: "es", name: "Spanish" },
    { code: "sw", name: "Swahili" },
    { code: "sv", name: "Swedish" },
    { code: "tl", name: "Tagalog" },
    { code: "ta", name: "Tamil" },
    { code: "th", name: "Thai" },
    { code: "tr", name: "Turkish" },
    { code: "uk", name: "Ukrainian" },
    { code: "ur", name: "Urdu" },
    { code: "vi", name: "Vietnamese" },
    { code: "yo", name: "Yoruba" },
    { code: "zu", name: "Zulu" }
]

// transient downloading/verifying states are sent as AI_SCRIPTURE_DOWNLOAD_PROGRESS events,
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
            { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro (best accuracy)" },
            { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite (fastest)" }
        ],
        defaultModel: "gemini-2.5-flash"
    },
    ollama: {
        // local models served by Ollama - ids verified against ollama.com/library (2026-08)
        models: [
            { id: "gemma3:4b", name: "Gemma 3 4B (local, fast)", recommended: true },
            { id: "gemma3:12b", name: "Gemma 3 12B (local, more accurate)" },
            { id: "gemma3:27b", name: "Gemma 3 27B (local, most accurate)" },
            { id: "gemma4:e4b", name: "Gemma 4 E4B (local, fast)" },
            { id: "gemma4:12b", name: "Gemma 4 12B (local, more accurate)" },
            { id: "llama3.2:3b", name: "Llama 3.2 3B (local, fastest)" },
            { id: "llama3.1:8b", name: "Llama 3.1 8B (local, balanced)" },
            { id: "qwen2.5:7b", name: "Qwen 2.5 7B (local, balanced)" },
            { id: "mistral:7b", name: "Mistral 7B (local, balanced)" },
            { id: "phi4:14b", name: "Phi-4 14B (local, more accurate)" }
        ],
        defaultModel: "gemma3:4b"
    }
}

// chapters per book of the 66 book canon, keyed by canon book number. Fixed across translations, so it can be
// a table instead of 66 async book loads - used to tell a spoken chapter from a chapter+verse pair the speech
// engine ran together ("deuteronomy 8 18" transcribed as "deuteronomy 818" - 818 is not a chapter of a 34 chapter book)
export const CANON_CHAPTER_COUNTS: { [canonNumber: number]: number } = {
    1: 50,
    2: 40,
    3: 27,
    4: 36,
    5: 34,
    6: 24,
    7: 21,
    8: 4,
    9: 31,
    10: 24,
    11: 22,
    12: 25,
    13: 29,
    14: 36,
    15: 10,
    16: 13,
    17: 10,
    18: 42,
    19: 150,
    20: 31,
    21: 12,
    22: 8,
    23: 66,
    24: 52,
    25: 5,
    26: 48,
    27: 12,
    28: 14,
    29: 3,
    30: 9,
    31: 1,
    32: 4,
    33: 7,
    34: 3,
    35: 3,
    36: 3,
    37: 2,
    38: 14,
    39: 4,
    40: 28,
    41: 16,
    42: 24,
    43: 21,
    44: 28,
    45: 16,
    46: 16,
    47: 13,
    48: 6,
    49: 6,
    50: 4,
    51: 4,
    52: 5,
    53: 3,
    54: 6,
    55: 4,
    56: 3,
    57: 1,
    58: 13,
    59: 5,
    60: 5,
    61: 3,
    62: 5,
    63: 1,
    64: 1,
    65: 1,
    66: 22
}

// the longest chapter in the bible (Psalm 119) - an upper bound on a plausible verse number
export const MAX_VERSE_NUMBER = 176

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
