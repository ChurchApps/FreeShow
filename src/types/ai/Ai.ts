export type AIProviderId = "anthropic" | "openai" | "gemini" | "ollama"

export type AiFeatureState = "starting" | "listening" | "stopped" | "error" | "llm_paused"

export interface AiFeatureStatus {
    state: AiFeatureState
    message?: string
    keyless?: boolean
}

export interface AiSuggestion {
    id: string
    action: string
    content: string
    timestamp: number
    confidence: number
    trigger: () => void
}
