export interface AiSettings {
    enabled?: boolean
    stt?: SttSettings
    llm?: LlmSettings

    scripture?: AiScriptureSettings
}

interface SttSettings {
    // enabled?: boolean
    micDeviceId?: string

    engine?: string
    // per-engine options
    engineOptions?: {
        [key: string]: SttEngineOptions
    }
}

export interface SttEngineOptions {
    customPath?: string

    language?: string // transcription language
    model?: string
    customModelPath?: string

    // WIP interpretationMode
    interpretationMode?: boolean
    listenLanguage?: string
    spokenLanguages?: string[]
}

interface LlmSettings {
    provider?: string
    model?: string
}

interface AiScriptureSettings {
    // enabled?: boolean // keep enabled all the time
    confidence?: "ask" | "highest" | "high" | "medium"
    searchBibles?: string[] // legacy tick list - every installed translation is searched now
    micDeviceId?: string
    provider?: string
    model?: string // legacy single model value (kept as fallback)
    models?: { [key: string]: string }
    customModel?: string
    engine?: string
    whisperModel?: string
    whisperCustomPath?: string
    whisperCustomModelPath?: string
    spokenLanguage?: string
    interpretationMode?: boolean
    listenLanguage?: string
    spokenLanguages?: string[]
    voiceCommands?: boolean
}
