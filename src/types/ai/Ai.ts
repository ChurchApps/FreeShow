export type AIProviderId = "anthropic" | "openai" | "gemini" | "ollama"

export interface AiSuggestion {
    id: string
    action: string
    content: string
    timestamp: number
    confidence: number
    trigger: () => void
}
