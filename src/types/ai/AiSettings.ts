import type { AIProviderId, AiScriptureEngine, WhisperModelId } from "./AiScripture"

export interface AiSettings {
    scripture?: AiScriptureSettings
}

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
    engine?: AiScriptureEngine
    whisperModel?: WhisperModelId
    whisperCustomPath?: string
    whisperCustomModelPath?: string
    spokenLanguage?: string
    interpretationMode?: boolean
    listenLanguage?: string
    spokenLanguages?: string[]
    autoCooldownSeconds?: number
    refCooldownSeconds?: number
    maxVerses?: number
    voiceCommands?: boolean
}
