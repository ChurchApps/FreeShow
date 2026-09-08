import type { AIProviderId } from "../../../types/ai/Ai"
import { getAiKey } from "../setup/aiKeys"
import { anthropicProvider } from "./providers/anthropic"
import { googleProvider } from "./providers/google"
import { ollamaProvider } from "./providers/ollama"
import { openaiProvider } from "./providers/openai"

export const llmProviders = {
    anthropic: anthropicProvider,
    openai: openaiProvider,
    google: googleProvider,
    ollama: ollamaProvider
}

export function getLLMProvider(id: AIProviderId) {
    return llmProviders[id]
}

export async function completeLLM(data: { providerId: AIProviderId; model: string; options: { systemPrompt?: string; prompt: string; jsonSchema?: any; temperature?: number; maxTokens?: number } }): Promise<{ text: string; error?: string; code?: string; retryAfter?: number }> {
    const key = getAiKey(data.providerId)
    if (!key && data.providerId !== "ollama") return { text: "", error: "Invalid API key" }

    try {
        const provider = getLLMProvider(data.providerId)
        const text = await provider.complete(key, data.model, data.options)
        return { text }
    } catch (err: any) {
        return { text: "", error: err?.message, retryAfter: err?.retryAfter }
    }
}

export function fetchProviderModels(providerId: AIProviderId) {
    const key = getAiKey(providerId)
    if (!key && providerId !== "ollama") return { text: "", error: "Invalid API key" }

    const provider = getLLMProvider(providerId)
    return provider.fetchModels(key)
}
