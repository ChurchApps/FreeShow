import { anthropicProvider } from "./models/anthropic"
import { geminiProvider } from "./models/gemini"
import { ollamaProvider } from "./models/ollama"
import { openaiProvider } from "./models/openai"

export const llmProviders = {
    anthropic: anthropicProvider,
    openai: openaiProvider,
    gemini: geminiProvider,
    ollama: ollamaProvider
}
type AIProviderId = keyof typeof llmProviders

export function getLLMProvider(id: AIProviderId) {
    return llmProviders[id]
}
